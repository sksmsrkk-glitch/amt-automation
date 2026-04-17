# High1 Resort — 개발 & 배포 워크플로우

> 대상: 이 저장소에서 기능 추가 · 수정 · 외부 API 연동 · 배포를 수행하는 개발자
> 목적: 로컬 개발부터 프로덕션 배포까지 **반복 가능한 사이클**과 **자주 빠지는 함정**을 한 문서에 정리

이 문서는 실제 이 저장소에서 발생한 배포 장애들 (pg 모듈 누락, Docker 빌드 캐시, async/await 누락, Railway env 설정 등)을 겪고 학습한 결과를 반영합니다.

---

## 전체 흐름 한눈에

```
[로컬 개발] → [로컬 테스트] → [커밋 & 푸시] → [PR 생성]
  → [PR 병합] → [Railway 자동 배포] → [프로덕션 확인]
```

---

## STEP 0 — 최초 1회 세팅

```bash
# 저장소 클론 후
cd amt-automation
git checkout main
git pull origin main

# 의존성 설치 (3개 프로젝트 각각)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd admin && npm install && cd ..
```

### 로컬 환경 변수 파일 생성

`backend/.env` 파일을 만든다 (이 파일은 `.gitignore` 에 있어 커밋되지 않음):

```
DATABASE_URL=postgresql://postgres:<pw>@<host>.supabase.com:5432/postgres
JWT_SECRET=<openssl rand -hex 32 결과, 또는 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 운영 DB 와 로컬 DB 는 분리할 것

- **Supabase 에 로컬 개발용 프로젝트를 별도로** 생성하는 것을 강력 권장
- 로컬 테스트가 운영 데이터를 오염시키지 않도록
- `backend/.env` 는 로컬용 DB, Railway Variables 는 운영용 DB

---

## STEP 1 — 새 기능 작업 시작

### 1-1. 최신 main 동기화

```bash
git checkout main
git pull origin main
```

### 1-2. 기능 브랜치 생성

```bash
# 브랜치 이름: type/간단한-설명 형태
git checkout -b feat/booking-email-notification
git checkout -b fix/payment-timezone-bug
git checkout -b chore/upgrade-express-5
```

**MAIN 브랜치에서 직접 작업 금지**. 실수로 main 에 커밋하면 복구가 번거롭고 배포가 예상 못한 상태로 나갈 위험.

---

## STEP 2 — 코드 작성

### 파일을 어디에 두는가 (실제 저장소 구조)

| 작업 종류 | 위치 |
|---|---|
| 공개 API 엔드포인트 | `backend/src/routes/*.js` |
| 관리자 전용 API | `backend/src/routes/admin/*.js` |
| DB 연결 / 쿼리 래퍼 | `backend/src/config/database.js` (수정 지양) |
| JWT · 권한 미들웨어 | `backend/src/middleware/*.js` |
| 외부 API 호출 로직 | `backend/src/services/` (없으면 새로 만들고, 라우트에서 얇게 import) |
| 고객 페이지 | `frontend/src/pages/` |
| 어드민 페이지 | `admin/src/pages/` |
| 재사용 컴포넌트 | `frontend/src/components/` / `admin/src/components/` |
| 번역 리소스 | `frontend/src/i18n/` (**영어 + 중국어 반드시 동시 업데이트**) |
| 시드 데이터 | `backend/src/seed.js` (로컬/개발 DB 전용) |

### 기존 패턴 먼저 확인

새 파일 만들기 전에 같은 종류의 **기존 파일을 먼저 열어**서 스타일·구조를 맞춘다:

- 새 라우트 → `backend/src/routes/hotels.js` 같은 기존 라우트 참고
- 새 어드민 페이지 → `admin/src/pages/HotelManagement.jsx` 같은 기존 페이지 참고
- DB 쿼리 → 기존 `await db.prepare('...').get/all/run(...)` 패턴 그대로

### 반복 실수 체크리스트

```
□ DB 쿼리 호출 시 await 붙였는가?                       ← async/await 누락은 silent fail
□ package.json 에 의존성 추가했으면 npm install 로 
  lockfile (package-lock.json) 도 함께 갱신했는가?       ← Docker 빌드에서 터짐
□ 프론트 문자열 추가 시 i18n 영어/중국어 모두 넣었는가?    ← 외국인 전용 사이트
□ 인증 필요 엔드포인트에 authenticate 미들웨어 붙였는가?   ← 권한 경계 방어
□ 관리자 전용이면 requireAdmin 도 붙였는가?              ← RBAC
□ 응답에서 password 등 민감 컬럼이 제외됐는가?           ← 정보 유출
□ 에러 응답을 { error: "..." } 형식으로 통일했는가?       ← 프론트 fetch wrapper 규약
□ DB 의 JSON TEXT 컬럼(images/amenities 등)을 응답 전에
  JSON.parse 로 배열로 디코딩했는가?                    ← 프론트 .map() 크래시 → 화이트스크린
□ JSX { flag && <X/> } 의 flag 가 integer 아닌가?       ← DB 0/1 을 그대로 쓰면 "0" 이 화면에 찍힘
   ├ 금지: {data.is_featured && <Badge/>}                   (0 → "0" 렌더)
   └ 권장: {Boolean(data.is_featured) && <Badge/>}          또는 data.is_featured === 1
     * false/null/undefined 만 스킵. number 0, NaN, 빈 문자열은 텍스트로 그대로 렌더됨.
□ `await db.prepare(sql).get(...).field` 괄호 위치 점검     ← 연산자 우선순위로 promise.field = undefined
   ├ 금지: const t = await db.prepare(...).get(...).total       (t = undefined)
   └ 권장: const t = (await db.prepare(...).get(...)).total
```

### 코딩 스타일 (이 저장소 관습)

- 함수·파일 상단에 **한국어 헤더 주석** (어떤 역할·누가 부르나·주의점)
- 주석은 **왜** 이렇게 했는지 위주 (무엇은 코드가 보여준다)
- 변수명은 영어
- DB 쿼리는 `backend/src/config/database.js` 의 래퍼를 통과 (절대 pg 를 직접 import 하지 말 것)

---

## STEP 3 — 로컬 테스트

### 3-1. 전체 실행

```bash
./start.sh
```

- 백엔드: http://localhost:4000
- 고객 사이트: http://localhost:3000
- 어드민: http://localhost:3001

개별 실행이 필요하면:

```bash
cd backend && npm start           # 백엔드만
cd frontend && npm run dev        # 고객 프론트만
cd admin && npm run dev           # 어드민만
```

### 3-2. DB 초기화가 필요하면 (로컬 DB 한정)

```bash
cd backend && npm run seed
```

⚠ **절대 운영 DATABASE_URL 로 seed 실행 금지** — 기존 데이터가 DELETE 된다.

### 3-3. 테스트 시나리오

1. **골든 패스** — 기능이 의도한 정상 플로우로 끝까지 동작하는지
   (로그인 → 조회 → 생성 → 수정 → 삭제 or 목표 동작)
2. **엣지 케이스** — 빈 값, 잘못된 값, 비로그인, 권한 없는 사용자
3. **회귀 확인** — 수정한 부분의 **주변 기능이 깨지지 않았는지**
4. **F12 개발자 도구 확인** — Console 에러 없는지, Network 탭의 응답 상태 코드
5. **다국어** — 영어/중국어 언어 전환 모두 깨지지 않는지

### 3-4. 종료

```bash
./stop.sh
```

---

## STEP 4 — 커밋 & 푸시

### 4-1. 변경사항 리뷰

```bash
git status
git diff                          # 수정된 내용 전체
git diff --stat                   # 파일별 라인 수
```

### 4-2. 의미 있는 단위로 스테이징

```bash
# ❌ 금지: git add .
#   → .env 나 큰 바이너리가 실수로 포함될 위험
# ✅ 권장: 경로를 명시
git add backend/src/routes/bookings.js frontend/src/pages/Checkout.jsx
```

### 4-3. 커밋 메시지 스타일 (이 저장소 관습)

형식: `type(scope): 짧은 한 줄 설명`

| type | 의미 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `chore` | 의존성/설정/빌드 관련 잡일 |
| `docs` | 문서만 변경 |
| `refactor` | 동작 변화 없이 구조/네이밍 개선 |
| `test` | 테스트 추가/수정 |

예시:

```bash
git commit -m "feat(booking): add email confirmation after successful payment

- Stripe 결제 성공 webhook 수신 시 guest_email 로 예약 확정 메일 발송
- SendGrid API 사용 (Railway Variables 에 SENDGRID_API_KEY 등록 필요)
- 템플릿은 backend/src/emails/confirmation-en.html, -cn.html 로 분리"
```

**본문에는 "왜" 를 쓴다** — "무엇을 바꿨는지" 는 diff 가 보여주지만, **왜** 이렇게 결정했는지는 커밋 본문에만 남는다.

### 4-4. 푸시

```bash
git push -u origin feat/booking-email-notification
```

---

## STEP 5 — Pull Request

### 5-1. PR 생성

- **Base**: `main`
- **Head**: 방금 푸시한 기능 브랜치
- **제목**: 커밋 제목과 유사하게

### 5-2. PR 본문 템플릿

```markdown
## 요약
(무엇을, 왜)

## 주요 변경
- 파일별 핵심 변경 한 줄씩

## 병합 후 필요 조치
- [ ] Railway Variables 에 SENDGRID_API_KEY 등록
- [ ] Supabase 스키마 마이그레이션 실행 (필요 시)
- (없으면 "없음")

## Test plan
- [ ] 로컬: 기능 X 정상 동작 확인
- [ ] 로컬: 관련 기능 Y 회귀 없음
- [ ] 배포 후: /api/health → ok
- [ ] 배포 후: 기능 X 프로덕션에서 동작
```

### 5-3. 혼자 개발이라도 PR 을 만드는 이유

- 병합 전 diff 를 **전체 관점으로** 한 번 더 본다 (IDE 에디팅 중에는 놓침)
- Railway 배포 이력과 PR 이 1:1 매칭되어 추적 편함
- 문제 발생 시 GitHub 의 **Revert** 버튼 한 번으로 자동 롤백 커밋 생성

---

## STEP 6 — Railway 자동 배포

PR 을 main 에 병합하면 Railway 가 GitHub 웹훅으로 감지해 자동 재배포한다.

### 6-1. Deployments 탭에서 진행 상황

1. Railway 대시보드 → amt-automation 서비스 → **Deployments** 탭
2. 최상단에 **새 항목** 생성 (커밋 메시지: `Merge pull request #N`)
3. 상태: Building → Deploying → Active

빌드 시간: 약 2~5분 (프론트/어드민 빌드 포함)
배포 시간: 약 30초~1분 (새 컨테이너 기동 + 헬스체크)

### 6-2. Build Logs 확인 (필수)

**View logs** → **Build** 탭

확인할 것:
```
[ 5/12] RUN cd backend && npm ci --include=dev     (cached 가 아닌 실제 실행)
... added N packages ...
[ 7/12] RUN cd frontend && npm ci --include=dev    (cached 가 아닌 실제 실행)
[ 9/12] RUN cd admin && npm ci --include=dev       (cached 가 아닌 실제 실행)
[10/12] RUN cd frontend && npm run build
[11/12] RUN cd admin && npm run build
```

⚠ **모든 단계가 `cached 0ms` 로 표시되면 Docker 빌드 캐시 문제**. Dockerfile 을 의미 있게 수정하거나 (공백 하나 변경도 됨) `Redeploy` 로 강제 재시도.

### 6-3. Deploy Logs 확인

**View logs** → **Deploy** 탭

정상 기동 시:
```
[DB] PostgreSQL 연결 성공
High1 Resort Booking API server running on port 8080
```

### 6-4. 프로덕션 스모크 테스트

브라우저에서:

```
https://amt-automation-production.up.railway.app/api/health
  → {"status":"ok","timestamp":"..."}

https://amt-automation-production.up.railway.app/
  → 홈페이지 렌더, 호텔/티켓 목록 보임

https://amt-automation-production.up.railway.app/admin/
  → 로그인 → 방금 추가한 기능 동작 확인
```

---

## 외부 API 연동 시 추가 규칙

### 7-1. API 키 · 시크릿 관리

**로컬** — `backend/.env` (git 에 안 올라감):
```
SENDGRID_API_KEY=SG.xxxxx
STRIPE_SECRET_KEY=sk_test_xxx
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

**운영** — Railway Variables 탭에 **같은 키로** 추가. 값은 live/prod 용.

**절대 금지**:
- 코드에 하드코딩
- `.env` 를 git 에 커밋 (`.gitignore` 가 막고 있지만 다시 확인)
- 스크린샷/채팅에 시크릿 그대로 노출 (노출됐으면 즉시 rotate)

### 7-2. 환경별 분리

| 환경 | 목적 | API 키 종류 |
|---|---|---|
| 로컬 개발 | 내 PC | test/sandbox 키 (Stripe test mode, SendGrid sandbox 등) |
| Railway 운영 | 실제 서비스 | live/production 키 |

로컬에서 실수로 실제 결제 발생하거나 실 고객에게 메일 가지 않도록 반드시 **test 키를 로컬에, live 키를 운영에** 분리.

### 7-3. 외부 API 호출 패턴

`backend/src/services/` 디렉터리를 만들어 라우트에서 외부 호출 로직을 분리:

```javascript
// backend/src/services/email.js

/**
 * SendGrid 로 예약 확정 메일 발송.
 *
 * 외부 API 호출은 반드시 try/catch 로 감싸고 실패 시 로그만 남긴다.
 * 메일 발송 실패가 예약 생성 자체를 롤백시키면 안 된다.
 */
