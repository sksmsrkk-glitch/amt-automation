import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { get, post } from '../utils/api'

// ============================================================
// Helpers
// ============================================================

// Parse "YYYY-MM-DD" as UTC midnight so night calculations are
// independent of the browser's local timezone.
function parseUTCDate(str) {
  if (typeof str !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function diffNights(checkIn, checkOut) {
  const ci = parseUTCDate(checkIn)
  const co = parseUTCDate(checkOut)
  if (!ci || !co) return 0
  const ms = co.getTime() - ci.getTime()
  if (ms <= 0) return 0
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function getLocalizedName(obj, lang) {
  if (!obj) return ''
  const isCn = lang === 'cn' || lang === 'zh'
  return (isCn ? obj.name_cn || obj.name_en : obj.name_en || obj.name_cn) || obj.name || obj.title || ''
}

// Backend uses `base_price`; older/legacy shapes use `basePrice` or `price`.
function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function roomBasePrice(room) {
  if (!room) return 0
  return toNumber(room.base_price ?? room.basePrice ?? room.price)
}

function productBasePrice(product) {
  if (!product) return 0
  return toNumber(product.base_price ?? product.basePrice ?? product.price)
}

function formatKRW(value) {
  return '\u20A9' + toNumber(value).toLocaleString('en-US')
}

const styles = {
  page: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 32px) 20px 60px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '24px',
    background: 'none',
    border: 'none',
    padding: 0,
    transition: 'var(--transition)',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '32px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '40px',
    alignItems: 'start',
  },
  formCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '32px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
  },
  formTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '24px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  summaryCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '28px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
    position: 'sticky',
    top: 'calc(var(--header-height) + 32px)',
  },
  summaryTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)',
  },
  summaryProduct: {
    display: 'flex',
    gap: '14px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border-light)',
  },
  productThumb: {
    width: '80px',
    height: '60px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  productMeta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '0.9rem',
  },
  summaryLabel: {
    color: 'var(--text-secondary)',
  },
  summaryValue: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '12px 0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0 0',
  },
  totalLabel: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  totalAmount: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  paymentNote: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: '12px',
    marginBottom: '20px',
    padding: '10px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
  },
  confirmBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '1.05rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  errorMsg: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    marginBottom: '12px',
    padding: '10px 14px',
    background: 'var(--error-bg)',
    borderRadius: 'var(--radius-sm)',
  },
}

const typeGradients = {
  hotel: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  ticket: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  package: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
}

const typeIcons = {
  hotel: '\u{1F3E8}',
  ticket: '\u{1F3BF}',
  package: '\u{1F381}',
}

