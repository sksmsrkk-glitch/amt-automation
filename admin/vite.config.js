// ============================================================
// 관리자 콘솔 Vite 설정
// ------------------------------------------------------------
// 고객 프론트(3000)와 포트 충돌을 피하기 위해 3001 에서 실행된다.
// /api 와 /uploads 는 동일하게 백엔드(4000)로 프록시된다.
// ============================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000'
    }
  }
})