async function sendBookingConfirmation(bookingNumber, toEmail, language) {
  // 환경 변수 미설정 시 우아하게 스킵 (개발 환경에서 에러 안 나게)
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY 미설정 — 발송 스킵');
    return { skipped: true };
  }

  try {
    // 실제 SendGrid 호출
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ /* ... */ })
    });
    if (!res.ok) {
      console.error('[email] send failed:', res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error('[email] send error:', err);
    return { sent: false };
  }
}

module.exports = { sendBookingConfirmation };
```

라우트에서 사용:
```javascript
const { sendBookingConfirmation } = require('../services/email');

// 예약 생성 성공 후
await sendBookingConfirmation(booking.booking_number, guest_email, language);
```

### 7-4. 웹훅 수신 (Stripe 등)

외부 서비스가 우리 서버로 POST 를 쏘는 엔드포인트를 만들 때:

1. **서명 검증 필수** — 웹훅 비밀(Stripe Signature, SendGrid Event Webhook Verification Key 등) 로 진짜 그 서비스에서 온 요청인지 검증
2. **멱등성 확보** — 같은 이벤트가 여러 번 와도 DB 를 한 번만 업데이트 (event_id 를 키로 중복 방지)
3. **공개 도메인 등록** — Stripe 대시보드 / SendGrid 등에 `https://amt-automation-production.up.railway.app/api/webhooks/stripe` 같은 URL 등록