export default function BookingPage() {
  const { type, id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const { user, isAuthenticated } = useAuth()

  // Separate state per product type for clarity; falls back to `product` below.
  const [hotel, setHotel] = useState(null)
  const [roomTypes, setRoomTypes] = useState([])
  const [ticket, setTicket] = useState(null)
  const [pkg, setPkg] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [ticketAvailability, setTicketAvailability] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const checkIn = searchParams.get('checkIn') || ''
  const checkOut = searchParams.get('checkOut') || ''
  const roomTypeParam = searchParams.get('roomType') || ''
  // URL params are strings but DB ids are integers — coerce once for comparisons.
  const roomTypeId = roomTypeParam ? Number(roomTypeParam) : null
  const visitDate = searchParams.get('date') || ''
  const quantity = Math.max(1, parseInt(searchParams.get('quantity') || '1', 10) || 1)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialRequests: '',
    nationality: '',
  })

  useEffect(() => {
    if (isAuthenticated && user) {
      setForm(f => ({
        ...f,
        name: user.name || f.name,
        email: user.email || f.email,
        phone: user.phone || f.phone,
        nationality: user.nationality || f.nationality,
      }))
    }
  }, [isAuthenticated, user])

  // Load the product detail. Hotels include a sibling `room_types` array
  // which the previous code was discarding.
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      setError(null)
      try {
        if (type === 'hotel') {
          const data = await get(`/hotels/${id}`)
          setHotel(data.hotel || data)
          setRoomTypes(data.room_types || data.roomTypes || [])
        } else if (type === 'ticket') {
          const data = await get(`/tickets/${id}`)
          setTicket(data.ticket || data)
        } else if (type === 'package') {
          const data = await get(`/packages/${id}`)
          setPkg(data.package || data)
        } else {
          throw new Error('Invalid booking type')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [type, id])

  // Hotel: fetch per-night availability so the summary matches what the
  // backend will actually charge (inventory prices override base_price).
  useEffect(() => {
    if (type !== 'hotel' || !checkIn || !checkOut) {
      setAvailability(null)
      return
    }
    if (diffNights(checkIn, checkOut) <= 0) {
      setAvailability(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const data = await get(`/hotels/${id}/availability?check_in=${checkIn}&check_out=${checkOut}`)
        if (!cancelled) setAvailability(data)
      } catch {
        if (!cancelled) setAvailability(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [type, id, checkIn, checkOut])

  // Ticket: fetch single-date price to reflect inventory overrides.
  useEffect(() => {
    if (type !== 'ticket' || !visitDate) {
      setTicketAvailability(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const data = await get(`/tickets/${id}/availability?date=${visitDate}`)
        if (!cancelled) setTicketAvailability(data)
      } catch {
        if (!cancelled) setTicketAvailability(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [type, id, visitDate])

  // Derived "product" to keep the JSX below simple.
  const product = type === 'hotel' ? hotel : type === 'ticket' ? ticket : pkg

  // Find the room the user picked on the detail page.
  const selectedRoom = useMemo(() => {
    if (type !== 'hotel') return null
    if (roomTypes.length === 0) return null
    if (roomTypeId != null) {
      const match = roomTypes.find(r => Number(r.id ?? r._id) === roomTypeId)
      if (match) return match
    }
    return roomTypes[0]
  }, [type, roomTypes, roomTypeId])

  // Availability entry for the selected room (sums per-night inventory price).
  const availabilityEntry = useMemo(() => {
    if (!availability || !selectedRoom) return null
    const entries = availability.availability || []
    return entries.find(a => Number(a.room_type?.id) === Number(selectedRoom.id)) || null
  }, [availability, selectedRoom])

  const nights = diffNights(checkIn, checkOut)

  // Final numbers used by the summary + submission.
  const computed = useMemo(() => {
    if (type === 'hotel') {
      const unitPerNight = roomBasePrice(selectedRoom)
      const nightsClamped = Math.max(1, nights || 1)
      const fallbackTotal = unitPerNight * nightsClamped
      // Prefer inventory-aware total when availability is loaded.
      const total = availabilityEntry ? toNumber(availabilityEntry.total_price) : fallbackTotal
      return {
        unitPrice: unitPerNight,
        unitLabel: `${formatKRW(unitPerNight)} / room / night`,
        nights: nightsClamped,
        total,
        isEstimate: !availabilityEntry,
      }
    }
    if (type === 'ticket') {
      const invPrice = ticketAvailability ? toNumber(ticketAvailability.price) : null
      const unit = invPrice != null && invPrice > 0 ? invPrice : productBasePrice(ticket)
      return {
        unitPrice: unit,
        unitLabel: `${formatKRW(unit)} / ${t('common.person')}`,
        nights: 0,
        total: unit * quantity,
        isEstimate: invPrice == null,
      }
    }
    if (type === 'package') {
      const unit = productBasePrice(pkg)
      return {
        unitPrice: unit,
        unitLabel: `${formatKRW(unit)} / ${t('common.person')}`,
        nights: 0,
        total: unit * quantity,
        isEstimate: true, // no per-date availability endpoint yet
      }
    }
    return { unitPrice: 0, unitLabel: '-', nights: 0, total: 0, isEstimate: true }
  }, [type, selectedRoom, availabilityEntry, nights, ticket, ticketAvailability, pkg, quantity, t])

  const total = computed.total

  const getRoomTypeName = () => {
    if (!selectedRoom) return ''
    return getLocalizedName(selectedRoom, lang)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone) {
      setSubmitError('Please fill in all required fields')
      return
    }
    if (type === 'hotel') {
      if (!checkIn || !checkOut || nights <= 0) {
        setSubmitError('Please select valid check-in and check-out dates')
        return
      }
      if (!roomTypeId && !selectedRoom) {
        setSubmitError('Please select a room type')
        return
      }
    } else {
      if (!visitDate) {
        setSubmitError('Please select a date')
        return
      }
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Backend (POST /bookings) expects snake_case fields.
      const bookingData = {
        guest_name: form.name,
        guest_email: form.email,
        guest_phone: form.phone,
        product_type: type,
        product_id: Number(id),
        special_requests: form.specialRequests || null,
      }

      if (type === 'hotel') {
        bookingData.room_type_id = Number(selectedRoom?.id ?? roomTypeId)
        bookingData.check_in = checkIn
        bookingData.check_out = checkOut
        bookingData.guests = 1
        bookingData.quantity = 1 // number of rooms
      } else {
        bookingData.visit_date = visitDate
        bookingData.quantity = quantity
        bookingData.guests = quantity
      }

      const result = await post('/bookings', bookingData)
      const bookingId = result.booking?.id ?? result.booking?._id
      if (!bookingId) throw new Error('Booking created but response is missing an id')
      navigate(`/booking/confirmation/${bookingId}`)
    } catch (err) {
      setSubmitError(err.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInput = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !product) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Product not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate(-1)}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      <h1 style={styles.title}>{t('booking.title')}</h1>

      <form onSubmit={handleSubmit}>
        <div style={styles.layout} className="booking-layout">
          {/* Guest Info Form */}
          <div style={styles.formCard}>
            <h2 style={styles.formTitle}>{t('booking.guestInfo')}</h2>

            {submitError && <div style={styles.errorMsg}>{submitError}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('booking.name')} *</label>
              <input
                type="text"
                style={styles.input}
                value={form.name}
                onChange={handleInput('name')}
                required
                placeholder={t('booking.name')}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div style={styles.row} className="booking-form-row">
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('booking.email')} *</label>
                <input
                  type="email"
                  style={styles.input}
                  value={form.email}
                  onChange={handleInput('email')}
                  required
                  placeholder={t('booking.email')}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('booking.phone')} *</label>
                <input
                  type="tel"
                  style={styles.input}
                  value={form.phone}
                  onChange={handleInput('phone')}
                  required
                  placeholder={t('booking.phone')}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('booking.nationality')}</label>
              <input
                type="text"
                style={styles.input}
                value={form.nationality}
                onChange={handleInput('nationality')}
                placeholder={t('booking.nationality')}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('booking.specialRequests')}</label>
              <textarea
                style={styles.textarea}
                value={form.specialRequests}
                onChange={handleInput('specialRequests')}
                placeholder={t('booking.specialRequests')}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>
          </div>

          {/* Summary Sidebar */}
          <div style={styles.summaryCard}>
            <h2 style={styles.summaryTitle}>{t('booking.summary')}</h2>

            <div style={styles.summaryProduct}>
              <div style={{ ...styles.productThumb, background: typeGradients[type] || typeGradients.hotel }}>
                {typeIcons[type] || typeIcons.hotel}
              </div>
              <div style={styles.productInfo}>
                <div style={styles.productName}>{getLocalizedName(product, lang)}</div>
                {getRoomTypeName() && (
                  <div style={styles.productMeta}>{getRoomTypeName()}</div>
                )}
              </div>
            </div>

            {type === 'hotel' && (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('hotel.checkIn')}</span>
                  <span style={styles.summaryValue}>{checkIn || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('hotel.checkOut')}</span>
                  <span style={styles.summaryValue}>{checkOut || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('booking.nights')}</span>
                  <span style={styles.summaryValue}>{computed.nights} {t('common.night')}</span>
                </div>
              </>
            )}

            {type === 'ticket' && (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('ticket.visitDate')}</span>
                  <span style={styles.summaryValue}>{visitDate || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('ticket.quantity')}</span>
                  <span style={styles.summaryValue}>{quantity} {quantity === 1 ? t('common.person') : t('common.persons')}</span>
                </div>
              </>
            )}

            {type === 'package' && (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('package.startDate')}</span>
                  <span style={styles.summaryValue}>{visitDate || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Quantity</span>
                  <span style={styles.summaryValue}>{quantity} {quantity === 1 ? 'person' : 'persons'}</span>
                </div>
              </>
            )}

            <div style={styles.divider} />

            {(type === 'ticket' || type === 'package') && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Unit Price</span>
                  <span style={styles.summaryValue}>{computed.unitLabel}</span>
                </div>
                {quantity > 1 && (
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>{'\u00D7'} {quantity} persons</span>
                    <span style={styles.summaryValue}>{formatKRW(total)}</span>
                  </div>
                )}
              </div>
            )}

            {type === 'hotel' && checkIn && checkOut && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Room Rate</span>
                  <span style={styles.summaryValue}>{computed.unitLabel}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{computed.nights} night{computed.nights > 1 ? 's' : ''}</span>
                  <span style={styles.summaryValue}>{formatKRW(total)}</span>
                </div>
                {computed.isEstimate && (
                  <div style={{ ...styles.summaryRow, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>*Estimate — final total will be confirmed on submission.</span>
                  </div>
                )}
              </div>
            )}

            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>{t('booking.grandTotal')}</span>
              <span style={styles.totalAmount}>{formatKRW(total)}</span>
            </div>

            <div style={styles.paymentNote}>{t('booking.paymentNote')}</div>

            <button
              type="submit"
              style={{
                ...styles.confirmBtn,
                ...(submitting ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
              }}
              disabled={submitting}
              onMouseEnter={e => { if (!submitting) { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 16px rgba(255,111,0,0.3)' } }}
              onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
            >
              {submitting ? t('booking.processing') : t('booking.confirm')}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        @media (max-width: 768px) {
          .booking-layout { grid-template-columns: 1fr !important; }
          .booking-form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
