// ============================================================================
// /api/admin/dashboard — 관리자 메인 대시보드 통계
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET /overview        — 전체 집계 수치(예약/수익/사용자/상품)
//   GET /recent-bookings — 최근 예약 10건 (사용자 이름/이메일 join)
//   GET /revenue-chart   — 최근 30일 일별 매출 (빈 날짜는 0 으로 채움)
//   GET /booking-chart   — 최근 30일 일별 예약 수 (hotel/ticket/package 분리)
//
// 차트 엔드포인트는 누락된 날짜를 0 으로 채워 프런트엔드가 x 축을
// 재구성할 필요가 없게 만든다. 모든 수익 집계는 `status != 'cancelled'`
// 조건을 쓰는데, 취소된 예약을 매출로 계산하지 않기 위함이다.
// ============================================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// 관리자 인증 필수.
router.use(authenticate, requireAdmin);

/**
 * GET /overview — 대시보드 메인 카드에 쓸 전체 통계.
 *
 * 응답:
 *   {
 *     total_bookings, total_revenue, total_users,
 *     products: { hotels, tickets, packages },
 *     booking_status: { pending, confirmed, cancelled },
 *     today: { bookings, revenue }
 *   }
 *
 * total_revenue 는 `status != 'cancelled' AND payment_status = 'paid'`
 * 로 좁혀서 "실제 들어온 돈" 만 계산한다.
 */
router.get('/overview', async (req, res) => {
  try {
    const db = getDb();

    // ⚠ 괄호 위치 주의: `await X.get().count` 로 쓰면 연산자 우선순위상
    // `await (promise.count)` 가 되어 promise.count 는 undefined → 모든 집계가
    // undefined 로 내려갔다. 반드시 await 를 먼저 풀어 row 객체를 얻은 다음
    // .count / .total 에 접근해야 한다.
    const totalBookings = (await db.prepare('SELECT COUNT(*) as count FROM bookings').get()).count;
    const totalRevenue = (await db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE status != 'cancelled' AND payment_status = 'paid'").get()).total;
    const totalUsers = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get()).count;

    const totalHotels = (await db.prepare("SELECT COUNT(*) as count FROM hotels WHERE status = 'active'").get()).count;
    const totalTickets = (await db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'active'").get()).count;
    const totalPackages = (await db.prepare("SELECT COUNT(*) as count FROM packages WHERE status = 'active'").get()).count;

    const pendingBookings = (await db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").get()).count;
    const confirmedBookings = (await db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'").get()).count;
    const cancelledBookings = (await db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'cancelled'").get()).count;

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = (await db.prepare("SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = ?").get(today)).count;
    const todayRevenue = (await db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE DATE(created_at) = ? AND status != 'cancelled'").get(today)).total;

    res.json({
      total_bookings: Number(totalBookings) || 0,
      total_revenue: Number(totalRevenue) || 0,
      total_users: Number(totalUsers) || 0,
      products: {
        hotels: Number(totalHotels) || 0,
        tickets: Number(totalTickets) || 0,
        packages: Number(totalPackages) || 0,
      },
      booking_status: {
        pending: Number(pendingBookings) || 0,
        confirmed: Number(confirmedBookings) || 0,
        cancelled: Number(cancelledBookings) || 0,
      },
      today: {
        bookings: Number(todayBookings) || 0,
        revenue: Number(todayRevenue) || 0,
      },
    });
  } catch (err) {
    console.error('Admin dashboard overview error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /recent-bookings — 가장 최근 생성된 예약 10건.
 * 로그인 사용자 이름/이메일을 LEFT JOIN 으로 함께 가져와 UI 테이블에
 * 바로 렌더링할 수 있게 한다 (게스트 예약은 user_name/user_email 이 null).
 */
router.get('/recent-bookings', async (req, res) => {
  try {
    const db = getDb();

    const bookings = await db.prepare(`
      SELECT b.*, u.name as user_name, u.email as user_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `).all();

    res.json({ bookings });
  } catch (err) {
    console.error('Admin recent bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /revenue-chart — 최근 30일 일별 매출 시계열.
 *
 * 응답: { data: [{ date, revenue, booking_count }, ...] }
 *
 * SQL 로 그룹바이한 결과는 예약이 없는 날짜가 빠져 있으므로, 아래 루프
 * 에서 빈 날짜를 0 으로 채워 30개 (또는 그 이상) row 를 반환한다.
 * 이렇게 해야 프런트 차트 라이브러리가 x 축을 끊김 없이 그릴 수 있다.
 */
router.get('/revenue-chart', async (req, res) => {
  try {
    const db = getDb();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const revenueData = await db.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total_price), 0) as revenue, COUNT(*) as booking_count
      FROM bookings
      WHERE DATE(created_at) >= ? AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startDate);

    // 예약 없는 날짜를 0 매출로 채운다. cursor 루프를 사용해 SQL 결과
    // 에 빠져 있는 날짜를 감지.
    const result = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = revenueData.find(d => d.date === dateStr);

      result.push({
        date: dateStr,
        // PostgreSQL 의 COUNT/SUM 은 BIGINT 로 pg 드라이버가 문자열로 돌려줄 수
        // 있다. recharts 가 수치로 인식하도록 Number 로 정규화. null/undefined 는
        // 0 폴백.
        revenue: existing ? (Number(existing.revenue) || 0) : 0,
        booking_count: existing ? (Number(existing.booking_count) || 0) : 0,
      });

      current.setDate(current.getDate() + 1);
    }

    res.json({ data: result });
  } catch (err) {
    console.error('Admin revenue chart error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /booking-chart — 최근 30일 일별 예약 수 (상품 타입별로 쪼갬).
 *
 * 응답: { data: [{ date, count, hotel_count, ticket_count, package_count }] }
 *
 * CASE WHEN 으로 한 번의 쿼리에서 각 타입의 개수를 집계. 빈 날짜는
 * 위의 revenue-chart 와 같은 방식으로 0 으로 채운다.
 */
router.get('/booking-chart', async (req, res) => {
  try {
    const db = getDb();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const bookingData = await db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count,
        COUNT(CASE WHEN product_type = 'hotel' THEN 1 END) as hotel_count,
        COUNT(CASE WHEN product_type = 'ticket' THEN 1 END) as ticket_count,
        COUNT(CASE WHEN product_type = 'package' THEN 1 END) as package_count
      FROM bookings
      WHERE DATE(created_at) >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startDate);

    // Fill in missing dates
    const result = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = bookingData.find(d => d.date === dateStr);

      result.push({
        date: dateStr,
        // BIGINT 문자열 → 수치 정규화 (revenue-chart 와 동일 이유).
        count: existing ? (Number(existing.count) || 0) : 0,
        hotel_count: existing ? (Number(existing.hotel_count) || 0) : 0,
        ticket_count: existing ? (Number(existing.ticket_count) || 0) : 0,
        package_count: existing ? (Number(existing.package_count) || 0) : 0,
      });

      current.setDate(current.getDate() + 1);
    }

    res.json({ data: result });
  } catch (err) {
    console.error('Admin booking chart error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
