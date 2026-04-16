// ============================================================================
// Admin — ShowcaseManagement 페이지
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 리조트 소개 콘텐츠(showcase) 의 CRUD 목록을 제공한다.
//   2) 생성/수정 모달에서 다국어(EN/CN) 탭 에디터를 제공한다.
//   3) 이미지 업로더, 유튜브 URL 입력, 카테고리/상태 관리를 지원한다.
//   4) 드래그 없이 sort_order 숫자 입력으로 노출 순서를 관리한다.
//
// 렌더 위치: admin/App.jsx → /showcases 라우트.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import StatusBadge from '../components/StatusBadge'

const CATEGORIES = [
  { value: 'facility', label: 'Facilities' },
  { value: 'activity', label: 'Activities' },
  { value: 'dining', label: 'Dining' },
  { value: 'event', label: 'Events' },
  { value: 'nature', label: 'Nature' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
]

const emptyForm = {
  title_en: '', title_cn: '',
  summary_en: '', summary_cn: '',
  content_en: '', content_cn: '',
  thumbnail_url: '', images: [],
  youtube_url: '', category: 'facility',
  sort_order: 0, status: 'draft',
}

const styles = {
  page: { padding: '24px' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '24px', flexWrap: 'wrap', gap: '16px',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' },
  addBtn: {
    padding: '10px 20px', borderRadius: '8px', border: 'none',
    background: '#3b82f6', color: '#fff', fontSize: '0.9rem',
    fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
  },
  filters: {
    display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
  },
  filterSelect: {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
    fontSize: '0.85rem', background: '#fff', cursor: 'pointer',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', background: '#fff',
    borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  th: {
    padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem',
    fontWeight: 600, color: '#64748b', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
    fontSize: '0.9rem', color: '#334155', verticalAlign: 'middle',
  },
  thumbImg: {
    width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px',
    background: '#f1f5f9',
  },
  thumbPlaceholder: {
    width: '60px', height: '40px', borderRadius: '4px', background: '#f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem',
  },
  actionBtn: {
    padding: '6px 12px', borderRadius: '4px', border: '1px solid #e2e8f0',
    background: '#fff', color: '#334155', fontSize: '0.8rem', cursor: 'pointer',
    marginRight: '6px', transition: 'all 0.2s',
  },
  deleteBtn: {
    padding: '6px 12px', borderRadius: '4px', border: '1px solid #fecaca',
    background: '#fff', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  // Modal form styles
  formGrid: { display: 'grid', gap: '16px' },
  langTabs: {
    display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #e2e8f0',
  },
  langTab: {
    padding: '10px 24px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
    border: 'none', background: 'none', color: '#94a3b8',
    borderBottom: '2px solid transparent', marginBottom: '-2px',
    transition: 'all 0.2s',
  },
  langTabActive: {
    color: '#3b82f6', borderBottomColor: '#3b82f6',
  },
  label: {
    fontSize: '0.85rem', fontWeight: 600, color: '#334155',
    marginBottom: '4px', display: 'block',
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #e2e8f0', fontSize: '0.9rem', minHeight: '80px',
    resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
  },
  richTextarea: {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #e2e8f0', fontSize: '0.9rem', minHeight: '200px',
    resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  hint: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' },
  previewBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '16px', marginTop: '8px', fontSize: '0.9rem', lineHeight: 1.6,
  },
  orderInput: {
    width: '60px', padding: '4px 8px', borderRadius: '4px',
    border: '1px solid #e2e8f0', fontSize: '0.85rem', textAlign: 'center',
  },
}

export default function ShowcaseManagement() {
  const [showcases, setShowcases] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [langTab, setLangTab] = useState('en')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [contentPreview, setContentPreview] = useState(false)

  const fetchShowcases = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      if (filterStatus) params.set('status', filterStatus)
      const qs = params.toString()
      const res = await get(`/admin/showcases${qs ? '?' + qs : ''}`)
      setShowcases(res.showcases || [])
    } catch (err) {
      console.error('Failed to fetch showcases:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterStatus])

  useEffect(() => { fetchShowcases() }, [fetchShowcases])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setLangTab('en')
    setContentPreview(false)
    setModalOpen(true)
  }

  const openEdit = (showcase) => {
    setEditing(showcase)
    setForm({
      title_en: showcase.title_en || '',
      title_cn: showcase.title_cn || '',
      summary_en: showcase.summary_en || '',
      summary_cn: showcase.summary_cn || '',
      content_en: showcase.content_en || '',
      content_cn: showcase.content_cn || '',
      thumbnail_url: showcase.thumbnail_url || '',
      images: Array.isArray(showcase.images) ? showcase.images : [],
      youtube_url: showcase.youtube_url || '',
      category: showcase.category || 'facility',
      sort_order: showcase.sort_order ?? 0,
      status: showcase.status || 'draft',
    })
    setLangTab('en')
    setContentPreview(false)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title_en.trim()) {
      alert('English title is required.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await put(`/admin/showcases/${editing.id}`, form)
      } else {
        await post('/admin/showcases', form)
      }
      setModalOpen(false)
      fetchShowcases()
    } catch (err) {
      alert('Failed to save: ' + (err.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this showcase?')) return
    try {
      await del(`/admin/showcases/${id}`)
      fetchShowcases()
    } catch (err) {
      alert('Failed to delete: ' + (err.data?.error || err.message))
    }
  }

  const handleToggleStatus = async (showcase) => {
    const newStatus = showcase.status === 'published' ? 'draft' : 'published'
    try {
      await put(`/admin/showcases/${showcase.id}`, { status: newStatus })
      fetchShowcases()
    } catch (err) {
      alert('Failed to update status: ' + (err.data?.error || err.message))
    }
  }

  const handleOrderChange = async (id, newOrder) => {
    try {
      await put(`/admin/showcases/${id}`, { sort_order: parseInt(newOrder) || 0 })
      fetchShowcases()
    } catch (err) {
      console.error('Failed to update order:', err)
    }
  }

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Showcase Management</h1>
        <button
          style={styles.addBtn}
          onClick={openCreate}
          onMouseEnter={e => { e.target.style.background = '#2563eb' }}
          onMouseLeave={e => { e.target.style.background = '#3b82f6' }}
        >
          + New Showcase
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select
          style={styles.filterSelect}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          style={styles.filterSelect}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ color: '#94a3b8', marginTop: '12px' }}>Loading...</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Order</th>
              <th style={styles.th}>Thumbnail</th>
              <th style={styles.th}>Title (EN)</th>
              <th style={styles.th}>Title (CN)</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {showcases.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                  No showcases found. Click "+ New Showcase" to create one.
                </td>
              </tr>
            ) : (
              showcases.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}>
                    <input
                      type="number"
                      style={styles.orderInput}
                      value={s.sort_order}
                      onChange={e => {
                        const val = e.target.value
                        setShowcases(prev => prev.map(item =>
                          item.id === s.id ? { ...item, sort_order: parseInt(val) || 0 } : item
                        ))
                      }}
                      onBlur={e => handleOrderChange(s.id, e.target.value)}
                      min="0"
                    />
                  </td>
                  <td style={styles.td}>
                    {s.thumbnail_url ? (
                      <img src={s.thumbnail_url} alt="" style={styles.thumbImg} />
                    ) : (
                      <div style={styles.thumbPlaceholder}>{'\u{1F5BC}'}</div>
                    )}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 600, maxWidth: '200px' }}>
                    {s.title_en || '-'}
                  </td>
                  <td style={{ ...styles.td, maxWidth: '200px' }}>
                    {s.title_cn || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem',
                      fontWeight: 600, background: '#eff6ff', color: '#3b82f6',
                    }}>
                      {CATEGORIES.find(c => c.value === s.category)?.label || s.category}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={s.status === 'published' ? 'active' : 'inactive'} />
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.actionBtn}
                      onClick={() => openEdit(s)}
                      onMouseEnter={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.color = '#3b82f6' }}
                      onMouseLeave={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#334155' }}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={() => handleToggleStatus(s)}
                      onMouseEnter={e => { e.target.style.borderColor = '#10b981'; e.target.style.color = '#10b981' }}
                      onMouseLeave={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#334155' }}
                    >
                      {s.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(s.id)}
                      onMouseEnter={e => { e.target.style.background = '#fef2f2' }}
                      onMouseLeave={e => { e.target.style.background = '#fff' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Showcase' : 'New Showcase'}
        size="xl"
      >
        <div style={styles.formGrid}>
          {/* Language Tabs */}
          <div style={styles.langTabs}>
            <button
              style={{ ...styles.langTab, ...(langTab === 'en' ? styles.langTabActive : {}) }}
              onClick={() => setLangTab('en')}
            >
              English
            </button>
            <button
              style={{ ...styles.langTab, ...(langTab === 'cn' ? styles.langTabActive : {}) }}
              onClick={() => setLangTab('cn')}
            >
              中文 (Chinese)
            </button>
          </div>

          {/* Title */}
          <div>
            <label style={styles.label}>
              Title ({langTab === 'en' ? 'English' : 'Chinese'})
              {langTab === 'en' && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            <input
              style={styles.input}
              value={langTab === 'en' ? form.title_en : form.title_cn}
              onChange={e => updateForm(langTab === 'en' ? 'title_en' : 'title_cn', e.target.value)}
              placeholder={langTab === 'en' ? 'Enter English title' : '请输入中文标题'}
            />
          </div>

          {/* Summary */}
          <div>
            <label style={styles.label}>
              Summary ({langTab === 'en' ? 'English' : 'Chinese'})
            </label>
            <textarea
              style={styles.textarea}
              value={langTab === 'en' ? form.summary_en : form.summary_cn}
              onChange={e => updateForm(langTab === 'en' ? 'summary_en' : 'summary_cn', e.target.value)}
              placeholder={langTab === 'en' ? 'Brief description for the card' : '卡片简要描述'}
            />
          </div>

          {/* Content (Rich Text HTML) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={styles.label}>
                Content ({langTab === 'en' ? 'English' : 'Chinese'}) — HTML
              </label>
              <button
                style={{
                  ...styles.actionBtn, fontSize: '0.75rem', padding: '4px 10px',
                }}
                onClick={() => setContentPreview(!contentPreview)}
              >
                {contentPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {contentPreview ? (
              <div
                style={styles.previewBox}
                dangerouslySetInnerHTML={{
                  __html: langTab === 'en' ? form.content_en : form.content_cn
                }}
              />
            ) : (
              <textarea
                style={styles.richTextarea}
                value={langTab === 'en' ? form.content_en : form.content_cn}
                onChange={e => updateForm(langTab === 'en' ? 'content_en' : 'content_cn', e.target.value)}
                placeholder={langTab === 'en'
                  ? '<h2>Section Title</h2>\n<p>Content goes here...</p>\n<ul><li>Item 1</li></ul>'
                  : '<h2>标题</h2>\n<p>内容...</p>\n<ul><li>项目1</li></ul>'
                }
              />
            )}
            <p style={styles.hint}>
              Supports HTML tags: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;img&gt;
            </p>
          </div>

          {/* Thumbnail */}
          <div>
            <label style={styles.label}>Thumbnail Image</label>
            <ImageUploader
              images={form.thumbnail_url ? [form.thumbnail_url] : []}
              onChange={(urls) => updateForm('thumbnail_url', urls[0] || '')}
              maxImages={1}
            />
          </div>

          {/* Gallery Images */}
          <div>
            <label style={styles.label}>Gallery Images (up to 20)</label>
            <ImageUploader
              images={form.images}
              onChange={(urls) => updateForm('images', urls)}
              maxImages={20}
            />
          </div>

          {/* YouTube URL */}
          <div>
            <label style={styles.label}>YouTube Video URL</label>
            <input
              style={styles.input}
              value={form.youtube_url}
              onChange={e => updateForm('youtube_url', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p style={styles.hint}>
              Supported: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
            </p>
          </div>

          {/* Category + Sort Order + Status */}
          <div style={styles.row3}>
            <div>
              <label style={styles.label}>Category</label>
              <select
                style={styles.input}
                value={form.category}
                onChange={e => updateForm('category', e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Sort Order</label>
              <input
                type="number"
                style={styles.input}
                value={form.sort_order}
                onChange={e => updateForm('sort_order', parseInt(e.target.value) || 0)}
                min="0"
              />
              <p style={styles.hint}>Lower number = shown first</p>
            </div>
            <div>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={e => updateForm('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              style={{ ...styles.actionBtn, padding: '10px 24px' }}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              style={{ ...styles.addBtn, opacity: saving ? 0.7 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : (editing ? 'Update Showcase' : 'Create Showcase')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
