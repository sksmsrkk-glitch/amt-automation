// ============================================================
// 사용자 프론트엔드 인증 컨텍스트
// ------------------------------------------------------------
// 로그인 상태, 토큰, 사용자 정보를 앱 전역에 제공한다.
// - 토큰은 localStorage 에 보관하고 새로고침 시 자동 복원
// - 초기 마운트 시 /auth/me 로 사용자 정보 검증
// - login/register/logout/updateProfile 메서드 제공
// 사용법: const { user, login, logout } = useAuth()
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { post, get, put } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // localStorage 에서 이전 세션 토큰을 복원
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // 토큰이 있으면 /auth/me 로 사용자 정보를 가져와 유효성 확인
  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await get('/auth/me')
      setUser(data.user || data)
    } catch (err) {
      console.error('Failed to fetch user:', err)
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // 이메일/비밀번호로 로그인하고 토큰/사용자를 저장
  const login = async (email, password) => {
    const data = await post('/auth/login', { email, password })
    const newToken = data.token
    const userData = data.user
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(userData)
    return data
  }

  // 회원가입 성공 시 받은 토큰으로 자동 로그인 처리
  const register = async (formData) => {
    const data = await post('/auth/register', formData)
    const newToken = data.token
    const userData = data.user
    if (newToken) {
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setUser(userData)
    }
    return data
  }

  // 로그아웃: 로컬 토큰과 사용자 상태를 지운다
  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  // 프로필(이름/전화/국적/언어) 부분 업데이트
  const updateProfile = async (profileData) => {
    const data = await put('/auth/profile', profileData)
    setUser(data.user || data)
    return data
  }

  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// 하위 컴포넌트에서 인증 상태를 쉽게 꺼내 쓰기 위한 훅
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
