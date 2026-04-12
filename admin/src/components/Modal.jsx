// ============================================================
// Modal - 공통 모달 다이얼로그
// ------------------------------------------------------------
// props:
//   - isOpen: 표시 여부
//   - onClose: 배경 클릭/ESC 시 호출되는 닫기 핸들러
//   - title: 상단 제목
//   - size: 'sm' | 'md' | 'lg' | 'xl'
//   - footer: 하단 버튼 영역(선택)
// ESC 키로도 닫힌다.
// ============================================================

import React, { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
