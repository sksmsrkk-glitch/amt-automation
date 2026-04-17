// ============================================================================
// HotelList — 호텔 목록 페이지 (/hotels)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - URL 쿼리(?checkIn, ?checkOut, ?guests)를 그대로 /hotels API 로 전달해
//     해당 기간/인원으로 제공 가능한 호텔을 받아 카드 그리드로 보여 준다.
//   - 체크인/체크아웃 날짜 + 인원을 이 페이지 자체에서 바꿀 수 있는 인라인
//     검색 폼을 제공한다. (홈으로 돌아가지 않고 재검색)
//
// 렌더 위치: App.jsx 의 /hotels 라우트. lazy-loaded.
//
// 주의:
//   - useSearchParams 가 바뀌면 자동으로 재fetch. SearchBar 에서 navigate
//     했을 때 그대로 반영된다. 인라인 폼 제출 시에도 setSearchParams 로
//     같은 경로로 재진입한다.
//   - 응답 shape 은 { hotels } / { data } / raw array 세 가지 모두 허용.
//   - 백엔드가 checkIn/checkOut 을 받으면 각 호텔에 date_price 가 붙어 온다
//     (null 가능). ProductCard 가 date_price 우선 표시한다.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'
import ProductCard from '../components/ProductCard'
import DateRangePicker from '../components/DateRangePicker'

const styles = {
  page: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 32px) 20px 60px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
  },
  // 인라인 재검색 폼 — 메인 히어로 SearchBar 의 호텔 탭과 기능적으로 동일.
  // 홈으로 돌아가지 않고 바로 조건을 바꿀 수 있게 한다.
  searchForm: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    padding: '16px',
    background: 'var(--white)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: '28px',
    flexWrap: 'wrap',
  },
  field: {
    flex: 1,
    minWidth: '160px',
  },
  label: {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--bg)',
  },
  searchBtn: {
    padding: '10px 28px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '0.9rem',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
}

/**
 * 호텔 목록 페이지.
 * - URL 쿼리 → 백엔드 fetch → 카드 그리드 렌더.
 * - 인라인 검색 폼으로 URL 쿼리를 교체(setSearchParams)하여 재fetch.
 * - 부작용: searchParams 변경 시 /hotels 재호출.
 */
export default function HotelList() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 인라인 검색 폼 로컬 상태. URL 쿼리의 현재 값으로 초기화해, 사용자가
  // 조건을 수정 → 제출할 때까지 URL 은 바뀌지 않는다.
  const [formCheckIn, setFormCheckIn] = useState(searchParams.get('checkIn') || '')
  const [formCheckOut, setFormCheckOut] = useState(searchParams.get('checkOut') || '')
  const [formGuests, setFormGuests] = useState(searchParams.get('guests') || '2')

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        const checkIn = searchParams.get('checkIn')
        const checkOut = searchParams.get('checkOut')
        const guests = searchParams.get('guests')
        if (checkIn) params.set('checkIn', checkIn)
        if (checkOut) params.set('checkOut', checkOut)
        if (guests) params.set('guests', guests)
        const query = params.toString() ? `?${params.toString()}` : ''
        const data = await get(`/hotels${query}`)
        setHotels(data.hotels || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHotels()
  }, [searchParams])

  // URL 쿼리가 외부에서 바뀌면(예: 홈 SearchBar 재진입) 폼 값도 동기화.
  useEffect(() => {
    setFormCheckIn(searchParams.get('checkIn') || '')
    setFormCheckOut(searchParams.get('checkOut') || '')
    setFormGuests(searchParams.get('guests') || '2')
  }, [searchParams])

  // 재검색 — 폼 값을 URL 쿼리로 반영. URL 변경이 useEffect 를 트리거해 fetch 됨.
  const handleReSearch = (e) => {
    e.preventDefault()
    if (formCheckIn && formCheckOut && formCheckOut <= formCheckIn) {
      alert(t('hotel.checkOutAfterCheckIn') || 'Check-out date must be after check-in date.')
      return
    }
    const next = new URLSearchParams()
    if (formCheckIn) next.set('checkIn', formCheckIn)
    if (formCheckOut) next.set('checkOut', formCheckOut)
    if (formGuests) next.set('guests', formGuests)
    setSearchParams(next)
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('common.retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('hotel.title')}</h1>
        <p style={styles.subtitle}>{t('hotel.allHotels')}</p>
      </div>

      {/* 인라인 재검색 폼 — 메인 SearchBar 와 동일 API 로 URL 갱신. */}
      <form style={styles.searchForm} onSubmit={handleReSearch}>
        <div style={{ ...styles.field, flex: 2 }}>
          <label style={styles.label}>{t('hotel.checkIn')} / {t('hotel.checkOut')}</label>
          <DateRangePicker
            checkIn={formCheckIn}
            checkOut={formCheckOut}
            onChange={(ci, co) => { setFormCheckIn(ci); setFormCheckOut(co) }}
            placeholder="Select dates"
          />
        </div>
        <div style={{ ...styles.field, maxWidth: '140px', minWidth: '110px' }}>
          <label style={styles.label}>{t('hotel.guests')}</label>
          <select
            style={styles.select}
            value={formGuests}
            onChange={(e) => setFormGuests(e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? t('common.person') : t('common.persons')}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={styles.searchBtn}>{t('common.search')}</button>
      </form>

      {hotels.length > 0 ? (
        <div style={styles.grid} className="hotel-grid">
          {hotels.map(hotel => (
            <ProductCard key={hotel._id || hotel.id} type="hotel" data={hotel} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#127976;</div>
          <p className="empty-state-title">{t('hotel.noHotels')}</p>
          <p className="empty-state-text">{t('common.noResults')}</p>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .hotel-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .hotel-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
