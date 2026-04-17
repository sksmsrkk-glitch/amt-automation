// ============================================================================
// High1 Resort 예약 플랫폼 — 백엔드 엔트리 포인트
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) Express 애플리케이션 객체를 만든다.
//   2) CORS · JSON 바디 파서 등 공통 미들웨어를 등록한다.
//   3) PostgreSQL (pg) 커넥션 풀을 초기화한다.
//      (DB가 준비되기 전에 라우트를 마운트하면 초기 요청에서 "Database not
//       initialized" 예외가 터지므로 반드시 await initDb() 이후에 라우트를
//       붙여야 한다.)
//   4) `/api/*` 아래에 공개 라우트 · 관리자 라우트를 전부 mount 한다.
//   5) 404 핸들러 → 전역 에러 핸들러 → listen() 순서로 서버를 띄운다.
//
// 포트: 기본 4000. 환경 변수 PORT 로 재정의할 수 있다. (start.sh 스크립트는
// 이 값을 고정 4000 으로 가정하므로, 바꿀 때는 start.sh / vite proxy 설정도
// 같이 맞춰야 한다.)
// ============================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, initDb } = require('./config/database');

// ---------------------------------------------------------------------------
// 라우트 모듈 import
// ---------------------------------------------------------------------------
// 공개 API (인증 없이 또는 고객 인증으로 접근): 인증, 상품 조회, 예약.
const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotels');
const ticketRoutes = require('./routes/tickets');
const packageRoutes = require('./routes/packages');
const bookingRoutes = require('./routes/bookings');
// 리조트 소개 콘텐츠 — 메인 페이지 썸네일 + 상세 페이지(유튜브/갤러리/리치텍스트).
const showcaseRoutes = require('./routes/showcases');

// 관리자 전용 API. 각 라우터 내부에서 authenticate + requireAdmin 미들웨어를
// router.use() 로 일괄 적용하고 있어, 여기서는 단순히 경로만 매핑한다.
const adminProductRoutes = require('./routes/admin/products');
const adminBookingRoutes = require('./routes/admin/bookings');
const adminUserRoutes = require('./routes/admin/users');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminPaymentRoutes = require('./routes/admin/payments');
const uploadRoutes = require('./routes/admin/upload');
const promotionRoutes = require('./routes/admin/promotions');
// 구매 게이트용 access code 발급 CRUD. 관리자가 "특정 유저 × 특정 상품"
// 조합의 1회성(또는 N회성) 구매 권한 코드를 발급한다. 자세한 설계는
// routes/admin/access-codes.js 파일 헤더 참고.
const accessCodeRoutes = require('./routes/admin/access-codes');
// Showcase 콘텐츠 관리 CRUD. 어드민에서 리조트 소개 콘텐츠를 생성/수정/삭제.
const adminShowcaseRoutes = require('./routes/admin/showcases');

const app = express();
// PORT 환경변수가 지정되지 않으면 4000 을 사용한다.
// 변경할 경우 vite.config.js 의 proxy(`/api` → `http://localhost:4000`)
// 그리고 start.sh / stop.sh 의 포트 체크 로직도 같이 수정해야 한다.
const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------------------
// 공통 미들웨어
// ---------------------------------------------------------------------------
// CORS: 개발 환경에서는 vite dev 서버(3000/3001)가 프록시를 태우기 때문에
// 굳이 CORS 가 필요 없지만, 직접 curl/Postman 등으로 때릴 때나 다른 오리진
// 에서 호출할 경우를 대비해 기본 정책(모든 오리진 허용)으로 열어 둔다.
// 운영 환경에서는 화이트리스트로 좁히는 것을 권장.
app.use(cors());

// JSON 바디 파서. limit 을 10mb 로 올린 것은 Base64 로 인코딩된 이미지
// 페이로드가 넘어올 수 있는 관리자 라우트(프로모션 배너 등) 때문이다.
// 실제 이미지 업로드는 multer 가 처리하는 /api/admin/upload 경로를 쓰므로
// 보통은 10mb 한도에 닿지 않는다.
app.use(express.json({ limit: '10mb' }));
// URL-encoded 폼 파서. 현재 라우트 중 실제로 x-www-form-urlencoded 바디를
// 쓰는 곳은 없지만, 추후 HTML <form> POST 를 붙일 때를 위해 열어 둔다.
app.use(express.urlencoded({ extended: true }));

/**
 * 서버 부트스트랩 함수.
 *
 * initDb() 가 비동기라서(pg.Pool 의 연결 검증이 Promise 기반)
 * 전체 로직을 async 함수로 감싸고, 하단에서 `.catch(...)` 로 fail-fast 시킨다.
 *
 * DB 초기화 → uploads 디렉터리 보장 → 정적 파일 서빙 → 헬스체크 → 라우트
 * 마운트 → 404 → 에러 핸들러 → listen 순서를 반드시 지킬 것.
 * (에러 핸들러는 라우트 뒤에 붙어야 작동한다. Express 규칙)
 */
