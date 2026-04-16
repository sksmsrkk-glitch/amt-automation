// ============================================================================
// PostgreSQL (pg) 기반 데이터베이스 래퍼
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) process.env.DATABASE_URL 로 PostgreSQL Pool 을 생성한다.
//   2) 기존 sql.js / better-sqlite3 호환 API 를 유지하되, 모든 메서드가
//      Promise 를 반환한다 (pg 는 비동기).
//   3) SQL 문자열의 `?` 플레이스홀더를 `$1, $2, ...` 로 자동 변환한다.
//   4) `datetime('now')` 를 PostgreSQL 의 `NOW()` 로 변환한다.
//   5) transaction() 은 AsyncLocalStorage 를 사용해 트랜잭션 내부의
//      prepare() 호출이 자동으로 전용 client 를 사용하도록 한다.
//   6) 스키마 생성은 Supabase 에서 이미 완료되었으므로 initDb() 에서
//      스키마를 만들지 않는다.
//
// 누가 import 하나:
//   - 모든 라우트 파일: `const { getDb } = require('../config/database')`
//   - src/index.js: 부트 시퀀스에서 await initDb() 호출
//   - src/seed.js: 시드 스크립트가 동일하게 initDb() 로 준비
//
// 주의할 점:
//   - 모든 prepare().run/get/all() 호출이 이제 async 이므로 호출부에서
//     반드시 await 해야 한다.
//   - pragma() 는 PostgreSQL 에서 의미가 없으므로 no-op 이다.
//   - .env 파일은 dotenv 의존성 없이 수동으로 로드한다.
// ============================================================================

const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');
const fs = require('fs');

// AsyncLocalStorage: transaction() 실행 중 전용 client 를 prepare() 호출에
// 자동으로 전달하기 위한 컨텍스트 저장소.
const asyncLocalStorage = new AsyncLocalStorage();

// 모듈 로컬 상태. 싱글턴이므로 프로세스 당 하나의 Pool / dbWrapper 만 존재한다.
let pool = null;
let dbWrapper = null;

// ----------------------------------------------------------------------------
// .env 수동 로드
// ----------------------------------------------------------------------------
// dotenv 의존성을 추가하지 않고 backend/.env 파일을 직접 파싱하여
// process.env 에 설정한다. 이미 환경 변수가 설정된 경우(컨테이너 등)에는
// 기존 값을 덮어쓰지 않는다.
// ----------------------------------------------------------------------------

/**
 * backend/.env 파일을 읽어 process.env 에 설정한다.
 * - 빈 줄, # 으로 시작하는 주석은 무시.
 * - 이미 process.env 에 존재하는 키는 건드리지 않는다 (배포 환경 우선).
 * - 값의 앞뒤 따옴표(', ")를 제거한다.
 */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // 빈 줄 또는 주석 무시
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // 따옴표 제거: "value" -> value, 'value' -> value
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // 기존 환경 변수가 없을 때만 설정 (배포 환경 우선)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ----------------------------------------------------------------------------
// SQL 변환 유틸리티
// ----------------------------------------------------------------------------

/**
 * SQLite 스타일의 SQL 을 PostgreSQL 호환으로 변환한다.
 *
 * 변환 내용:
 *   1) `?` 플레이스홀더 -> `$1`, `$2`, ... (pg 의 파라미터 바인딩 방식)
 *   2) `datetime('now')` -> `NOW()` (PostgreSQL 현재 시각 함수)
 *
 * @param {string} sql - SQLite 스타일 SQL 문자열
 * @returns {{ sql: string, paramCount: number }}
 */
function convertSql(sql) {
  let idx = 0;
  // ? 를 $1, $2, $3 ... 으로 순차 치환
  let converted = sql.replace(/\?/g, () => `$${++idx}`);
  // datetime('now') -> NOW()  (대소문자 무관)
  converted = converted.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');
  return { sql: converted, paramCount: idx };
}

/**
 * 현재 실행 컨텍스트에서 사용해야 할 queryable 객체를 반환한다.
 * - transaction() 내부: AsyncLocalStorage 에 저장된 전용 client
 * - 그 외: 커넥션 풀 (pool)
 *
 * @returns {import('pg').Pool | import('pg').PoolClient}
 */
function getQueryable() {
  const store = asyncLocalStorage.getStore();
  return store?.client || pool;
}

// ----------------------------------------------------------------------------
// PreparedStatement — better-sqlite3 호환 비동기 래퍼
// ----------------------------------------------------------------------------

