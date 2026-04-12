// ============================================================
// 관리자 - 결제 관리 API (/api/admin/payments)
// ------------------------------------------------------------
// 결제 목록/상세/상태 변경 및 통계 조회.
// 실제 결제 게이트웨이(Stripe) 연동 전까지는 관리자가 수동으로
// 'paid'/'refunded' 상태를 변경할 수 있도록 한다.
// ============================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// 결제 라우트 전체에 관리자 인증 적용
router.use(authenticate, requireAdmin);

// GET /stats - 결제 통계 (총 결제 건수/금액, 상태별/수단별 집계, 당일 매출)
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalPayments = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
    const totalAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid'").get().total;
    const totalRefunds = db.prepare("SELECT COALESCE(SUM(refund_amount), 0) as total FROM payments WHERE refund_amount > 0").get().total;
    const pendingPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get().count;

    const statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
      FROM payments
      GROUP BY status
    `).all();

    const methodBreakdown = db.prepare(`
      SELECT method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
      FROM payments
      GROUP BY method
    `).all();

    const today = new Date().toISOString().split('T')[0];
    const todayPayments = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = ? AND status = 'paid'").get(today);

    res.json({
      total_payments: totalPayments,
      total_amount: totalAmount,
      total_refunds: totalRefunds,
      pending_payments: pendingPayments,
      status_breakdown: statusBreakdown,
      method_breakdown: methodBreakdown,
      today: {
        count: todayPayments.count,
        total: todayPayments.total
      }
    });
  } catch (err) {
    console.error('Admin payment stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET / - 결제 목록 (상태/수단/기간 필터 + 페이지네이션)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, method, from_date, to_date, page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (method) {
      whereClause += ' AND p.method = ?';
      params.push(method);
    }
    if (from_date) {
      whereClause += ' AND DATE(p.created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ' AND DATE(p.created_at) <= ?';
      params.push(to_date);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM payments p ${whereClause}`).get(...params).count;

    const payments = db.prepare(`
      SELECT p.*, b.booking_number, b.guest_name, b.guest_email, b.product_type
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list payments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id - 결제 상세 (연결된 예약 정보 포함)
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const payment = db.prepare(`
      SELECT p.*, b.booking_number, b.guest_name, b.guest_email, b.guest_phone,
             b.product_type, b.product_id, b.total_price, b.status as booking_status
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    res.json({ payment });
  } catch (err) {
    console.error('Admin get payment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id/status - 결제 상태 변경 (+ 연결된 예약의 payment_status 동기화)
// 결제가 'paid' 로 전환되면 예약 상태도 'confirmed' 로 자동 변경된다.
router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status, stripe_payment_id } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const updates = ['status = ?'];
    const values = [status];

    if (stripe_payment_id) {
      updates.push('stripe_payment_id = ?');
      values.push(stripe_payment_id);
    }

    values.push(req.params.id);
    db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Sync booking payment_status
    db.prepare("UPDATE bookings SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, payment.booking_id);

    // If payment is confirmed as paid, set booking to confirmed
    if (status === 'paid') {
      db.prepare("UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(payment.booking_id);
    }

    const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    res.json({ message: 'Payment status updated.', payment: updated });
  } catch (err) {
    console.error('Admin update payment status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