async function start() {
  // 1) 데이터베이스를 먼저 초기화한다.
  //    initDb() 는 (backend/src/config/database.js):
  //      - backend/.env 를 로드하고 process.env.DATABASE_URL 을 확인한다.
  //        누락 시 즉시 throw → start().catch 로 fail-fast 종료.
  //      - pg.Pool 을 생성하고 `SELECT 1` 으로 연결을 검증한다.
  //      - 스키마는 Supabase 측에 이미 적용되어 있으므로 여기선 만들지 않는다.
  //    이 단계가 끝나기 전에 아래 라우트들이 요청을 받으면
  //    "Database not initialized" 예외가 터진다.
  await initDb();

  // 2) 업로드된 이미지 파일을 정적으로 서빙할 디렉터리를 준비한다.
  //    multer 가 uploads/ 밑에 파일을 떨어뜨리면, 여기서 /uploads/<filename>
  //    으로 브라우저가 바로 읽을 수 있다. 프런트엔드의 vite dev 서버는
  //    `/uploads` 경로를 백엔드로 프록시 태우도록 설정돼 있다.
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    // recursive: true 로 중간 디렉터리가 없어도 한 번에 만들어 준다.
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // 3) 헬스체크 엔드포인트. 로드밸런서/모니터링 시스템이 서버 생존 여부를
  //    확인하는 용도이고, start.sh 가 서버 기동 완료를 기다릴 때도 쓸 수
  //    있다. DB 상태까지 점검하지는 않는 얕은(liveness) 체크다.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // -------------------------------------------------------------------------
  // 4) API 라우트 마운트
  //    경로 규칙:
  //      /api/auth     → 로그인/회원가입/내 정보 (+ Google 소셜 로그인)
  //      /api/hotels   → 호텔 목록/상세/가용성 조회 (공개)
  //      /api/tickets  → 티켓 목록/상세
  //      /api/packages → 패키지 목록/상세
  //      /api/bookings → 예약 생성/조회/취소 (비회원도 일부 엔드포인트 사용)
  //      /api/admin/** → 전부 관리자 인증 필요. 각 라우터 파일 내부에
  //                       router.use(authenticate, requireAdmin) 로 게이팅.
  // -------------------------------------------------------------------------
  app.use('/api/auth', authRoutes);
  app.use('/api/hotels', hotelRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/showcases', showcaseRoutes);
  app.use('/api/admin/products', adminProductRoutes);
  app.use('/api/admin/bookings', adminBookingRoutes);
  app.use('/api/admin/users', adminUserRoutes);
  app.use('/api/admin/dashboard', adminDashboardRoutes);
  app.use('/api/admin/payments', adminPaymentRoutes);
  app.use('/api/admin/upload', uploadRoutes);
  app.use('/api/admin/promotions', promotionRoutes);
  // Access-code 구매 게이트 관리. 각 엔드포인트는 파일 내부에서
  // authenticate + requireAdmin 미들웨어로 게이팅됨.
  app.use('/api/admin/access-codes', accessCodeRoutes);
  // Showcase 콘텐츠 CRUD — 리조트 소개 콘텐츠 관리.
  app.use('/api/admin/showcases', adminShowcaseRoutes);

  // 5) 프론트엔드/어드민 정적 파일 서빙 (프로덕션 빌드).
  //    빌드된 파일이 존재하면 Express 가 직접 서빙한다. SPA 이므로
  //    존재하지 않는 경로는 index.html 로 fallback 해야 react-router 가
  //    클라이언트 측에서 라우팅을 처리한다.
  const adminDist = path.join(__dirname, '..', '..', 'admin', 'dist');
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

  // /admin/* → admin SPA (어드민 빌드 파일)
  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.get('/admin/*', (req, res) => {
      res.sendFile(path.join(adminDist, 'index.html'));
    });
  }

  // /* → frontend SPA (고객 사이트 빌드 파일) — 반드시 API 라우트 뒤에 위치
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      // /api/* 요청은 여기까지 안 옴 (위에서 이미 매칭됨)
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    // 빌드 파일이 없으면 기존 404 핸들러
    app.use((req, res) => {
      res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
    });
  }

  // 6) 전역 에러 핸들러.
  //    라우트 내부에서 next(err) 로 넘긴 에러, 또는 비동기 핸들러에서
  //    그냥 throw 했을 때 Express 가 여기로 보낸다. 스택은 서버 로그에만
  //    남기고, 클라이언트에는 내부 정보를 흘리지 않도록 일반 메시지만
  //    반환한다. 4-arity(err, req, res, next) 시그니처가 에러 핸들러의
  //    표식이므로 인자 개수를 절대 줄이면 안 된다.
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  // 7) 포트 바인딩. 여기까지 성공하면 start.sh 로그에 "API base URL" 이 찍힌다.
  app.listen(PORT, () => {
    console.log(`High1 Resort Booking API server running on port ${PORT}`);
    console.log(`API base URL: http://localhost:${PORT}/api`);
  });
}

// 부트스트랩 실패(예: 디스크 권한 문제로 data 디렉터리 생성 실패, DB 파일
// 손상 등) 시에는 프로세스를 코드 1 로 종료한다. start.sh 의 trap 핸들러가
// 이 종료 코드를 보고 전체 스택을 내려버리게 된다.
start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// 테스트 러너가 없는 프로젝트지만, 추후 supertest 등으로 통합 테스트를
// 붙일 때를 위해 app 객체를 그대로 export 해 둔다.
module.exports = app;
