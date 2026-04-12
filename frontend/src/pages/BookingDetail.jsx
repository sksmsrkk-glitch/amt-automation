import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get, put } from '../utils/api'

function getLocalizedName(obj, lang) {
  if (!obj) return ''
  const isCn = lang === 'cn' || lang === 'zh'
  return (isCn ? obj.name_cn || obj.name_en : obj.name_en || obj.name_cn) || obj.name || obj.title || ''
}

function firstNumber(...vals) {
  for (const v of vals) {
    if (v === 0 || v) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

const styles = {
  page: {
    maxWidth: '800px',
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
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '28px 32px',
    background: 'linear-gradient(135deg, #0d47a1, #1a73e8)',
    color: 'var(--white)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerLeft: {},
  bookingTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    opacity: 0.8,
    marginBottom: '6px',
  },
  bookingNum: {
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  statusBadge: {
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardBody: {
    padding: '32px',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-light)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '32px',
  },
  infoItem: {},
  infoLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  timeline: {
    position: 'relative',
    paddingLeft: '28px',
    marginBottom: '32px',
  },
  timelineLine: {
    position: 'absolute',
    left: '8px',
    top: '4px',
    bottom: '4px',
    width: '2px',
    background: 'var(--border)',
  },
  timelineItem: {
    position: 'relative',
    paddingBottom: '20px',
  },
  timelineDot: {
    position: 'absolute',
    left: '-24px',
    top: '2px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid var(--white)',
  },
  timelineContent: {},
  timelineTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  timelineDate: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  voucherBox: {
    padding: '24px',
    background: 'linear-gradient(135deg, #e8eaf6, #f3e5f5)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
    marginBottom: '32px',
  },
  voucherLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  voucherCode: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--secondary)',
    letterSpacing: '3px',
    marginBottom: '16px',
  },
  qrBox: {
    width: '100px',
    height: '100px',
    margin: '0 auto',
    background: 'var(--white)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed var(--border)',
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  priceSection: {
    marginBottom: '32px',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '0.9rem',
  },
  priceLabel: {
    color: 'var(--text-secondary)',
  },
  priceValue: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderTop: '2px solid var(--border)',
    marginTop: '8px',
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  totalAmount: {
    color: 'var(--accent)',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-light)',
  },
}

const statusColors = {
  pending: { bg: 'rgba(255,255,255,0.2)', text: '#fff' },
  confirmed: { bg: '#e8f5e9', text: '#2e7d32' },
  cancelled: { bg: '#ffebee', text: '#c62828' },
  refunded: { bg: '#eceff1', text: '#546e7a' },
}

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true)
      try {
        const data = await get(`/bookings/${id}`)
        setResponse(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBooking()
  }, [id])

  // Backend returns { booking, voucher, payment, product, room_type }
  const booking = response?.booking || null
  const voucher = response?.voucher || booking?.voucher || null
  const productDetail = response?.product || null
  const roomType = response?.room_type || null
  const payment = response?.payment || null

  const handleCancel = async () => {
    if (!window.confirm(t('myBookings.confirmCancel'))) return
    setCancelling(true)
    try {
      const res = await put(`/bookings/${id}/cancel`, {})
      setResponse(prev => ({
        ...(prev || {}),
        booking: res?.booking || { ...(prev?.booking || {}), status: 'cancelled' },
      }))
    } catch (err) {
      alert(err.message || 'Failed to cancel')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !booking) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Booking not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/my-bookings')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  const status = booking.status || 'pending'
  const canCancel = status === 'pending' || status === 'confirmed'
  const bkn = booking.booking_number || booking.bookingNumber || id
  const voucherCode = voucher?.code || booking.voucherCode || ''
  const productName = getLocalizedName(productDetail, lang) || 'Booking'
  const roomTypeName = getLocalizedName(roomType, lang)
  const totalPrice = firstNumber(booking.total_price, booking.totalPrice, booking.total)
  const nights = firstNumber(booking.nights) || null
  const bookingQuantity = firstNumber(booking.quantity) || 1
  const checkIn = booking.check_in || booking.checkIn || ''
  const checkOut = booking.check_out || booking.checkOut || ''
  const visitDate = booking.visit_date || booking.visitDate || ''
  const productType = booking.product_type || booking.type || ''
  const guestName = booking.guest_name || booking.guestName || '-'
  const guestEmail = booking.guest_email || booking.guestEmail || '-'
  const guestPhone = booking.guest_phone || booking.guestPhone || '-'
  const specialRequests = booking.special_requests || booking.specialRequests || ''
  const sc = statusColors[status] || statusColors.pending

  const timelineSteps = [
    { label: t('statuses.pending'), done: true, color: 'var(--warning)' },
    { label: t('statuses.confirmed'), done: status === 'confirmed' || status === 'cancelled' || status === 'refunded', color: 'var(--success)' },
  ]
  if (status === 'cancelled') {
    timelineSteps.push({ label: t('statuses.cancelled'), done: true, color: 'var(--error)' })
  }
  if (status === 'refunded') {
    timelineSteps.push({ label: t('statuses.refunded'), done: true, color: 'var(--text-muted)' })
  }

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate('/my-bookings')}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.headerLeft}>
            <div style={styles.bookingTitle}>{t('booking.bookingNumber')}</div>
            <div style={styles.bookingNum}>#{bkn}</div>
          </div>
          <span style={{
            ...styles.statusBadge,
            background: sc.bg,
            color: sc.text,
          }}>
            {t(`statuses.${status}`)}
          </span>
        </div>

        <div style={styles.cardBody}>
          {/* Product Info */}
          <h3 style={styles.sectionTitle}>{t('booking.product')}</h3>
          <div style={styles.infoGrid} className="detail-info-grid">
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.product')}</div>
              <div style={styles.infoValue}>
                {productName}
                {roomTypeName && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{roomTypeName}</div>}
              </div>
            </div>
            {productType && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Type</div>
                <div style={styles.infoValue}>{productType}</div>
              </div>
            )}
            {checkIn && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.checkIn')}</div>
                <div style={styles.infoValue}>{checkIn}</div>
              </div>
            )}
            {checkOut && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.checkOut')}</div>
                <div style={styles.infoValue}>{checkOut}</div>
              </div>
            )}
            {visitDate && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('ticket.visitDate')}</div>
                <div style={styles.infoValue}>{visitDate}</div>
              </div>
            )}
            {bookingQuantity > 0 && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('ticket.quantity')}</div>
                <div style={styles.infoValue}>{bookingQuantity}</div>
              </div>
            )}
            {nights != null && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('booking.nights')}</div>
                <div style={styles.infoValue}>{nights}</div>
              </div>
            )}
          </div>

          {/* Guest Info */}
          <h3 style={styles.sectionTitle}>{t('booking.guestInfo')}</h3>
          <div style={styles.infoGrid} className="detail-info-grid">
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.name')}</div>
              <div style={styles.infoValue}>{guestName}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.email')}</div>
              <div style={styles.infoValue}>{guestEmail}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.phone')}</div>
              <div style={styles.infoValue}>{guestPhone}</div>
            </div>
          </div>

          {specialRequests && (
            <>
              <h3 style={styles.sectionTitle}>{t('booking.specialRequests')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '32px' }}>
                {specialRequests}
              </p>
            </>
          )}

          {/* Status Timeline */}
          <h3 style={styles.sectionTitle}>{t('myBookings.status')}</h3>
          <div style={styles.timeline}>
            <div style={styles.timelineLine} />
            {timelineSteps.map((step, i) => (
              <div key={i} style={styles.timelineItem}>
                <div style={{
                  ...styles.timelineDot,
                  background: step.done ? step.color : 'var(--border)',
                  boxShadow: step.done ? `0 0 0 3px ${step.color}33` : 'none',
                }} />
                <div style={styles.timelineContent}>
                  <div style={{
                    ...styles.timelineTitle,
                    color: step.done ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>{step.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Voucher */}
          {voucherCode && status !== 'cancelled' && (
            <>
              <h3 style={styles.sectionTitle}>{t('voucher.title')}</h3>
              <div style={styles.voucherBox}>
                <div style={styles.voucherLabel}>{t('voucher.code')}</div>
                <div style={styles.voucherCode}>{voucherCode}</div>
                <div style={styles.qrBox}>
                  {t('voucher.qrCode')}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                  {t('voucher.presentAtCheckIn')}
                </p>
              </div>
            </>
          )}

          {/* Price */}
          <h3 style={styles.sectionTitle}>{t('booking.priceBreakdown')}</h3>
          <div style={styles.priceSection}>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>{t('booking.subtotal')}</span>
              <span style={styles.priceValue}>{t('common.currency')} {totalPrice.toLocaleString()}</span>
            </div>
            {payment && (
              <div style={styles.priceRow}>
                <span style={styles.priceLabel}>Payment Status</span>
                <span style={styles.priceValue}>{payment.status || 'pending'}</span>
              </div>
            )}
            <div style={styles.totalRow}>
              <span>{t('booking.grandTotal')}</span>
              <span style={styles.totalAmount}>{t('common.currency')} {totalPrice.toLocaleString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <Link to="/my-bookings" className="btn btn-outline btn-sm">{t('common.back')}</Link>
            {canCancel && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? t('common.loading') : t('myBookings.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .detail-info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
