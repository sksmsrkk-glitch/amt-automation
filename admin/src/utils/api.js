// ============================================================
// 관리자 콘솔 API 헬퍼
// ------------------------------------------------------------
// 고객 프론트의 api.js 와 거의 동일하지만 차이점:
//   - 토큰 키가 'admin_token' (고객은 'token')
//   - 401 응답을 받으면 세션 만료로 간주해 로그인 페이지로 리다이렉트
//   - downloadFile: 파일(바우처/CSV 등) 다운로드 유틸
// ============================================================

const BASE = '/api'

// localStorage 에서 관리자 토큰 조회
function getToken() {
  return localStorage.getItem('admin_token')
}

// 공통 요청 헤더. 토큰이 있으면 Authorization 헤더를 덧붙인다.
function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) {
    h['Authorization'] = `Bearer ${token}`
  }
  return h
}

// 공통 요청 함수. 401 은 자동으로 세션 만료 처리 후 홈으로 이동.
async function request(method, path, body, options = {}) {
  const url = `${BASE}${path}`
  const config = {
    method,
    headers: headers(options.headers),
  }
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }
  const res = await fetch(url, config)
  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    window.location.href = '/'
    throw new Error('Session expired')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function get(path) {
  return request('GET', path)
}

export function post(path, body) {
  return request('POST', path, body)
}

export function put(path, body) {
  return request('PUT', path, body)
}

export function del(path) {
  return request('DELETE', path)
}

// 파일 다운로드 - 토큰을 헤더에 실어서 파일을 받고 브라우저에 저장시킨다
export async function downloadFile(path, filename) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default { get, post, put, del, downloadFile }