/**
 * Prepared statement 한 건. 세 메서드를 제공한다 (모두 async):
 *   - run(...params)  : INSERT/UPDATE/DELETE. { lastInsertRowid, changes } 반환.
 *   - get(...params)  : 단일 행 SELECT. 레코드 객체 또는 undefined.
 *   - all(...params)  : 다중 행 SELECT. 레코드 객체 배열.
 *
 * 내부적으로 convertSql() 로 SQL 을 변환하고 pg 의 query() 를 호출한다.
 */
class PreparedStatement {
  /**
   * @param {string} sql - 변환 완료된 PostgreSQL SQL 문자열
   */
  constructor(sql) {
    this._sql = sql;
  }

  /**
   * INSERT/UPDATE/DELETE 실행.
   *
   * INSERT 의 경우:
   *   - `RETURNING id` 가 없으면 자동으로 추가하여 lastInsertRowid 를 얻는다.
   *   - 반환: { lastInsertRowid: <삽입된 id>, changes: rowCount }
   *
   * UPDATE/DELETE 의 경우:
   *   - 반환: { lastInsertRowid: 0, changes: rowCount }
   *
   * @param  {...any} params - 바인딩 파라미터 (positional)
   * @returns {Promise<{lastInsertRowid: number, changes: number}>}
   */
  async run(...params) {
    const q = getQueryable();
    let finalSql = this._sql;
    const isInsert = /^\s*INSERT\s/i.test(finalSql);

    // INSERT 문에 RETURNING 절이 없으면 자동으로 추가하여
    // 삽입된 행의 id 를 가져올 수 있도록 한다.
    if (isInsert && !/RETURNING/i.test(finalSql)) {
      finalSql += ' RETURNING id';
    }

    const result = await q.query(finalSql, params);

    return {
      lastInsertRowid: isInsert ? (result.rows?.[0]?.id ?? 0) : 0,
      changes: result.rowCount || 0,
    };
  }

  /**
   * 단일 행 SELECT. 매치가 없으면 undefined 를 반환한다.
   *
   * @param  {...any} params - 바인딩 파라미터 (positional)
   * @returns {Promise<object|undefined>}
   */
  async get(...params) {
    const q = getQueryable();
    const result = await q.query(this._sql, params);
    return result.rows[0] || undefined;
  }

  /**
   * 다중 행 SELECT. 매치가 없으면 빈 배열을 반환한다.
   *
   * @param  {...any} params - 바인딩 파라미터 (positional)
   * @returns {Promise<object[]>}
   */
  async all(...params) {
    const q = getQueryable();
    const result = await q.query(this._sql, params);
    return result.rows;
  }
}

// ----------------------------------------------------------------------------
// DatabaseWrapper — getDb() 가 반환하는 객체
// ----------------------------------------------------------------------------

/**
 * DatabaseWrapper — getDb() 가 반환하는 객체.
 *
 * better-sqlite3 의 Database 인터페이스를 흉내 내어 prepare / exec /
 * pragma / transaction 네 가지 메서드를 제공한다.
 * 모든 I/O 메서드는 Promise 를 반환한다 (pg 가 비동기이므로).
 */
class DatabaseWrapper {
  /**
   * 새 PreparedStatement 를 만든다. run/get/all 로 체이닝한다.
   *
   * SQL 문자열은 이 시점에 convertSql() 로 PostgreSQL 호환 형식으로
   * 변환된다 (? -> $N, datetime('now') -> NOW()).
   *
   * @param {string} sql - SQLite 스타일 SQL 문자열
   * @returns {PreparedStatement}
   */
  prepare(sql) {
    const { sql: convertedSql } = convertSql(sql);
    return new PreparedStatement(convertedSql);
  }

