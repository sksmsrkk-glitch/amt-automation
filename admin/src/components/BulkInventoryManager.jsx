// ============================================================
// BulkInventoryManager - 날짜별 재고/가격 관리 패널
// ------------------------------------------------------------
// 섹션 A: 기간 + 요일 필터로 일괄 재고/가격 설정
// 섹션 B: 일별 재고 캘린더 뷰, 행 단위 인라인 편집
// 백엔드와의 계약:
//   - 모든 날짜 계산은 UTC 기준
//   - days_of_week 은 JS getDay() 인덱스(0=일요일) 기준으로 전송
//   - 수량만/가격만 같은 부분 업데이트 지원
//   - 이미 예약된 수량 이하로 줄이면 conflict 로 스킵됨
// props: { productType: 'room' | 'ticket' | 'package', productId, onSave }
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put } from '../utils/api'

// Display order is Mon..Sun, but we store/send JavaScript getUTCDay() indices
// (0=Sun, 1=Mon, ..., 6=Sat) so the backend filter matches JS's native values.
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KR = ['월', '화', '수', '목', '금', '토', '일']
const DAY_JS_INDEX = [1, 2, 3, 4, 5, 6, 0] // display index -> JS getDay index
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

// Parse "YYYY-MM-DD" as UTC midnight to avoid local-timezone off-by-one.
function parseDateStr(str) {
  if (typeof str !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str)
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
}

function formatDate(input) {
  // Accepts either a "YYYY-MM-DD" string (passes through) or a Date object.
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
  }
  const dt = input instanceof Date ? input : new Date(input)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, days) {
  const d = parseDateStr(dateStr) || new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return formatDate(d)
}

function todayStr() {
  const now = new Date()
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '18px 24px',
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
  },
  section: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  sectionLast: {
    padding: '20px 24px',
  },
  row: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: '0.875rem',
    outline: 'none',
    minWidth: 120,
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  daysRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayCheck: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    userSelect: 'none',
    transition: 'all 0.15s',
  },
  dayChecked: {
    background: '#eff6ff',
    borderColor: '#3b82f6',
    color: '#3b82f6',
  },
  dayUnchecked: {
    background: '#fff',
    borderColor: '#e2e8f0',
    color: '#64748b',
  },
  btnApply: {
    padding: '10px 28px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    background: '#3b82f6',
    color: '#fff',
    transition: 'opacity 0.15s',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
  },
  btnSecondary: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
  },
  btnSmPrimary: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  btnSmSecondary: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    background: '#f1f5f9',
    color: '#475569',
    borderRadius: 4,
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  success: {
    padding: '10px 14px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    color: '#166534',
    fontSize: '0.85rem',
    marginTop: 12,
    fontWeight: 500,
  },
  error: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#991b1b',
    fontSize: '0.85rem',
    marginTop: 12,
    fontWeight: 500,
  },
  tableWrap: {
    overflowX: 'auto',
    maxHeight: 480,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: 700,
    color: '#475569',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
    position: 'sticky',
    top: 0,
    background: '#fff',
    zIndex: 1,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #f1f5f9',
    whiteSpace: 'nowrap',
  },
  editInput: {
    padding: '4px 8px',
    border: '1px solid #3b82f6',
    borderRadius: 4,
    fontSize: '0.85rem',
    width: 90,
    outline: 'none',
    fontFamily: 'inherit',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
}

function getRowStyle(booked, total) {
  if (total <= 0) return { background: '#f8fafc', color: '#94a3b8' } // gray - no inventory
  const ratio = booked / total
  if (ratio >= 1) return { background: '#fef2f2' } // red - fully booked
  if (ratio >= 0.7) return { background: '#fffbeb' } // yellow - >70%
  return { background: '#f0fdf4' } // green - available
}

function getStatusInfo(booked, total) {
  if (total <= 0) return { label: 'No Stock', bg: '#f1f5f9', color: '#64748b' }
  const ratio = booked / total
  if (ratio >= 1) return { label: 'Sold Out', bg: '#fef2f2', color: '#ef4444' }
  if (ratio >= 0.7) return { label: 'Filling', bg: '#fffbeb', color: '#f59e0b' }
  return { label: 'Available', bg: '#dcfce7', color: '#22c55e' }
}

