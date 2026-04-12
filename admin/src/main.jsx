// ============================================================
// 관리자 콘솔 프론트엔드 진입점
// ------------------------------------------------------------
// 사용자 프론트와 별도로 돌아가는 관리자 전용 SPA 의 마운트 지점.
// BrowserRouter > AuthProvider > App 순서로 감싼다.
// ============================================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
