// ============================================================
// 사용자 프론트엔드 Vite 설정
// ------------------------------------------------------------
// 개발 서버는 3000 포트에서 실행되며, /api 와 /uploads 요청은
// 백엔드(localhost:4000)로 프록시되어 CORS 이슈를 피한다.
// ============================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 프론트에서 /api/* 로 호출하면 백엔드로 전달된다
      '/api': 'http://localhost:4000',
      // 업로드된 이미지 접근도 동일하게 프록시
      '/uploads': 'http://localhost:4000'
    }
  }
})
