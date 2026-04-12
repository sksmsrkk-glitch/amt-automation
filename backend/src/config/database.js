// ============================================================
// 데이터베이스 설정 / 래퍼
// ------------------------------------------------------------
// better-sqlite3 대신 sql.js(Wasm) 를 사용한다. (네이티브 빌드 불필요)
// - better-sqlite3 와 유사한 동기 API(prepare/run/get/all)를 제공하는
//   얇은 래퍼를 구현해서 라우트 코드가 깔끔하게 쓸 수 있도록 한다.
// - 쓰기 작업 후에는 파일로 DB 내용을 즉시 저장(saveDb)한다.
// - 트랜잭션 중에는 중간 저장을 건너뛰고 커밋 시점에만 저장한다.
// ============================================================

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// 모듈 전역 상태: DB 래퍼, 저장 경로, 트랜잭션 플래그
let dbWrapper = null;
let dbPath = null;
let inTransaction = false;

// 변경사항을 디스크에 flush. 트랜잭션 중에는 스킵한다.
function saveDb() {
  if (dbWrapper && dbPath && !inTransaction) {
    const data = dbWrapper._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// sql.js 위에 better-sqlite3 와 유사한 prepared statement API 를 제공한다.
class PreparedStatement {
  constructor(database, sql) {
    this._db = database;
    this._sql = sql;
  }

  run(...params) {
    this._db.run(this._sql, params.length > 0 ? params : undefined);
    const result = this._db.exec("SELECT last_insert_rowid() as id");
    const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
    const changes = this._db.getRowsModified();
    saveDb();
    return { lastInsertRowid, changes };
  }

  get(...params) {
    let stmt;
    try {
      stmt = this._db.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      if (stmt) stmt.free();
    }
  }

  all(...params) {
    const results = [];
    let stmt;
    try {
      stmt = this._db.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      if (stmt) stmt.free();
    }
  }
}

class DatabaseWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
  }

  prepare(sql) {
    return new PreparedStatement(this._db, sql);
  }

  exec(sql) {
    this._db.exec(sql);
    saveDb();
  }

  pragma(str) {
    try {
      this._db.exec(`PRAGMA ${str};`);
    } catch (e) {
      // Some pragmas may not work in sql.js (e.g. WAL mode)
    }
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._db.exec("BEGIN TRANSACTION");
      inTransaction = true;
      try {
        const result = fn(...args);
        self._db.exec("COMMIT");
        inTransaction = false;
        saveDb();
        return result;
      } catch (e) {
        self._db.exec("ROLLBACK");
        inTransaction = false;
        throw e;
      }
    };
  }
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      nationality TEXT,
      role TEXT DEFAULT 'customer',
      language TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      address TEXT,
      image_url TEXT,
      rating REAL DEFAULT 0,
      amenities TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      max_guests INTEGER DEFAULT 2,
      bed_type TEXT,
      amenities TEXT DEFAULT '[]',
      image_url TEXT,
      base_price REAL NOT NULL,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_rooms INTEGER NOT NULL,
      booked_rooms INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(room_type_id, date),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      category TEXT,
      image_url TEXT,
      base_price REAL NOT NULL,
      duration TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      booked_quantity INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(ticket_id, date),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      image_url TEXT,
      base_price REAL NOT NULL,
      includes TEXT DEFAULT '[]',
      duration TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS package_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      booked_quantity INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(package_id, date),
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT,
      product_type TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      room_type_id INTEGER,
      check_in TEXT,
      check_out TEXT,
      visit_date TEXT,
      guests INTEGER DEFAULT 1,
      quantity INTEGER DEFAULT 1,
      nights INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      payment_id TEXT,
      special_requests TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      method TEXT DEFAULT 'stripe',
      stripe_payment_id TEXT,
      status TEXT DEFAULT 'pending',
      refund_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      qr_data TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0,
      product_type TEXT,
      product_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      min_quantity INTEGER DEFAULT 1,
      max_uses INTEGER,
      current_uses INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add images column to tables that need it
  const alterStatements = [
    "ALTER TABLE hotels ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE room_types ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE tickets ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE packages ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE promotions ADD COLUMN blackout_dates TEXT DEFAULT '[]'",
    "ALTER TABLE hotels ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE hotels ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE room_types ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE tickets ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE tickets ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE packages ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE packages ADD COLUMN sort_order INTEGER DEFAULT 0",
  ];
  for (const sql of alterStatements) {
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  }
}

async function initDb() {
  if (dbWrapper) return dbWrapper;

  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'high1.db');

  const SQL = await initSqlJs();

  let sqlJsDb;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  dbWrapper = new DatabaseWrapper(sqlJsDb);
  dbWrapper.pragma('foreign_keys = ON');
  initTables(dbWrapper);

  return dbWrapper;
}

function getDb() {
  if (!dbWrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbWrapper;
}

module.exports = { getDb, initDb };