### 7-5. 외부 API 장애 대비

- 외부 API 실패가 **우리 서비스의 핵심 플로우를 막지 않도록** 분리
- 예: 메일 발송 실패해도 예약 자체는 성공 처리
- 재시도가 필요하면 별도 큐/스케줄러 (지금 규모에선 과엔지니어링)
- 타임아웃 설정 — 외부 API 가 느려지면 우리 응답도 같이 느려짐

---

## 사고 발생 시 대응

### Railway 배포 실패

1. **Deployments** 탭 → 최상단 실패 배포 → **View logs**
2. Build 탭에서 실패 시 → 어느 단계에서 종료됐는지 확인, 에러 메시지 검색
3. Deploy 탭에서 실패 시 → 기동 중 예외. 스택 트레이스 확인
4. **즉시 롤백**이 필요하면: 이전 정상 배포의 ⋮ → **Redeploy** = 해당 커밋으로 재빌드·재기동

### 코드 문제로 인한 운영 장애

```bash
# 문제 커밋 찾기
git log --oneline -10

# 해당 커밋을 되돌리는 역방향 커밋 생성 (병합 커밋의 경우 -m 1)
git revert <문제 커밋 SHA>
git revert -m 1 <merge commit SHA>   # PR 머지 커밋인 경우

# main 에 직접 푸시 → Railway 자동 재배포
git push origin main
```

