// ============================================================
// 백엔드 Express 서버 진입점
// ------------------------------------------------------------
// - SQLite(sql.js) 기반 데이터베이스 초기화
// - /uploads 정적 파일 서빙 (관리자 업로드 이미지)
// - 공개 API(/api/hotels, /api/tickets, /api/packages, /api/bookings)와
//   관리자 API(/api/admin/*) 라우트 마운트
// - 404 / 500 공통 에러 핸들러 등록
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, initDb } = require('./config/database');

// 공개(고객용) 라우트
const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotels');
const ticketRoutes = require('./routes/tickets');
const packageRoutes = require('./routes/packages');
const bookingRoutes = require('./routes/bookings');
// 관리자 전용 라우트 (인증 + 역할 체크 미들웨어 내부에서 적용)
const adminProductRoutes = require('./routes/admin/products');
const adminBookingRoutes = require('./routes/admin/bookings');
const adminUserRoutes = require('./routes/admin/users');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminPaymentRoutes = require('./routes/admin/payments');
const uploadRoutes = require('./routes/admin/upload');
const promotionRoutes = require('./routes/admin/promotions');

const app = express();
const PORT = process.env.PORT || 4000;

// 공통 미들웨어 설정 (CORS 전체 허용 - 운영 시에는 제한 필요)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

async function start() {
  // 라우트 마운트 전에 DB 초기화(테이블 생성 등)
  await initDb();

  // 업로드된 이미지를 /uploads 경로로 정적 제공
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // 헬스 체크 엔드포인트 (로드밸런서/모니터링용)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 라우트 등록
  app.use('/api/auth', authRoutes);
  app.use('/api/hotels', hotelRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin/products', adminProductRoutes);
  app.use('/api/admin/bookings', adminBookingRoutes);
  app.use('/api/admin/users', adminUserRoutes);
  app.use('/api/admin/dashboard', adminDashboardRoutes);
  app.use('/api/admin/payments', adminPaymentRoutes);
  app.use('/api/admin/upload', uploadRoutes);
  app.use('/api/admin/promotions', promotionRoutes);

  // 매칭되는 라우트가 없을 때의 기본 응답
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
  });

  // 최상위 에러 핸들러 - 라우트 내부에서 throw 된 예외를 캐치한다.
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  app.listen(PORT, () => {
    console.log(`High1 Resort Booking API server running on port ${PORT}`);
    console.log(`API base URL: http://localhost:${PORT}/api`);
  });
}

// 서버 부팅. 실패 시 프로세스 종료.
start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