  /**
   * 여러 SQL 문을 세미콜론으로 이어서 한 번에 실행 (async).
   * DDL(CREATE TABLE 등) 이나 seed 스크립트의 일괄 DELETE 에 쓰인다.
   *
   * 세미콜론으로 분리된 각 문장을 개별 query() 로 실행한다.
   * PostgreSQL 은 기본적으로 멀티-스테이트먼트를 한 query() 로 보낼 수도
   * 있지만, 안전하게 개별 실행하여 에러 위치를 명확히 한다.
   *
   * @param {string} sql - 세미콜론으로 구분된 SQL 문자열
   * @returns {Promise<void>}
   */
  async exec(sql) {
    const q = getQueryable();
    // datetime('now') 변환 적용
    const converted = sql.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');

    // 세미콜론으로 분리하여 개별 실행. 빈 문자열은 건너뛴다.
    const statements = converted.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of statements) {
      await q.query(stmt.trim());
    }
  }

  /**
   * PRAGMA 실행 헬퍼 — PostgreSQL 에서는 no-op.
   *
   * SQLite 의 PRAGMA(foreign_keys, WAL 등) 는 PostgreSQL 에서 별도 설정
   * 이거나 기본 동작이므로 호출해도 아무 일도 하지 않는다.
   *
   * @param {string} _str - PRAGMA 문자열 (무시됨)
   */
  pragma(_str) {
    // PostgreSQL 에서는 PRAGMA 가 없으므로 no-op.
    // foreign_keys = ON 은 PostgreSQL 에서 기본 동작이다.
  }

  /**
   * 트랜잭션 데코레이터 — better-sqlite3 와 같은 패턴이지만 async.
   *
   * 사용법:
   *   const tx = db.transaction((args) => { ... 여러 db 호출 ... });
   *   await tx(args);  // 실제 실행 (async)
   *
   * 반환 함수를 호출하면 BEGIN → fn() → COMMIT 가 순차로 일어난다.
   * fn() 안에서 throw 가 발생하면 ROLLBACK 후 에러를 재throw 한다.
   *
   * 핵심 설계:
   *   - pool.connect() 로 전용 client 를 확보한다.
   *   - AsyncLocalStorage 로 fn() 실행 컨텍스트에 client 를 주입한다.
   *   - fn() 내부의 db.prepare() 호출은 getQueryable() 을 통해
   *     자동으로 이 전용 client 를 사용하게 된다.
   *   - 이렇게 하면 fn() 코드를 수정하지 않아도 트랜잭션 내 모든 쿼리가
   *     동일 client (= 동일 트랜잭션) 에서 실행된다.
   *
   * @param {Function} fn - 트랜잭션 내에서 실행할 함수
   * @returns {Function} 래핑된 async 함수
   */
  transaction(fn) {
    // eslint-disable-next-line no-unused-vars
    const db = this; // fn 내부에서 db 참조가 필요할 수 있으므로 캡처
    return async function (...args) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // AsyncLocalStorage 로 전용 client 를 컨텍스트에 주입.
        // fn() 내부의 모든 getQueryable() 호출이 이 client 를 반환한다.
        const result = await asyncLocalStorage.run({ client }, async () => {
          return await fn(...args);
        });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        // 반드시 client 를 풀에 반환. 누락하면 커넥션 고갈(pool exhaustion).
        client.release();
      }
    };
  }
}

// ----------------------------------------------------------------------------
// 초기화 / 접근 함수
// ----------------------------------------------------------------------------

/**
 * DB 초기화 엔트리 포인트. 이미 초기화된 경우 기존 wrapper 를 반환한다.
 *
 * 동작 순서:
 *   1) loadEnv() 로 backend/.env 를 파싱하여 DATABASE_URL 등을 설정.
 *   2) pg.Pool 생성 (DATABASE_URL, SSL 활성화).
 *   3) pool.query('SELECT 1') 로 연결 테스트.
 *   4) DatabaseWrapper 인스턴스를 만들어 모듈 변수에 캐싱.
 *
 * 스키마 생성은 Supabase 에서 이미 완료되었으므로 여기서는 하지 않는다.
 *
 * @returns {Promise<DatabaseWrapper>}
 *
 * 호출: src/index.js 의 start(), src/seed.js 의 main().
 */
async function initDb() {
  if (dbWrapper) return dbWrapper;

  // .env 파일에서 DATABASE_URL 등을 로드
  loadEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL 환경 변수가 설정되지 않았습니다. ' +
      'backend/.env 파일에 DATABASE_URL=postgres://... 를 추가하거나 ' +
      '환경 변수를 직접 설정하세요.'
    );
  }

  // PostgreSQL 커넥션 풀 생성
  // - connectionString: Supabase 등에서 제공하는 postgres:// URL
  // - ssl: Supabase 는 SSL 필수. rejectUnauthorized: false 로 자체 서명 인증서 허용.
  // - max: 동시 커넥션 최대 10개. 서버 부하에 따라 조절 가능.
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });

  // 연결 테스트 — 부팅 시 DB 접속 불가 상태를 즉시 감지한다.
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL 연결 성공');
  } catch (err) {
    console.error('[DB] PostgreSQL 연결 실패:', err.message);
    throw err;
  }

  dbWrapper = new DatabaseWrapper();

  // pragma('foreign_keys = ON') 은 no-op 이지만 기존 호출 코드와의
  // 호환성을 위해 남겨둔다. PostgreSQL 은 FK 가 기본으로 활성화되어 있다.

  return dbWrapper;
}

/**
 * 현재 DB wrapper 를 반환한다. initDb() 호출 전이면 예외를 던진다.
 * 라우트 핸들러가 매 요청마다 호출하므로 반드시 인-메모리 캐시 히트여야
 * 한다. 초기화는 서버 부트에서 단 한 번만 일어난다.
 *
 * @returns {DatabaseWrapper}
 */
function getDb() {
  if (!dbWrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbWrapper;
}

module.exports = { getDb, initDb };
