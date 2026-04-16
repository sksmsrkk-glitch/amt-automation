// ============================================================================
// ShowcaseDetail — 리조트 소개 콘텐츠 상세 페이지 (/explore/:id)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - GET /showcases/:id 로 개별 콘텐츠 로드
//   - 유튜브 영상 임베딩 (youtube_url 이 있을 때)
//   - 이미지 갤러리 (라이트박스 포함)
//   - 리치 텍스트 콘텐츠 렌더링 (HTML)
//   - 다국어 지원 (en/cn)
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'

const styles = {
  page: {
    paddingTop: 'calc(var(--header-height) + 40px)',
    minHeight: '80vh',
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 20px 60px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--primary)',
    textDecoration: 'none',
    marginBottom: '24px',
    transition: 'var(--transition)',
  },
  category: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    lineHeight: 1.2,
    marginBottom: '12px',
  },
  summary: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '32px',
  },
  videoSection: {
    marginBottom: '40px',
  },
  sectionLabel: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  videoWrapper: {
    position: 'relative',
    paddingBottom: '56.25%',
    height: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
  },
  videoIframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  gallerySection: {
    marginBottom: '40px',
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  galleryThumb: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '2px solid transparent',
  },
  galleryPlaceholder: {
    width: '100%',
    aspectRatio: '1',
    background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
  },
  contentSection: {
    marginBottom: '40px',
  },
  richContent: {
    fontSize: '1rem',
    lineHeight: 1.8,
    color: 'var(--text-primary)',
  },
  lightbox: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.9)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '90vh',
    objectFit: 'contain',
    borderRadius: '8px',
  },
  lightboxClose: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxNav: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    fontSize: '2rem',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

/**
 * 유튜브 URL 에서 video ID 를 추출한다.
 * 지원 형식: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 */
function extractYoutubeId(url) {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export default function ShowcaseDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const [showcase, setShowcase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const lang = i18n.language === 'cn' ? 'cn' : 'en'

  useEffect(() => {
    const fetchShowcase = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await get(`/showcases/${id}`)
        setShowcase(res.showcase)
      } catch (err) {
        setError(err.data?.error || 'Failed to load content.')
      } finally {
        setLoading(false)
      }
    }
    fetchShowcase()
  }, [id])

  if (loading) {
    return (
      <div style={styles.page}>
        <div className="loading-container" style={{ minHeight: '60vh' }}>
          <div className="spinner" />
          <span className="loading-text">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  if (error || !showcase) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div className="empty-state">
            <div className="empty-state-icon">{'\u{1F6AB}'}</div>
            <p className="empty-state-text">{error || 'Content not found.'}</p>
            <Link to="/explore" style={{ ...styles.backLink, marginTop: '16px' }}>
              &larr; {t('showcase.backToList')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const titleText = lang === 'cn' ? (showcase.title_cn || showcase.title_en) : showcase.title_en
  const summaryText = lang === 'cn' ? (showcase.summary_cn || showcase.summary_en) : showcase.summary_en
  const contentHtml = lang === 'cn' ? (showcase.content_cn || showcase.content_en) : showcase.content_en
  const images = Array.isArray(showcase.images) ? showcase.images : []
  const youtubeId = extractYoutubeId(showcase.youtube_url)

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Back link */}
        <Link
          to="/explore"
          style={styles.backLink}
          onMouseEnter={e => { e.target.style.opacity = '0.7' }}
          onMouseLeave={e => { e.target.style.opacity = '1' }}
        >
          &larr; {t('showcase.backToList')}
        </Link>

        {/* Category */}
        <div style={styles.category}>
          {t(`showcase.categories.${showcase.category}`)}
        </div>

        {/* Title */}
        <h1 style={styles.title}>{titleText}</h1>

        {/* Summary */}
        {summaryText && <p style={styles.summary}>{summaryText}</p>}

        {/* YouTube Video */}
        {youtubeId && (
          <div style={styles.videoSection}>
            <h2 style={styles.sectionLabel}>
              {'\u{25B6}\uFE0F'} {t('showcase.video')}
            </h2>
            <div style={styles.videoWrapper}>
              <iframe
                style={styles.videoIframe}
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title={titleText}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Image Gallery */}
        {images.length > 0 && (
          <div style={styles.gallerySection}>
            <h2 style={styles.sectionLabel}>
              {'\u{1F4F7}'} {t('showcase.gallery')} ({images.length})
            </h2>
            <div style={styles.galleryGrid} className="gallery-grid">
              {images.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${titleText} ${i + 1}`}
                  style={styles.galleryThumb}
                  onClick={() => setLightboxIndex(i)}
                  onMouseEnter={e => {
                    e.target.style.transform = 'scale(1.05)'
                    e.target.style.borderColor = 'var(--primary)'
                  }}
                  onMouseLeave={e => {
                    e.target.style.transform = 'scale(1)'
                    e.target.style.borderColor = 'transparent'
                  }}
                  onError={e => {
                    e.target.style.display = 'none'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rich Text Content */}
        {contentHtml && (
          <div style={styles.contentSection}>
            <div
              style={styles.richContent}
              className="showcase-rich-content"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex >= 0 && lightboxIndex < images.length && (
        <div
          style={styles.lightbox}
          onClick={() => setLightboxIndex(-1)}
        >
          <button
            style={styles.lightboxClose}
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(-1) }}
          >
            {'\u2715'}
          </button>

          {images.length > 1 && (
            <>
              <button
                style={{ ...styles.lightboxNav, left: '20px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)
                }}
              >
                {'\u2039'}
              </button>
              <button
                style={{ ...styles.lightboxNav, right: '20px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex((lightboxIndex + 1) % images.length)
                }}
              >
                {'\u203A'}
              </button>
            </>
          )}

          <img
            src={images[lightboxIndex]}
            alt={`${titleText} ${lightboxIndex + 1}`}
            style={styles.lightboxImg}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <style>{`
        .showcase-rich-content h2 {
          font-size: 1.4rem;
          font-weight: 700;
          margin: 24px 0 12px;
          color: var(--text-primary);
        }
        .showcase-rich-content h3 {
          font-size: 1.15rem;
          font-weight: 600;
          margin: 20px 0 10px;
          color: var(--text-primary);
        }
        .showcase-rich-content p {
          margin: 0 0 16px;
        }
        .showcase-rich-content ul, .showcase-rich-content ol {
          margin: 0 0 16px;
          padding-left: 24px;
        }
        .showcase-rich-content li {
          margin-bottom: 6px;
        }
        .showcase-rich-content img {
          max-width: 100%;
          border-radius: 8px;
          margin: 12px 0;
        }
        @media (max-width: 768px) {
          .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
