// ============================================================================
// Showcases — 리조트 소개 콘텐츠 공개 API
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - GET /         : published 상태의 showcase 목록 조회 (sort_order 오름차순)
//   - GET /:id      : 개별 showcase 상세 조회 (published 만)
//
// 인증 불필요. 프론트엔드 메인 페이지와 상세 페이지에서 호출한다.
// ============================================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');

/**
 * GET / — published showcase 목록.
 *
 * Query params:
 *   - category : 카테고리 필터 (facility/activity/dining/event/nature)
 *
 * 응답: { showcases: [...] }
 * 정렬: sort_order ASC, created_at DESC
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category } = req.query;

    let sql = `SELECT id, title_en, title_cn, summary_en, summary_cn,
               thumbnail_url, category, sort_order, created_at
               FROM showcases WHERE status = 'published'`;
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const showcases = db.prepare(sql).all(...params);
    res.json({ showcases });
  } catch (err) {
    console.error('Error fetching showcases:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 개별 showcase 상세.
 *
 * published 상태만 조회 가능. 없으면 404.
 * images 는 JSON 문자열이므로 파싱해서 배열로 내보낸다.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const showcase = db.prepare(
      `SELECT * FROM showcases WHERE id = ? AND status = 'published'`
    ).get(req.params.id);

    if (!showcase) {
      return res.status(404).json({ error: 'Showcase not found.' });
    }

    // images JSON 파싱
    try {
      showcase.images = JSON.parse(showcase.images || '[]');
    } catch {
      showcase.images = [];
    }

    res.json({ showcase });
  } catch (err) {
    console.error('Error fetching showcase:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
