# High1 Resort 예약 플랫폼 배포용 Dockerfile
# Railway/Render 등 컨테이너 기반 배포 플랫폼에서 빌드·실행에 사용.
#
# 빌드 흐름:
#   1) Node 20 slim 이미지를 베이스로 사용
#   2) backend / frontend / admin 각각의 의존성 설치
#   3) frontend / admin 프로덕션 빌드 생성 (dist/ 디렉터리)
#   4) backend Express 서버가 빌드 결과를 정적 파일로 서빙

FROM node:20-slim

WORKDIR /app

# 루트 package.json (스크립트 용)
COPY package.json ./

# Backend 의존성
# npm ci 는 package-lock.json 기준으로 정확히 설치한다.
# lockfile 과 package.json 이 어긋나면 즉시 실패하여 드리프트를 빌드 단계에서
# 감지할 수 있다 (과거 pg 누락 이슈 재발 방지).
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --include=dev

# Frontend 의존성
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci --include=dev

# Admin 의존성
COPY admin/package.json admin/package-lock.json* ./admin/
RUN cd admin && npm ci --include=dev

# 전체 소스 복사
COPY . .

# Frontend / Admin 빌드
RUN cd frontend && npm run build
RUN cd admin && npm run build

# Railway 가 PORT 환경변수를 주입함. 기본값은 4000.
ENV PORT=4000
EXPOSE 4000

# 백엔드 서버 시작 (정적 파일 서빙 포함)
CMD ["node", "backend/src/index.js"]