### DB 데이터 문제

- Supabase 대시보드 → **SQL Editor**
- **먼저 SELECT 로 영향 범위 확인** 후 UPDATE/DELETE
- 큰 변경은 **트랜잭션 내에서**:
  ```sql
  BEGIN;
  UPDATE ...;
  -- 결과 검증
  SELECT ...;
  -- 문제 없으면
  COMMIT;
  -- 문제 있으면
  ROLLBACK;
  ```
- Supabase **Point-in-time Recovery** (유료 플랜) 또는 수동 dump 백업 정기 실행

### Railway 환경변수 변경

Settings → Variables 에서 변경하면 **자동 재배포**된다. 기존 세션 토큰은 JWT_SECRET 을 바꾸면 전부 무효화되므로 사용자 재로그인 필요.

---

## 개발 중 자주 쓰는 명령어

```bash
# 매일 아침
git checkout main
git pull origin main

# 새 기능 시작
git checkout -b feat/my-feature

# 로컬 실행
./start.sh
./stop.sh

# 의존성 추가
cd backend && npm install <패키지명>      # lockfile 자동 갱신됨
# 끝나면 반드시 package-lock.json 도 커밋

# 로컬 DB 완전 초기화 (로컬만!)
cd backend && npm run seed

# 커밋 흐름
git status
git diff
git add <구체적 경로>
git commit -m "feat(scope): 설명"
git push -u origin <브랜치>

# 병합 후 브랜치 정리
git checkout main
git pull origin main
git branch -d feat/my-feature            # 로컬 브랜치 삭제
git push origin --delete feat/my-feature # 원격 브랜치 삭제 (선택)
```

