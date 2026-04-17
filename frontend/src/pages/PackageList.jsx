// ============================================================================
// PackageList — 패키지 목록 페이지 (/packages)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - URL 쿼리(?date)를 그대로 /packages API 로 전달해 해당 날짜 가용
//     패키지를 받아 카드 그리드로 보여 준다.
//   - 인라인 날짜 재검색 폼을 제공해 홈으로 돌아가지 않고도 조건을 변경할
//     수 있게 한다.
//   - 로컬 텍스트 필터(name_en/name_cn/description_*)로 추가 필터링.
//
// 렌더 위치: /packages 라우트. lazy-loaded.
// 주의: 백엔드가 date 를 받으면 각 패키지에 date_price 가 붙어 온다.
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
  searchInput: {
    width: '100%',
    maxWidth: '400px',
    padding: '12px 16px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    transition: 'var(--transition)',
    marginBottom: '28px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
}

/**
 * 패키지 목록 페이지.
 * 부작용: URL searchParams 변경 시 /packages GET 재호출.
 */
export default function PackageList() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // 인라인 날짜 재검색 폼 상태.
  const [formDate, setFormDate] = useState(searchParams.get('date') || '')

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        const date = searchParams.get('date')
        if (date) params.set('date', date)
        const query = params.toString() ? `?${params.toString()}` : ''
        const data = await get(`/packages${query}`)
        setPackages(data.packages || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPackages()
  }, [searchParams])

  useEffect(() => {
    setFormDate(searchParams.get('date') || '')
  }, [searchParams])

  const handleReSearch = (e) => {
    e.preventDefault()
    const next = new URLSearchParams()
    if (formDate) next.set('date', formDate)
    setSearchParams(next)
  }

  // 부분 일치 검색 — 실제 필드명은 name_en/name_cn/description_en/description_cn.
  // 이전 구현은 존재하지 않는 p.name / .description 을 읽어 빈 문자열과 비교하는
  // 버그가 있었다.
  const filtered = packages.filter((p) => {
    if (!searchTerm) return true
    const needle = searchTerm.toLowerCase()
    const haystack = [p.name_en, p.name_cn, p.description_en, p.description_cn]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })

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
        <h1 style={styles.title}>{t('package.title')}</h1>
        <p style={styles.subtitle}>{t('package.searchPackages')}</p>
      </div>

      {/* 인라인 재검색 폼 — 날짜만 받아 URL 갱신. */}
      <form style={styles.searchForm} onSubmit={handleReSearch}>
        <div style={styles.field}>
          <label style={styles.label}>{t('package.startDate')}</label>
          <SingleDatePicker
            value={formDate}
            onChange={(d) => setFormDate(d)}
            placeholder="Select date"
          />
        </div>
        <button type="submit" style={styles.searchBtn}>{t('common.search')}</button>
      </form>

      <input
        type="text"
        style={styles.searchInput}
        placeholder={t('package.searchPackages')}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />

      {filtered.length > 0 ? (
        <div style={styles.grid} className="package-grid">
          {filtered.map(pkg => (
            <ProductCard key={pkg._id || pkg.id} type="package" data={pkg} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#127873;</div>
          <p className="empty-state-title">{t('package.noPackages')}</p>
          <p className="empty-state-text">{t('common.noResults')}</p>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .package-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .package-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
