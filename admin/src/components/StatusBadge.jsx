// ============================================================
// StatusBadge - 상태 표시용 작은 배지
// ------------------------------------------------------------
// 예약 상태(pending/confirmed/cancelled/refunded) 등을 컬러 배지로 표현.
// props: { status } - 문자열 키를 받아 대응되는 CSS 클래스를 적용.
// ============================================================

import React from 'react'

const statusClassMap = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-confirmed',
  cancelled: 'badge-cancelled',
  canceled: 'badge-cancelled',
  refunded: 'badge-refunded',
  paid: 'badge-paid',
  unpaid: 'badge-unpaid',
  failed: 'badge-failed',
  active: 'badge-active',
  inactive: 'badge-inactive',
  used: 'badge-used',
  expired: 'badge-cancelled',
  processing: 'badge-pending',
}

export default function StatusBadge({ status, type }) {
  if (!status) return <span className="badge badge-inactive">N/A</span>
  const normalized = status.toLowerCase().replace(/[^a-z]/g, '')
  const className = statusClassMap[normalized] || 'badge-inactive'

  return <span className={`badge ${className}`}>{status}</span>
}
