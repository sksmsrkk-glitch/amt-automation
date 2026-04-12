// ============================================================
// 관리자 콘솔 인증 컨텍스트
// ------------------------------------------------------------
// - 로그인 성공 후 role === 'admin' 인지 한 번 더 검증
// - 토큰/사용자를 localStorage('admin_token', 'admin_user')에 저장
//   (고객 프론트와 별도 키를 써서 서로 간섭하지 않도록 분리)
// - 로그아웃 시 두 값 모두 제거
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // 새로고침 시 로컬스토리지에서 이전 세션 복원. admin 역할이 아닌 경우 즉시 제거.
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    const savedUser = localStorage.getItem('admin_user')
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        if (parsed.role === 'admin') {
          setToken(savedToken)
          setUser(parsed)
        } else {
          // 관리자 권한이 없는 세션은 무효화
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
        }
      } catch {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
      }
    }
    setLoading(false)
  }, [])

  // 이메일/비밀번호로 로그인. admin 역할이 아니면 에러를 던진다.
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Login failed')
    }
    if (data.user?.role !== 'admin') {
      throw new Error('Access denied. Admin privileges required.')
    }
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('admin_token', data.token)
    localStorage.setItem('admin_user', JSON.stringify(data.user))
    return data
  }

  // 로그아웃: 세션 상태와 저장된 토큰/사용자 정보를 모두 비운다
  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
