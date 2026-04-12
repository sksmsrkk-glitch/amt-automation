// ============================================================
// 인증 미들웨어
// ------------------------------------------------------------
// JWT 토큰 검증 및 역할(role) 기반 접근 제어를 담당한다.
// - authenticate: Bearer 토큰을 검증하고 req.user 를 채운다.
// - requireAdmin: 관리자 권한이 필요한 라우트 보호용.
// - JWT_SECRET: 환경변수 JWT_SECRET 이 없으면 기본값 사용.
// ============================================================

const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

// JWT 서명 키. 운영 환경에서는 반드시 환경변수로 주입해야 한다.
const JWT_SECRET = process.env.JWT_SECRET || 'high1-resort-secret-key-2026';

// 요청의 Authorization 헤더를 검사해 JWT를 검증하고
// DB에서 사용자 정보를 조회해 req.user 에 담아준다.
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 토큰 서명 및 만료 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    // 토큰의 userId 로 실제 사용자를 조회 (탈퇴/삭제 사용자 차단)
    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at FROM users WHERE id = ?').get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found. Token may be invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    // 만료된 토큰은 별도 메시지로 처리하여 프론트에서 재로그인을 유도한다.
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

// 관리자 전용 라우트에 붙여 사용. authenticate 다음에 체이닝해야 한다.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET };
