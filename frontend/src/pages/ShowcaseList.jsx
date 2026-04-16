// ============================================================================
// ShowcaseList — 리조트 소개 콘텐츠 목록 페이지 (/explore)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - GET /showcases 로 published 콘텐츠를 가져와 카드 그리드로 렌더.
//   - 카테고리 필터 탭 제공 (전체/시설/액티비티/다이닝/이벤트/자연).
//   - 각 카드 클릭 시 /explore/:id 상세 페이지로 이동.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'

const API_BASE = window.location.hostname === 'localhost' ? '' : ''

const styles = {
  page: {
    paddingTop: 'calc(var(--header-height) + 40px)',
    minHeight: '80vh',
  },
  container: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: '0 20px 60px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
  },
  filters: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '8px 20px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    background: 'var(--white)',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  filterBtnActive: {
    background: 'var(--primary)',
    color: 'var(--white)',
    borderColor: 'var(--primary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
  card: {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    background: 'var(--white)',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    display: 'block',
  },
  cardImage: {
    width: '100%',
    height: '220px',
    objectFit: 'cover',
    display: 'block',
    background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
  },
  cardBody: {
    padding: '20px',
  },
  cardCategory: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    lineHeight: 1.3,
  },
  cardSummary: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardFooter: {
    padding: '0 20px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  learnMore: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--primary)',
  },
  placeholder: {
    width: '100%',
    height: '220px',
    background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
  },
}

const categoryIcons = {
  facility: '\u{1F3E8}',
  activity: '\u{26F7}',
  dining: '\u{1F37D}',
  event: '\u{1F389}',
  nature: '\u{1F333}',
}

export default function ShowcaseList() {
  const { t, i18n } = useTranslation()
  const [showcases, setShowcases] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const lang = i18n.language === 'cn' ? 'cn' : 'en'

  const categories = ['all', 'facility', 'activity', 'dining', 'event', 'nature']

  useEffect(() => {
    const fetchShowcases = async () => {
      setLoading(true)
      try {
        const url = activeCategory === 'all'
          ? '/showcases'
          : `/showcases?category=${activeCategory}`
        const res = await get(url)
        setShowcases(res.showcases || [])
      } catch (err) {
        console.error('Failed to fetch showcases:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchShowcases()
  }, [activeCategory])

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{t('showcase.title')}</h1>
          <p style={styles.subtitle}>{t('showcase.subtitle')}</p>
        </div>

        <div style={styles.filters}>
          {categories.map(cat => (
            <button
              key={cat}
              style={{
                ...styles.filterBtn,
                ...(activeCategory === cat ? styles.filterBtnActive : {}),
              }}
              onClick={() => setActiveCategory(cat)}
            >
              {t(`showcase.categories.${cat}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">{t('common.loading')}</span>
          </div>
        ) : showcases.length > 0 ? (
          <div style={styles.grid} className="showcase-grid">
            {showcases.map(item => (
              <Link
                key={item.id}
                to={`/explore/${item.id}`}
                style={styles.card}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                }}
              >
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={lang === 'cn' ? (item.title_cn || item.title_en) : item.title_en}
                    style={styles.cardImage}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div style={styles.placeholder}>
                    {categoryIcons[item.category] || '\u{1F3D4}'}
                  </div>
                )}
                <div style={styles.cardBody}>
                  <div style={styles.cardCategory}>
                    {t(`showcase.categories.${item.category}`)}
                  </div>
                  <h3 style={styles.cardTitle}>
                    {lang === 'cn' ? (item.title_cn || item.title_en) : item.title_en}
                  </h3>
                  <p style={styles.cardSummary}>
                    {lang === 'cn' ? (item.summary_cn || item.summary_en) : item.summary_en}
                  </p>
                </div>
                <div style={styles.cardFooter}>
                  <span style={styles.learnMore}>
                    {t('showcase.viewDetails')} &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">{'\u{1F3D4}'}</div>
            <p className="empty-state-text">{t('showcase.noShowcases')}</p>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .showcase-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .showcase-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
