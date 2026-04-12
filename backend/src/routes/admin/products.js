// ============================================================
// 관리자 - 상품 관리 API (/api/admin/products)
// ------------------------------------------------------------
// 호텔/객실타입/티켓/패키지 CRUD 와 날짜별 재고(인벤토리) 관리.
// 주요 기능:
//   - 상품 기본 정보 CRUD
//   - 재고/가격 개별 수정 (PUT /<kind>-inventory)
//   - 일괄 재고 설정 (POST /<kind>-inventory/bulk)
//     · 날짜 범위 + 요일 필터 + 부분 업데이트 지원
//     · 이미 예약된 수량보다 작게 줄이면 conflict 로 스킵
//     · 모든 날짜 계산은 UTC 기준 (서버 타임존 무관)
// ============================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// 모든 상품 관리 라우트에 관리자 인증 적용
router.use(authenticate, requireAdmin);

// ============================================================
// Inventory helpers (UTC-based date handling)
// ============================================================

// Parse "YYYY-MM-DD" as UTC midnight to avoid server-local timezone drift.
function parseUTCDateStr(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatUTCDateStr(date) {
  return date.toISOString().split('T')[0];
}

// Enumerate "YYYY-MM-DD" strings in [start, end] inclusive (UTC).
// daysOfWeek: undefined/null -> all days; [] -> caller should short-circuit;
// otherwise filter by JavaScript getUTCDay() values (0=Sun ... 6=Sat).
function enumerateDates(startStr, endStr, daysOfWeek) {
  const start = parseUTCDateStr(startStr);
  const end = parseUTCDateStr(endStr);
  if (!start || !end || start > end) return [];
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (!Array.isArray(daysOfWeek) || daysOfWeek.includes(day)) {
      dates.push(formatUTCDateStr(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// Applies a single-date inventory change with partial-update + booked-conflict checks.
// Returns one of: 'updated', 'created', 'conflict', 'skipped'.
function applyInventoryChange(ctx, dateStr, totalValue, priceValue) {
  const existing = ctx.getRow.get(ctx.idValue, dateStr);
  const hasTotal = totalValue !== undefined && totalValue !== null && totalValue !== '';
  const hasPrice = priceValue !== undefined && priceValue !== null && priceValue !== '';
  const total = hasTotal ? Number(totalValue) : null;
  const price = hasPrice ? Number(priceValue) : null;

  if (hasTotal && (!Number.isFinite(total) || total < 0)) return 'skipped';
  if (hasPrice && (!Number.isFinite(price) || price < 0)) return 'skipped';
  if (!hasTotal && !hasPrice) return 'skipped';

  if (existing) {
    if (hasTotal && total < existing[ctx.bookedCol]) {
      return { status: 'conflict', booked: existing[ctx.bookedCol], attempted_total: total };
    }
    if (hasTotal && hasPrice) {
      ctx.updateBoth.run(total, price, ctx.idValue, dateStr);
    } else if (hasTotal) {
      ctx.updateTotal.run(total, ctx.idValue, dateStr);
    } else {
      ctx.updatePrice.run(price, ctx.idValue, dateStr);
    }
    return 'updated';
  }

  // No existing row. Need a total to create a meaningful row.
  if (!hasTotal) return 'skipped';
  ctx.insertRow.run(ctx.idValue, dateStr, total, hasPrice ? price : null);
  return 'created';
}

// Build a reusable statement context for a given inventory table.
function buildInventoryCtx(db, { table, idCol, totalCol, bookedCol, idValue }) {
  return {
    idValue,
    bookedCol,
    getRow: db.prepare(`SELECT * FROM ${table} WHERE ${idCol} = ? AND date = ?`),
    insertRow: db.prepare(`INSERT INTO ${table} (${idCol}, date, ${totalCol}, price) VALUES (?, ?, ?, ?)`),
    updateBoth: db.prepare(`UPDATE ${table} SET ${totalCol} = ?, price = ? WHERE ${idCol} = ? AND date = ?`),
    updateTotal: db.prepare(`UPDATE ${table} SET ${totalCol} = ? WHERE ${idCol} = ? AND date = ?`),
    updatePrice: db.prepare(`UPDATE ${table} SET price = ? WHERE ${idCol} = ? AND date = ?`),
  };
}

// Shared handler factory for POST /{kind}-inventory/bulk
function makeBulkSetHandler({ table, idCol, totalCol, bookedCol, parentTable, parentLabel }) {
  return (req, res) => {
    try {
      const db = getDb();
      const { start_date, end_date, price, days_of_week } = req.body;
      const idValue = req.body[idCol];
      const totalValue = req.body[totalCol];

      if (!idValue || !start_date || !end_date) {
        return res.status(400).json({ error: `${idCol}, start_date, and end_date are required.` });
      }
      if ((totalValue === undefined || totalValue === null || totalValue === '') &&
          (price === undefined || price === null || price === '')) {
        return res.status(400).json({ error: 'At least one of quantity or price must be provided.' });
      }
      if (!parseUTCDateStr(start_date) || !parseUTCDateStr(end_date)) {
        return res.status(400).json({ error: 'Dates must be YYYY-MM-DD.' });
      }
      if (parseUTCDateStr(start_date) > parseUTCDateStr(end_date)) {
        return res.status(400).json({ error: 'start_date must be on or before end_date.' });
      }
      if (Array.isArray(days_of_week) && days_of_week.length === 0) {
        return res.json({
          message: 'No days of week selected. Nothing to update.',
          updated_count: 0, created_count: 0, skipped_count: 0, conflicts: [],
        });
      }

      const parent = db.prepare(`SELECT id FROM ${parentTable} WHERE id = ?`).get(idValue);
      if (!parent) return res.status(404).json({ error: `${parentLabel} not found.` });

      const dates = enumerateDates(start_date, end_date, days_of_week);
      if (dates.length === 0) {
        return res.status(400).json({ error: 'No matching dates in the given range.' });
      }

      const ctx = buildInventoryCtx(db, { table, idCol, totalCol, bookedCol, idValue });
      let updated = 0, created = 0, skipped = 0;
      const conflicts = [];

      const tx = db.transaction(() => {
        for (const dateStr of dates) {
          const result = applyInventoryChange(ctx, dateStr, totalValue, price);
          if (result === 'updated') updated++;
          else if (result === 'created') created++;
          else if (result === 'skipped') skipped++;
          else if (result && result.status === 'conflict') {
            conflicts.push({ date: dateStr, booked: result.booked, attempted_total: result.attempted_total });
            skipped++;
          }
        }
      });
      tx();

      res.json({
        message: `Updated ${updated}, created ${created}, skipped ${skipped} dates.`,
        updated_count: updated,
        created_count: created,
        skipped_count: skipped,
        conflicts,
      });
    } catch (err) {
      console.error(`Bulk ${table} error:`, err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };
}

// Shared handler factory for PUT /{kind}-inventory (per-item partial updates)
function makePerItemUpdateHandler({ table, idCol, totalCol, bookedCol, parentTable, parentLabel }) {
  return (req, res) => {
    try {
      const db = getDb();
      const { items } = req.body;
      const idValue = req.body[idCol];

      if (!idValue || !Array.isArray(items)) {
        return res.status(400).json({ error: `${idCol} and items array are required.` });
      }

      const parent = db.prepare(`SELECT id FROM ${parentTable} WHERE id = ?`).get(idValue);
      if (!parent) return res.status(404).json({ error: `${parentLabel} not found.` });

      const ctx = buildInventoryCtx(db, { table, idCol, totalCol, bookedCol, idValue });
      let updated = 0, created = 0, skipped = 0;
      const conflicts = [];

      const tx = db.transaction(() => {
        for (const entry of items) {
          if (!entry || typeof entry !== 'object' || !parseUTCDateStr(entry.date)) {
            skipped++;
            continue;
          }
          const result = applyInventoryChange(ctx, entry.date, entry.total, entry.price);
          if (result === 'updated') updated++;
          else if (result === 'created') created++;
          else if (result === 'skipped') skipped++;
          else if (result && result.status === 'conflict') {
            conflicts.push({ date: entry.date, booked: result.booked, attempted_total: result.attempted_total });
            skipped++;
          }
        }
      });
      tx();

      res.json({
        message: `Updated ${updated}, created ${created}, skipped ${skipped} entries.`,
        updated_count: updated,
        created_count: created,
        skipped_count: skipped,
        conflicts,
      });
    } catch (err) {
      console.error(`Admin update ${table} error:`, err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };
}

// PUT /featured - quick toggle featured status
router.put('/featured', (req, res) => {
  try {
    const db = getDb();
    const { product_type, product_id, is_featured, sort_order } = req.body;

    if (!product_type || !product_id) {
      return res.status(400).json({ error: 'product_type and product_id are required.' });
    }

    const table = product_type === 'hotel' ? 'hotels' : product_type === 'ticket' ? 'tickets' : 'packages';

    const updates = [];
    const values = [];

    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(product_id);
    db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Featured status updated.' });
  } catch (err) {
    console.error('Update featured error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// HOTELS CRUD
// ============================================================

// GET / - list all hotels
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const hotels = db.prepare('SELECT * FROM hotels ORDER BY id DESC').all();
    const result = hotels.map(h => ({
      ...h,
      amenities: JSON.parse(h.amenities || '[]'),
      images: JSON.parse(h.images || '[]')
    }));
    res.json({ hotels: result });
  } catch (err) {
    console.error('Admin list hotels error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST / - create hotel
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order } = req.body;

    if (!name_en) {
      return res.status(400).json({ error: 'name_en is required.' });
    }

    const result = db.prepare(`
      INSERT INTO hotels (name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      address || null, image_url || null, rating || 0,
      JSON.stringify(amenities || []), JSON.stringify(images || []), status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(result.lastInsertRowid);
    hotel.amenities = JSON.parse(hotel.amenities || '[]');
    hotel.images = JSON.parse(hotel.images || '[]');

    res.status(201).json({ message: 'Hotel created.', hotel });
  } catch (err) {
    console.error('Admin create hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id - update hotel
// Numeric constraint prevents this from shadowing literal sibling routes
// like PUT /room-inventory, PUT /ticket-inventory, PUT /package-inventory.
router.put('/:id(\\d+)', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }
    if (amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(amenities)); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE hotels SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    updated.amenities = JSON.parse(updated.amenities || '[]');
    updated.images = JSON.parse(updated.images || '[]');

    res.json({ message: 'Hotel updated.', hotel: updated });
  } catch (err) {
    console.error('Admin update hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /:id - delete hotel (soft delete by setting status to inactive)
router.delete('/:id(\\d+)', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    db.prepare("UPDATE hotels SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Hotel deleted.' });
  } catch (err) {
    console.error('Admin delete hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// ROOM TYPES CRUD
// ============================================================

// GET /room-types - list all room types
router.get('/room-types', (req, res) => {
  try {
    const db = getDb();
    const { hotel_id } = req.query;

    let query = 'SELECT rt.*, h.name_en as hotel_name FROM room_types rt LEFT JOIN hotels h ON rt.hotel_id = h.id';
    const params = [];

    if (hotel_id) {
      query += ' WHERE rt.hotel_id = ?';
      params.push(hotel_id);
    }

    query += ' ORDER BY rt.id DESC';

    const roomTypes = db.prepare(query).all(...params);
    const result = roomTypes.map(rt => ({
      ...rt,
      amenities: JSON.parse(rt.amenities || '[]'),
      images: JSON.parse(rt.images || '[]')
    }));

    res.json({ room_types: result });
  } catch (err) {
    console.error('Admin list room types error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /room-types - create room type
router.post('/room-types', (req, res) => {
  try {
    const db = getDb();
    const { hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status } = req.body;

    if (!hotel_id || !name_en || base_price === undefined) {
      return res.status(400).json({ error: 'hotel_id, name_en, and base_price are required.' });
    }

    const hotel = db.prepare('SELECT id FROM hotels WHERE id = ?').get(hotel_id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const result = db.prepare(`
      INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hotel_id, name_en, name_cn || null, description_en || null, description_cn || null,
      max_guests || 2, bed_type || null, JSON.stringify(amenities || []),
      image_url || null, JSON.stringify(images || []), base_price, status || 'active'
    );

    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(result.lastInsertRowid);
    roomType.amenities = JSON.parse(roomType.amenities || '[]');
    roomType.images = JSON.parse(roomType.images || '[]');

    res.status(201).json({ message: 'Room type created.', room_type: roomType });
  } catch (err) {
    console.error('Admin create room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /room-types/:id - update room type
router.put('/room-types/:id', (req, res) => {
  try {
    const db = getDb();
    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    const { hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status } = req.body;

    const updates = [];
    const values = [];

    if (hotel_id !== undefined) { updates.push('hotel_id = ?'); values.push(hotel_id); }
    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (max_guests !== undefined) { updates.push('max_guests = ?'); values.push(max_guests); }
    if (bed_type !== undefined) { updates.push('bed_type = ?'); values.push(bed_type); }
    if (amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(amenities)); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    updated.amenities = JSON.parse(updated.amenities || '[]');
    updated.images = JSON.parse(updated.images || '[]');

    res.json({ message: 'Room type updated.', room_type: updated });
  } catch (err) {
    console.error('Admin update room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /room-types/:id - delete room type
router.delete('/room-types/:id', (req, res) => {
  try {
    const db = getDb();
    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    db.prepare("UPDATE room_types SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Room type deleted.' });
  } catch (err) {
    console.error('Admin delete room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// TICKETS CRUD
// ============================================================

// GET /tickets - list all tickets
router.get('/tickets', (req, res) => {
  try {
    const db = getDb();
    const tickets = db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
    res.json({ tickets });
  } catch (err) {
    console.error('Admin list tickets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /tickets - create ticket
router.post('/tickets', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order } = req.body;

    if (!name_en || base_price === undefined) {
      return res.status(400).json({ error: 'name_en and base_price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      category || null, image_url || null, JSON.stringify(images || []), base_price,
      duration || null, location || null, status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);
    ticket.images = JSON.parse(ticket.images || '[]');
    res.status(201).json({ message: 'Ticket created.', ticket });
  } catch (err) {
    console.error('Admin create ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /tickets/:id - update ticket
router.put('/tickets/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    updated.images = JSON.parse(updated.images || '[]');
    res.json({ message: 'Ticket updated.', ticket: updated });
  } catch (err) {
    console.error('Admin update ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /tickets/:id - delete ticket
router.delete('/tickets/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    db.prepare("UPDATE tickets SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Ticket deleted.' });
  } catch (err) {
    console.error('Admin delete ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// PACKAGES CRUD
// ============================================================

// GET /packages - list all packages
router.get('/packages', (req, res) => {
  try {
    const db = getDb();
    const packages = db.prepare('SELECT * FROM packages ORDER BY id DESC').all();
    const result = packages.map(p => ({
      ...p,
      includes: JSON.parse(p.includes || '[]'),
      images: JSON.parse(p.images || '[]')
    }));
    res.json({ packages: result });
  } catch (err) {
    console.error('Admin list packages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /packages - create package
router.post('/packages', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, items, is_featured, sort_order } = req.body;

    if (!name_en || base_price === undefined) {
      return res.status(400).json({ error: 'name_en and base_price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO packages (name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      image_url || null, JSON.stringify(images || []), base_price, JSON.stringify(includes || []),
      duration || null, status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const packageId = result.lastInsertRowid;

    // Insert package items if provided
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(packageId, item.item_type, item.item_id, item.quantity || 1);
      }
    }

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
    pkg.includes = JSON.parse(pkg.includes || '[]');
    pkg.images = JSON.parse(pkg.images || '[]');
    const packageItems = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(packageId);

    res.status(201).json({ message: 'Package created.', package: pkg, items: packageItems });
  } catch (err) {
    console.error('Admin create package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /packages/:id - update package
router.put('/packages/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, items, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (includes !== undefined) { updates.push('includes = ?'); values.push(JSON.stringify(includes)); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE packages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Update package items if provided
    if (items && Array.isArray(items)) {
      db.prepare('DELETE FROM package_items WHERE package_id = ?').run(req.params.id);
      const insertItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(req.params.id, item.item_type, item.item_id, item.quantity || 1);
      }
    }

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    updated.includes = JSON.parse(updated.includes || '[]');
    updated.images = JSON.parse(updated.images || '[]');
    const packageItems = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(req.params.id);

    res.json({ message: 'Package updated.', package: updated, items: packageItems });
  } catch (err) {
    console.error('Admin update package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /packages/:id - delete package
router.delete('/packages/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    db.prepare("UPDATE packages SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Package deleted.' });
  } catch (err) {
    console.error('Admin delete package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// INVENTORY MANAGEMENT
// ============================================================

// GET /room-inventory/:room_type_id - get room inventory
router.get('/room-inventory/:room_type_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM room_inventory WHERE room_type_id = ?';
    const params = [req.params.room_type_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /ticket-inventory/:ticket_id - get ticket inventory
router.get('/ticket-inventory/:ticket_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM ticket_inventory WHERE ticket_id = ?';
    const params = [req.params.ticket_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /package-inventory/:package_id - get package inventory
router.get('/package-inventory/:package_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM package_inventory WHERE package_id = ?';
    const params = [req.params.package_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /room-inventory - per-date partial updates for room inventory
router.put('/room-inventory', makePerItemUpdateHandler({
  table: 'room_inventory',
  idCol: 'room_type_id',
  totalCol: 'total_rooms',
  bookedCol: 'booked_rooms',
  parentTable: 'room_types',
  parentLabel: 'Room type',
}));

// PUT /ticket-inventory - per-date partial updates for ticket inventory
router.put('/ticket-inventory', makePerItemUpdateHandler({
  table: 'ticket_inventory',
  idCol: 'ticket_id',
  totalCol: 'total_quantity',
  bookedCol: 'booked_quantity',
  parentTable: 'tickets',
  parentLabel: 'Ticket',
}));

// PUT /package-inventory - per-date partial updates for package inventory
router.put('/package-inventory', makePerItemUpdateHandler({
  table: 'package_inventory',
  idCol: 'package_id',
  totalCol: 'total_quantity',
  bookedCol: 'booked_quantity',
  parentTable: 'packages',
  parentLabel: 'Package',
}));

// POST /room-inventory/bulk - bulk set room inventory by date range
router.post('/room-inventory/bulk', makeBulkSetHandler({
  table: 'room_inventory',
  idCol: 'room_type_id',
  totalCol: 'total_rooms',
  bookedCol: 'booked_rooms',
  parentTable: 'room_types',
  parentLabel: 'Room type',
}));

// POST /ticket-inventory/bulk - bulk set ticket inventory by date range
router.post('/ticket-inventory/bulk', makeBulkSetHandler({
  table: 'ticket_inventory',
  idCol: 'ticket_id',
  totalCol: 'total_quantity',
  bookedCol: 'booked_quantity',
  parentTable: 'tickets',
  parentLabel: 'Ticket',
}));

// POST /package-inventory/bulk - bulk set package inventory by date range
router.post('/package-inventory/bulk', makeBulkSetHandler({
  table: 'package_inventory',
  idCol: 'package_id',
  totalCol: 'total_quantity',
  bookedCol: 'booked_quantity',
  parentTable: 'packages',
  parentLabel: 'Package',
}));

module.exports = router;
