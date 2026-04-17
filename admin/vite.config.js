// ============================================================================
// High1 Resort Admin — Vite 설정
// ----------------------------------------------------------------------------
// base 경로 정책:
//   - build (프로덕션):  '/admin/'
//       backend Express 가 `/admin/*` 에서 이 SPA 를 서빙하므로,
//       번들된 정적 에셋 URL 이 `/admin/assets/...` 로 나와야 한다.
//   - dev (로컬):         '/'
//       Vite dev 서버는 포트 3001 을 단독 사용하므로 루트(`/`)에서 앱을
//       서빙해야 개발자가 http://localhost:3001 로 접속 시 바로 열린다.
//       (start.sh 안내 URL 과 일치)
//
// React Router 의 basename 도 `import.meta.env.BASE_URL` 을 통해 이 값을
// 자동 반영하므로, 여기만 바꾸면 클라이언트 라우팅까지 한 번에 정합성 유지.
// ============================================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 빌드 시에만 '/admin/' 프리픽스를 걸어 프로덕션 서빙 경로와 맞춘다.
  base: command === 'build' ? '/admin/' : '/',
  server: {
    port: 3001,
    proxy: {
      // API 호출은 backend(4000) 로 프록시.
      '/api': 'http://localhost:4000',
      // 업로드된 이미지 정적 파일도 backend 가 서빙.
      '/uploads': 'http://localhost:4000'
    }
  }
}))
