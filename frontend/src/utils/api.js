// ============================================================
// 사용자 프론트엔드 API 헬퍼
// ------------------------------------------------------------
// fetch 기반의 얇은 래퍼. 다음을 자동 처리한다:
//   - JSON Content-Type 설정
//   - localStorage 의 token 이 있으면 Authorization 헤더 자동 추가
//   - 2xx 가 아니면 에러 객체(status/data 포함)를 던짐
//   - 204 No Content 는 null 반환
// Vite dev server 의 프록시 설정을 통해 "/api" 가 백엔드(4000)로 전달된다.
// ============================================================

const BASE_URL = '/api'

// 공통 요청 함수. GET/POST/PUT/DELETE 헬퍼가 모두 이 함수를 사용한다.
async function request(url, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // 로그인 상태라면 Bearer 토큰 자동 첨부
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  })

  // 에러 응답은 JSON 본문이 있을 수도 없을 수도 있다
  if (!response.ok) {
    let errorData
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: `HTTP error ${response.status}` }
    }
    const error = new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`)
    error.status = response.status
    error.data = errorData
    throw error
  }

  // DELETE 성공 응답이 본문 없이 204 로 오는 경우
  if (response.status === 204) {
    return null
  }

  return response.json()
}

// GET 요청 (body 없음)
export function get(url) {
  return request(url, { method: 'GET' })
}

// POST 요청 (body 는 JSON 직렬화해서 전송)
export function post(url, body) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

// PUT 요청 (부분/전체 업데이트 공용)
export function put(url, body) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

// DELETE 요청
export function del(url) {
  return request(url, { method: 'DELETE' })
}