---

## 마지막 당부

1. **PR 전에 반드시 로컬 테스트** — 프로덕션에서 발견되면 같은 사이클 한 번 더 돌아야 한다
2. **환경 변수 체크리스트** — 새 env 추가 시 **3곳 모두**:
   - `backend/.env` (로컬)
   - Railway Variables (운영)
   - `docs/DEPLOY_RAILWAY.md` (문서)
3. **큰 변경은 쪼개서** — 하나의 PR 은 하나의 논리적 변경만. 리뷰 / 롤백 / 디버깅 모두 쉬워짐
4. **Supabase 스키마 변경** — 반드시 마이그레이션 SQL 을 `docs/` 아래 기록해서 다음 개발자(와 미래의 본인)가 재현 가능하도록
5. **시크릿 노출되면 즉시 rotate** — 스크린샷, 채팅, 로그 어디든 한 번 공개된 시크릿은 **유출된 것으로 간주**

---

## 참고 문서

- `docs/DATABASE_SETUP_GUIDE.md` — Supabase PostgreSQL 초기 구축
- `docs/DEPLOY_RAILWAY.md` — Railway 배포 환경 설정
- `docs/PMS_INTEGRATION_PLAN.md` — PMS 연동 계획
- `CLAUDE.md` — Claude Code 작업 가이드
- `GUIDE.md` — 사용자용 한국어 가이드
