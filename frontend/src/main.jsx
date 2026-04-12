// ============================================================
// 사용자(고객용) 프론트엔드 진입점
// ------------------------------------------------------------
// React 앱 마운트 지점. BrowserRouter(라우팅) > AuthProvider(인증)
// 순서로 감싸고, i18n 번역 설정과 전역 CSS 를 로드한다.
// ============================================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './i18n'
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
