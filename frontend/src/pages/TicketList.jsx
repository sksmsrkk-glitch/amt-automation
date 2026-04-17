// ============================================================================
// TicketList — 티켓 목록 페이지 (/tickets)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 카테고리 탭(all/ski/activity/entertainment/wellness)으로 /tickets
//     API 를 재호출해 결과를 카드 그리드로 렌더한다.
//   - URL 쿼리 ?date 도 그대로 전달해 해당 날짜 가용 티켓만 받을 수 있다.
//   - 인라인 날짜 재검색 폼(카테고리 + 날짜)으로 홈으로 돌아가지 않고도
//     조건을 변경할 수 있다.
//   - 로컬 텍스트 필터(name_en/name_cn/description_*)로 추가 필터링.
//
// 렌더 위치: /tickets 라우트. lazy-loaded.
// 주의: 백엔드가 date 를 받으면 각 티켓에 date_price 가 붙어 온다.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'
import ProductCard from '../components/ProductCard'
import SingleDatePicker from '../components/SingleDatePicker'

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
  searchForm: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    padding: '16px',
    background: 'var(--white)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: '20px',
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
  controls: {
    display: 'flex',
    gap: '12px',
    marginBottom: '28px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: 'var(--bg)',
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'var(--white)',
    color: 'var(--primary)',
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '10px 16px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    transition: 'var(--transition)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
  },
}

// 탭 순서 고정. 'all' 은 서버에 카테고리 파라미터를 보내지 않는 신호.
const categories = ['all', 'ski', 'activity', 'entertainment', 'wellness']

/**
 * 티켓 목록 페이지.
 * 부작용: activeCategory 또는 URL searchParams 변경 시 /tickets 재호출.
 */
export default function TicketList() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all')
  const [searchTerm, setSearchTerm] = useState('')

  // 인라인 날짜 재검색 폼 상태. URL 의 date 로 초기화.
  const [formDate, setFormDate] = useState(searchParams.get('date') || '')

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (activeCategory && activeCategory !== 'all') params.set('category', activeCategory)
        const date = searchParams.get('date')
        if (date) params.set('date', date)
        const query = params.toString() ? `?${params.toString()}` : ''
        const data = await get(`/tickets${query}`)
        setTickets(data.tickets || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchTickets()
  }, [activeCategory, searchParams])

  // URL 이 외부에서 바뀌면 폼도 동기화. (홈에서 다시 진입한 경우 등)
  useEffect(() => {
    setFormDate(searchParams.get('date') || '')
    const urlCategory = searchParams.get('category')
    if (urlCategory && urlCategory !== activeCategory) setActiveCategory(urlCategory)
  // activeCategory 는 의도적으로 deps 에서 제외 — URL 기반 동기화만 수행.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleReSearch = (e) => {
    e.preventDefault()
    const next = new URLSearchParams()
    if (activeCategory && activeCategory !== 'all') next.set('category', activeCategory)
    if (formDate) next.set('date', formDate)
    setSearchParams(next)
  }

  // 부분 일치 검색 — 실제 필드명은 name_en/name_cn/description_en/description_cn.
  // 이전 구현은 존재하지 않는 t_item.name / .description 을 읽어 빈 문자열과
  // 비교해 어떤 입력도 매치하지 않는 버그가 있었다.
  const filtered = tickets.filter((t_item) => {
    if (!searchTerm) return true
    const needle = searchTerm.toLowerCase()
    const haystack = [
      t_item.name_en,
      t_item.name_cn,
      t_item.description_en,
      t_item.description_cn,
      t_item.location,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(needle)
  })

  const getCategoryLabel = (cat) => {
    if (cat === 'all') return t('ticket.allCategories')
    return t(`ticket.${cat}`)
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
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
        <h1 style={styles.title}>{t('ticket.title')}</h1>
        <p style={styles.subtitle}>{t('ticket.searchTickets')}</p>
      </div>

      {/* 인라인 재검색 폼 — 날짜 + (선택한 카테고리 탭)로 URL 갱신. */}
      <form style={styles.searchForm} onSubmit={handleReSearch}>
        <div style={styles.field}>
          <label style={styles.label}>{t('ticket.selectDate')}</label>
          <SingleDatePicker
            value={formDate}
            onChange={(d) => setFormDate(d)}
            placeholder="Select date"
          />
        </div>
        <button type="submit" style={styles.searchBtn}>{t('common.search')}</button>
      </form>

      <div style={styles.controls}>
        <div style={styles.tabs}>
          {categories.map(cat => (
            <button
              key={cat}
              style={{
                ...styles.tab,
                ...(activeCategory === cat ? styles.tabActive : {}),
              }}
              onClick={() => setActiveCategory(cat)}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
        <input
          type="text"
          style={styles.searchInput}
          placeholder={t('ticket.searchTickets')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        />
      </div>

      {filtered.length > 0 ? (
        <div style={styles.grid} className="ticket-grid">
          {filtered.map(ticket => (
            <ProductCard key={ticket._id || ticket.id} type="ticket" data={ticket} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#127903;</div>
          <p className="empty-state-title">{t('ticket.noTickets')}</p>
          <p className="empty-state-text">{t('common.noResults')}</p>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .ticket-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .ticket-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
