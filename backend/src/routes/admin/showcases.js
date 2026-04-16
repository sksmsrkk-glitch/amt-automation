// ============================================================================
// Admin — Showcase 콘텐츠 CRUD API
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - GET    /            : 모든 showcase 목록 (draft 포함)
//   - GET    /:id         : 개별 showcase 상세
//   - POST   /            : 새 showcase 생성
//   - PUT    /:id         : showcase 수정
//   - DELETE /:id         : showcase 삭제
//   - PUT    /reorder     : 노출 순서 일괄 변경
//
// 모든 엔드포인트는 authenticate + requireAdmin 미들웨어로 게이팅.
// ============================================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

// 모든 라우트에 관리자 인증 적용
router.use(authenticate, requireAdmin);

/**
 * GET / — 모든 showcase 목록 (draft 포함).
 *
 * Query params:
 *   - status   : 'published' | 'draft' 필터
 *   - category : 카테고리 필터
 *
 * 정렬: sort_order ASC, created_at DESC
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, category } = req.query;

    let sql = 'SELECT * FROM showcases WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const showcases = db.prepare(sql).all(...params);

    // images JSON 파싱
    for (const s of showcases) {
      try { s.images = JSON.parse(s.images || '[]'); } catch { s.images = []; }
    }

    res.json({ showcases });
  } catch (err) {
    console.error('Error listing showcases:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 개별 showcase 상세 (draft 포함).
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const showcase = db.prepare('SELECT * FROM showcases WHERE id = ?').get(req.params.id);

    if (!showcase) {
      return res.status(404).json({ error: 'Showcase not found.' });
    }

    try { showcase.images = JSON.parse(showcase.images || '[]'); } catch { showcase.images = []; }

    res.json({ showcase });
  } catch (err) {
    console.error('Error fetching showcase:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST / — 새 showcase 생성.
 *
 * Required body:
 *   - title_en : 영문 제목
 *
 * Optional body:
 *   - title_cn, summary_en, summary_cn, content_en, content_cn
 *   - thumbnail_url, images (배열), youtube_url
 *   - category, sort_order, status
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      title_en, title_cn, summary_en, summary_cn,
      content_en, content_cn, thumbnail_url, images,
      youtube_url, category, sort_order, status,
    } = req.body;

    if (!title_en) {
      return res.status(400).json({ error: 'title_en is required.' });
    }

    const imagesJson = JSON.stringify(images || []);

    const result = db.prepare(`
      INSERT INTO showcases (
        title_en, title_cn, summary_en, summary_cn,
        content_en, content_cn, thumbnail_url, images,
        youtube_url, category, sort_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title_en,
      title_cn || null,
      summary_en || null,
      summary_cn || null,
      content_en || null,
      content_cn || null,
      thumbnail_url || null,
      imagesJson,
      youtube_url || null,
      category || 'facility',
      sort_order ?? 0,
      status || 'draft',
    );

    const created = db.prepare('SELECT * FROM showcases WHERE id = ?').get(result.lastInsertRowid);
    try { created.images = JSON.parse(created.images || '[]'); } catch { created.images = []; }

    res.status(201).json({ showcase: created });
  } catch (err) {
    console.error('Error creating showcase:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /reorder — 노출 순서 일괄 변경.
 * /:id 보다 먼저 등록해야 'reorder' 가 :id 로 해석되지 않는다.
 *
 * Body: { orders: [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }, ...] }
 */
router.put('/reorder', (req, res) => {
  try {
    const db = getDb();
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders array is required.' });
    }

    const updateOrder = db.transaction((items) => {
      for (const item of items) {
        db.prepare('UPDATE showcases SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(item.sort_order, item.id);
      }
    });

    updateOrder(orders);

    const showcases = db.prepare('SELECT * FROM showcases ORDER BY sort_order ASC, created_at DESC').all();
    for (const s of showcases) {
      try { s.images = JSON.parse(s.images || '[]'); } catch { s.images = []; }
    }

    res.json({ showcases });
  } catch (err) {
    console.error('Error reordering showcases:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id — showcase 수정.
 *
 * Body 에 포함된 필드만 업데이트한다 (partial update).
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM showcases WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Showcase not found.' });
    }

    const {
      title_en, title_cn, summary_en, summary_cn,
      content_en, content_cn, thumbnail_url, images,
      youtube_url, category, sort_order, status,
    } = req.body;

    const imagesJson = images !== undefined ? JSON.stringify(images) : existing.images;

    db.prepare(`
      UPDATE showcases SET
        title_en = ?, title_cn = ?, summary_en = ?, summary_cn = ?,
        content_en = ?, content_cn = ?, thumbnail_url = ?, images = ?,
        youtube_url = ?, category = ?, sort_order = ?, status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title_en ?? existing.title_en,
      title_cn !== undefined ? title_cn : existing.title_cn,
      summary_en !== undefined ? summary_en : existing.summary_en,
      summary_cn !== undefined ? summary_cn : existing.summary_cn,
      content_en !== undefined ? content_en : existing.content_en,
      content_cn !== undefined ? content_cn : existing.content_cn,
      thumbnail_url !== undefined ? thumbnail_url : existing.thumbnail_url,
      imagesJson,
      youtube_url !== undefined ? youtube_url : existing.youtube_url,
      category ?? existing.category,
      sort_order ?? existing.sort_order,
      status ?? existing.status,
      req.params.id,
    );

    const updated = db.prepare('SELECT * FROM showcases WHERE id = ?').get(req.params.id);
    try { updated.images = JSON.parse(updated.images || '[]'); } catch { updated.images = []; }

    res.json({ showcase: updated });
  } catch (err) {
    console.error('Error updating showcase:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /:id — showcase 삭제 (hard delete).
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM showcases WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Showcase not found.' });
    }

    db.prepare('DELETE FROM showcases WHERE id = ?').run(req.params.id);
    res.json({ message: 'Showcase deleted successfully.' });
  } catch (err) {
    console.error('Error deleting showcase:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