export default function BulkInventoryManager({ productType, productId, onSave }) {
  const typeLabel = productType === 'room' ? 'Rooms' : 'Quantity'
  const idField = productType === 'room' ? 'room_type_id' : productType === 'ticket' ? 'ticket_id' : 'package_id'

  // Bulk set state. daysOfWeek stores JS getDay() indices (0=Sun..6=Sat).
  const [bulkStart, setBulkStart] = useState(todayStr())
  const [bulkEnd, setBulkEnd] = useState(addDays(todayStr(), 30))
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkQuantity, setBulkQuantity] = useState('')
  const [daysOfWeek, setDaysOfWeek] = useState(ALL_DAYS)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState(null)

  // Inventory table state
  const [viewStart, setViewStart] = useState(todayStr())
  const [viewEnd, setViewEnd] = useState(addDays(todayStr(), 60))
  const [inventory, setInventory] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editValues, setEditValues] = useState({ price: '', quantity: '' })

  const loadInventory = useCallback(async () => {
    if (!productId) return
    setTableLoading(true)
    try {
      const endpoint = `/admin/products/${productType}-inventory/${productId}?from_date=${viewStart}&to_date=${viewEnd}`
      const res = await get(endpoint)
      setInventory(Array.isArray(res?.inventory) ? res.inventory : [])
    } catch {
      setInventory([])
    } finally {
      setTableLoading(false)
    }
  }, [productType, productId, viewStart, viewEnd])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  // dayIndex here is the display index (0=Mon..6=Sun). Translate to JS getDay().
  const toggleDay = (displayIndex) => {
    const jsIndex = DAY_JS_INDEX[displayIndex]
    if (daysOfWeek.includes(jsIndex)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== jsIndex))
    } else {
      setDaysOfWeek([...daysOfWeek, jsIndex].sort((a, b) => a - b))
    }
  }

  const applyBulk = async () => {
    if (!bulkStart || !bulkEnd) {
      alert('Please select start and end dates.')
      return
    }
    if (bulkStart > bulkEnd) {
      alert('Start date must be on or before end date.')
      return
    }
    const hasPrice = bulkPrice !== '' && !Number.isNaN(Number(bulkPrice))
    const hasQty = bulkQuantity !== '' && !Number.isNaN(Number(bulkQuantity))
    if (!hasPrice && !hasQty) {
      alert('Please enter at least a price or quantity.')
      return
    }
    if (hasPrice && Number(bulkPrice) < 0) {
      alert('Price must be zero or positive.')
      return
    }
    if (hasQty && Number(bulkQuantity) < 0) {
      alert('Quantity must be zero or positive.')
      return
    }
    if (daysOfWeek.length === 0) {
      alert('Please select at least one day of the week.')
      return
    }
    setBulkLoading(true)
    setBulkMessage(null)
    try {
      const body = {
        [idField]: productId,
        start_date: bulkStart,
        end_date: bulkEnd,
        days_of_week: daysOfWeek,
      }
      if (hasPrice) body.price = Number(bulkPrice)
      if (hasQty) {
        body[productType === 'room' ? 'total_rooms' : 'total_quantity'] = Number(bulkQuantity)
      }

      const res = await post(`/admin/products/${productType}-inventory/bulk`, body)
      const updated = res.updated_count ?? 0
      const created = res.created_count ?? 0
      const skipped = res.skipped_count ?? 0
      const conflicts = Array.isArray(res.conflicts) ? res.conflicts : []
      const parts = []
      if (updated) parts.push(`${updated} updated`)
      if (created) parts.push(`${created} created`)
      if (skipped) parts.push(`${skipped} skipped`)
      const summary = parts.length ? parts.join(', ') : 'no changes'
      let text = `Success: ${summary}.`
      if (conflicts.length > 0) {
        const preview = conflicts.slice(0, 3).map(c => `${c.date} (booked ${c.booked} > ${c.attempted_total})`).join(', ')
        const more = conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ''
        text += ` Skipped due to existing bookings: ${preview}${more}.`
      }
      setBulkMessage({ type: conflicts.length > 0 ? 'error' : 'success', text })
      loadInventory()
      if (onSave) onSave()
    } catch (err) {
      setBulkMessage({ type: 'error', text: 'Failed: ' + err.message })
    } finally {
      setBulkLoading(false)
    }
  }

  const startEdit = (inv, index) => {
    setEditingRow(index)
    setEditValues({
      price: inv.price ?? '',
      quantity: inv.total_rooms ?? inv.total_quantity ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditValues({ price: '', quantity: '' })
  }

  const saveEdit = async (inv) => {
    const hasPrice = editValues.price !== '' && !Number.isNaN(Number(editValues.price))
    const hasQty = editValues.quantity !== '' && !Number.isNaN(Number(editValues.quantity))
    if (!hasPrice && !hasQty) {
      cancelEdit()
      return
    }
    if (hasPrice && Number(editValues.price) < 0) {
      alert('Price must be zero or positive.')
      return
    }
    if (hasQty && Number(editValues.quantity) < 0) {
      alert('Quantity must be zero or positive.')
      return
    }
    try {
      const item = { date: formatDate(inv.date) }
      if (hasQty) item.total = Number(editValues.quantity)
      if (hasPrice) item.price = Number(editValues.price)

      const body = {
        [idField]: productId,
        items: [item],
      }
      const res = await put(`/admin/products/${productType}-inventory`, body)

      const conflicts = Array.isArray(res?.conflicts) ? res.conflicts : []
      if (conflicts.length > 0) {
        const c = conflicts[0]
        alert(`Cannot reduce quantity below booked count (${c.booked}) on ${c.date}.`)
        return
      }

      setEditingRow(null)
      loadInventory()
      if (onSave) onSave()
    } catch (err) {
      alert('Save failed: ' + err.message)
    }
  }

  const handleEditKeyDown = (e, inv) => {
    if (e.key === 'Enter') saveEdit(inv)
    if (e.key === 'Escape') cancelEdit()
  }

  const getDayIndex = (dateStr) => {
    const d = parseDateStr(formatDate(dateStr))
    if (!d) return 0
    const jsDay = d.getUTCDay() // 0=Sun..6=Sat
    return jsDay === 0 ? 6 : jsDay - 1 // convert to display order (Mon..Sun)
  }

  const getDayKr = (dateStr) => DAY_KR[getDayIndex(dateStr)]
  const getDayName = (dateStr) => DAY_NAMES[getDayIndex(dateStr)]

  const formatCurrency = (v) => v != null ? '\u20a9' + Number(v).toLocaleString() : '-'

  return (
    <div style={styles.container}>
      {/* Section A: Bulk Set by Date Range */}
      <div style={styles.sectionHeader}>
        <div style={{ ...styles.sectionIcon, background: '#3b82f6' }}>A</div>
        <div>
          <h4 style={styles.sectionTitle}>{'\uC77C\uAD04 \uC7AC\uACE0 \uC124\uC815'} (Bulk Set by Date Range)</h4>
          <p style={styles.sectionSubtitle}>Set pricing and availability for a range of dates at once</p>
        </div>
      </div>
      <div style={styles.section}>
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <span style={styles.label}>Start Date</span>
            <input
              type="date"
              style={styles.input}
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>End Date</span>
            <input
              type="date"
              style={styles.input}
              value={bulkEnd}
              onChange={(e) => setBulkEnd(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>{'\uAC00\uACA9'} Price ({'\u20a9'})</span>
            <input
              type="number"
              style={{ ...styles.input, minWidth: 140 }}
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              placeholder="\u20a9 Enter price"
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>{'\uC218\uB7C9'} {typeLabel}</span>
            <input
              type="number"
              style={styles.input}
              min={0}
              value={bulkQuantity}
              onChange={(e) => setBulkQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ ...styles.label, display: 'block', marginBottom: 8 }}>{'\uC694\uC77C \uC120\uD0DD'} (Days of Week)</span>
          <div style={styles.daysRow}>
            {DAY_NAMES.map((day, i) => {
              const jsIndex = DAY_JS_INDEX[i]
              const checked = daysOfWeek.includes(jsIndex)
              return (
                <div
                  key={i}
                  style={{
                    ...styles.dayCheck,
                    ...(checked ? styles.dayChecked : styles.dayUnchecked),
                  }}
                  onClick={() => toggleDay(i)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDay(i)}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                  {day} ({DAY_KR[i]})
                </div>
              )
            })}
          </div>
        </div>

        <button
          style={{ ...styles.btnApply, opacity: bulkLoading ? 0.7 : 1 }}
          onClick={applyBulk}
          disabled={bulkLoading}
        >
          {bulkLoading ? 'Applying...' : '\uC801\uC6A9 Apply to Range'}
        </button>

        {bulkMessage && (
          <div style={bulkMessage.type === 'success' ? styles.success : styles.error}>
            {bulkMessage.text}
          </div>
        )}
      </div>

      {/* Section B: Inventory Calendar/Table View */}
      <div style={styles.sectionHeader}>
        <div style={{ ...styles.sectionIcon, background: '#22c55e' }}>B</div>
        <div>
          <h4 style={styles.sectionTitle}>{'\uC7AC\uACE0 \uD604\uD669'} (Inventory Calendar View)</h4>
          <p style={styles.sectionSubtitle}>View and edit daily inventory. Click a row to edit inline.</p>
        </div>
      </div>
      <div style={styles.sectionLast}>
        <div style={{ ...styles.row, marginBottom: 16 }}>
          <div style={styles.formGroup}>
            <span style={styles.label}>From Date</span>
            <input
              type="date"
              style={styles.input}
              value={viewStart}
              onChange={(e) => setViewStart(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>To Date</span>
            <input
              type="date"
              style={styles.input}
              value={viewEnd}
              onChange={(e) => setViewEnd(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={loadInventory}
              disabled={tableLoading}
            >
              {tableLoading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        <div style={styles.tableWrap}>
          {tableLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto', width: 24, height: 24 }} />
              <p style={{ marginTop: 8 }}>Loading inventory...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              No inventory data for this date range. Use Section A above to set inventory.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>{'\uC694\uC77C'} (Day)</th>
                  <th style={styles.th}>{'\uAC00\uACA9'} Price ({'\u20a9'})</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Booked</th>
                  <th style={styles.th}>Available</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, width: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv, i) => {
                  const total = inv.total_rooms ?? inv.total_quantity ?? 0
                  const booked = inv.booked_rooms ?? inv.booked_quantity ?? 0
                  const available = Math.max(0, total - booked)
                  const rowStyle = getRowStyle(booked, total)
                  const status = getStatusInfo(booked, total)
                  const isEditing = editingRow === i

                  return (
                    <tr key={i} style={rowStyle}>
                      <td style={{ ...styles.td, fontWeight: 500 }}>{formatDate(inv.date)}</td>
                      <td style={styles.td}>{getDayName(inv.date)} ({getDayKr(inv.date)})</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={styles.editInput}
                            value={editValues.price}
                            onChange={(e) => setEditValues({ ...editValues, price: e.target.value })}
                            onKeyDown={(e) => handleEditKeyDown(e, inv)}
                            autoFocus
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{formatCurrency(inv.price)}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={styles.editInput}
                            min={0}
                            value={editValues.quantity}
                            onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                            onKeyDown={(e) => handleEditKeyDown(e, inv)}
                          />
                        ) : (
                          total
                        )}
                      </td>
                      <td style={styles.td}>{booked}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{available}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          background: status.bg,
                          color: status.color,
                        }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={styles.btnSmPrimary} onClick={() => saveEdit(inv)}>
                              Save
                            </button>
                            <button style={styles.btnSmSecondary} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            style={styles.btnSmSecondary}
                            onClick={() => startEdit(inv, i)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
