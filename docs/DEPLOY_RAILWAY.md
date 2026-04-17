# High1 Resort — Railway 배포 가이드

> 대상: 이 프로젝트를 Railway 에 처음 배포하는 개발자
> 전제: Supabase PostgreSQL 준비 완료 (→ [DATABASE_SETUP_GUIDE.md](./DATABASE_SETUP_GUIDE.md))

---

## 배포 아키텍처 요약

이 저장소는 **단일 Railway 서비스(Docker)** 에서 세 모듈을 한꺼번에 서빙합니다.

| 모듈 | 경로 | 빌드 결과 | 서빙 위치 |
|---|---|---|---|
| Backend API | `backend/` | - (Node.js 그대로 실행) | `/api/*` |
| 고객 Frontend | `frontend/` | `frontend/dist/` | `/` (SPA fallback) |
| Admin Panel | `admin/` | `admin/dist/` | `/admin/*` |

- 빌드: `Dockerfile` 에서 `npm install` → `frontend/admin` 빌드
- 실행: `node backend/src/index.js` 하나의 프로세스가 정적 파일까지 같이 서빙
- DB: 외부 Supabase PostgreSQL 을 `DATABASE_URL` 로 연결

---

## 필수 환경 변수

Railway 에서 **반드시 등록**해야 하는 변수입니다. 하나라도 빠지면 컨테이너가 기동 즉시 종료됩니다.

| 변수명 | 필수 여부 | 설명 | 획득 방법 |
|---|---|---|---|
| `DATABASE_URL` | **필수** | Supabase PostgreSQL 연결 문자열 | Supabase → Project Settings → Database → **Connection string (URI)** |
| `JWT_SECRET` | **필수(운영)** | JWT 서명용 시크릿 | 터미널에서 `openssl rand -hex 32` |
| `NODE_ENV` | 권장 | `production` 지정 시 auth 미들웨어가 시크릿 누락 시 FATAL | 값: `production` |
| `PORT` | 자동 | Railway 가 자동 주입 | - |

### DATABASE_URL 형식 예시

```
postgresql://postgres.xxxxxxxx:YOUR_PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```

> 비밀번호에 특수문자(`#`, `@`, `?` 등)가 있으면 **URL 인코딩** 필수.
> 예: `#` → `%23`, `@` → `%40`

---

## 배포 순서 (최초 1회)

### 1. Railway 프로젝트 생성

1. [Railway Dashboard](https://railway.app/dashboard) 로그인
2. **New Project** → **Deploy from GitHub repo** → 이 저장소 선택
3. Railway 가 자동으로 `railway.json` 을 감지하여 `Dockerfile` 기반 빌드 시작

### 2. 환경 변수 등록

1. 생성된 서비스 클릭 → 상단 **Variables** 탭
2. **+ New Variable** 로 아래 두 개 추가:
   ```
   DATABASE_URL = postgresql://postgres.xxx:PASSWORD@...supabase.com:6543/postgres?sslmode=require
   JWT_SECRET   = <openssl rand -hex 32 로 생성한 64자 hex 문자열>
   ```
3. (선택) `NODE_ENV = production` 추가
4. 저장하면 Railway 가 **자동 재배포**함

### 3. 공개 도메인 활성화

1. 서비스 → **Settings** → **Networking** 섹션
2. **Generate Domain** 클릭 → `<service>.up.railway.app` 도메인 자동 할당
3. 커스텀 도메인은 같은 화면에서 **Custom Domain** 으로 추가

### 4. 동작 확인

Railway 배포 로그(Deployments → 최신 배포 → View Logs)에서 다음 두 줄이 찍히면 성공:

```
[DB] PostgreSQL 연결 성공
High1 Resort Booking API server running on port 8080
```

브라우저에서 아래 URL 로 헬스체크:

```
https://<your-domain>/api/health
→ {"status":"ok","timestamp":"..."}
```

---

## 트러블슈팅

### 증상: `DATABASE_URL 환경 변수가 설정되지 않았습니다.` 로 재시작 반복

**원인**: Railway Variables 탭에 `DATABASE_URL` 이 등록되지 않음. (RAILWAY_* 메타 변수만 존재)

**해결**:
1. Railway 서비스 → Variables 탭에서 `DATABASE_URL` 이 **이 서비스에** 추가되어 있는지 확인
   - 프로젝트 전체(Shared Variables) 가 아닌 **개별 서비스** 에 등록해야 함
2. 추가 후 반드시 **Deployments → Redeploy** 또는 새 커밋 푸시로 재배포

### 증상: `password authentication failed for user "postgres"`

**원인**: `DATABASE_URL` 의 비밀번호가 잘못됐거나 URL 인코딩 누락.

**해결**:
1. Supabase → Database → **Reset database password** 로 비밀번호 재설정
2. 특수문자 포함 시 [URL encoder](https://www.urlencoder.org/) 로 인코딩
3. Supabase 의 **Connection pooling** 섹션에서 Transaction mode URL 사용 권장 (포트 6543)

### 증상: `self-signed certificate in certificate chain`

현재 코드는 `ssl: { rejectUnauthorized: false }` 로 이미 허용되어 있어 발생하지 않아야 함.
만약 발생하면 `backend/src/config/database.js` 의 Pool 옵션 변경 여부 확인.

### 증상: 빌드는 성공했는데 `/admin` 또는 루트 경로에서 404

**원인**: `frontend/dist` 또는 `admin/dist` 빌드 산출물이 비어 있음.

**해결**: Railway **Build Logs** 에서 `cd frontend && npm run build` 와 `cd admin && npm run build` 의 종료 코드가 0 인지 확인. 실패 시 해당 모듈의 `package.json` 의존성 확인.

---

## 재배포 체크리스트

커밋 푸시하면 Railway 가 자동 재배포합니다. 주요 이벤트에서 아래를 확인하세요.

- [ ] DB 스키마 변경 시: Supabase SQL Editor 에서 마이그레이션 먼저 적용
- [ ] 새 환경 변수 추가 시: Railway Variables 에도 동일 키 등록
- [ ] `package.json` 의존성 변경 시: `npm install` 로 lockfile 갱신 후 커밋
- [ ] Dockerfile 수정 시: 로컬에서 `docker build -t amt-test .` 로 빌드 성공 확인
- [ ] 배포 후: `/api/health` 응답 확인, 관리자 로그인 한 번 수행

---

## 참고 파일

- `Dockerfile` — 빌드 정의 (Node 20 slim 기반)
- `railway.json` — Railway 에 Dockerfile 빌더 사용 강제
- `.dockerignore` — 빌드 컨텍스트에서 제외할 파일
- `backend/src/config/database.js` — DATABASE_URL 로드 로직
- `backend/src/middleware/auth.js` — JWT_SECRET 검증 로직
