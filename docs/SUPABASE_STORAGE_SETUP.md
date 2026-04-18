# High1 Resort — Supabase Storage 설정 가이드

> 대상: 어드민 이미지 업로드가 영구 저장되도록 Supabase Storage 를 처음 구성하는 개발자
> 전제: Supabase 프로젝트가 이미 있고 DB 연결이 되어 있는 상태 (→ [DATABASE_SETUP_GUIDE.md](./DATABASE_SETUP_GUIDE.md))

---

## 왜 필요한가

과거에는 어드민에서 업로드한 이미지를 **컨테이너 로컬 디스크**(`backend/uploads/`) 에 저장했습니다. Railway 등 컨테이너 플랫폼의 파일시스템은 **ephemeral (임시)** 이라 컨테이너가 재시작되면 — 보통 몇 시간 주기 — 업로드된 파일이 **전부 삭제**됐습니다.

결과:
- DB 에는 `/uploads/<filename>` URL 이 남아있음
- 실제 파일은 사라짐
- 브라우저에서 이미지 404 → 하얀 플레이스홀더

Supabase Storage 로 이전하면:
- 영구 CDN 기반 저장
- URL 이 절대 경로(`https://<project>.supabase.co/...`) 로 안정
- Railway 배포/재시작과 무관

---

## 1. Supabase 대시보드에서 Bucket 생성

### 1-1. Storage 메뉴 진입

1. https://supabase.com → 프로젝트 → 좌측 **Storage** 메뉴
2. 상단 **+ New bucket** 클릭

### 1-2. Bucket 설정

| 항목 | 값 |
|---|---|
| Name | `product-images` |
| **Public bucket** | **ON** (체크) |
| File size limit | `10 MB` 권장 (업로드 라우트 limit 과 일치) |
| Allowed MIME types | (비워두면 전부 허용. 필요 시 `image/jpeg,image/png,image/gif,image/webp`) |

**저장** 클릭.

> ⚠ Public 으로 설정해야 브라우저가 별도 토큰 없이 이미지를 바로 불러올 수 있습니다. Bucket 이름을 다르게 하려면 Railway 의 `SUPABASE_STORAGE_BUCKET` 환경변수로 재정의 가능합니다(다음 섹션).

### 1-3. (선택) RLS 정책 확인

Public bucket 을 만들면 기본적으로:
- **SELECT (읽기)**: `anon` 키로 모두 허용
- **INSERT/UPDATE/DELETE**: 인증된 사용자 + service_role 만

`service_role` 키로 업로드하므로 RLS 는 자동으로 우회됩니다. 추가 정책 설정 불필요.

---

## 2. 필요한 키 확인

### 2-1. Project URL

Supabase → **Project Settings** → **API** → **Project URL**
- 형식: `https://xxxxxxxx.supabase.co`

### 2-2. Service Role Key ⚠ 민감정보

같은 화면 → **Project API keys** → **service_role** (`secret` 라벨이 있는 것)
- 형식: `eyJhbGciOiJIUzI1NiIs...` (긴 JWT 문자열)

> ⚠ **절대 프런트엔드 코드나 git 에 넣지 마세요.** 이 키는 모든 RLS 정책을 우회하는 관리자 권한입니다. 백엔드 환경변수로만 사용하세요.

> `anon` 키 (공개 키) 는 여기서 **사용하지 않습니다**. anon 키로 업로드하려면 RLS 정책을 세밀하게 설정해야 하고 JWT 검증 플로우가 복잡해지므로, 관리자 전용인 이 프로젝트 규모에선 service key 가 단순·안전합니다.

---

## 3. 환경변수 등록

### 3-1. Railway (운영 환경)

Railway 대시보드 → 서비스 → **Variables** 탭 → **+ New Variable**:

```
SUPABASE_URL            = https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY    = eyJhbGciOiJIUzI1NiIs... (service_role 키 전체)
SUPABASE_STORAGE_BUCKET = product-images          (선택 — 기본값과 다를 때만)
```

저장하면 Railway 가 자동 재배포합니다.

### 3-2. 로컬 개발 (backend/.env)

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...
# SUPABASE_STORAGE_BUCKET=product-images   # 생략 시 기본값
```

> 로컬과 운영에 **같은 Supabase 프로젝트**를 쓰면 업로드 테스트가 운영 bucket 을 오염시킵니다. 가능하면 **로컬용 별도 Supabase 프로젝트** 또는 **별도 bucket** 을 만들어 쓰세요.

---

## 4. 동작 확인

### 4-1. 배포 로그

Railway 재배포 후 Deploy Logs 에서:
```
[DB] PostgreSQL 연결 성공
High1 Resort Booking API server running on port 8080
```

Storage 는 지연 초기화라 업로드 실제 호출 전까지 로그가 안 찍힙니다.

### 4-2. 어드민에서 업로드 테스트

1. 어드민 → Tickets / Hotels / Packages 중 하나 → **Edit** → 이미지 업로드
2. 저장 후 프런트엔드 카드에 이미지 정상 표시 확인
3. Supabase 대시보드 → Storage → `product-images` 버킷에 **파일이 올라가 있는지** 확인
4. 업로드된 파일의 공개 URL 이 `https://<project>.supabase.co/storage/v1/object/public/product-images/<filename>` 형태인지 확인

### 4-3. 영속성 확인

1. Railway 서비스를 한 번 **Redeploy** 하여 컨테이너를 재시작
2. 재시작 후 어드민의 기존 이미지가 **여전히 표시**되는지 확인
3. 만약 여전히 사라진다면 → DB 의 `images` 컬럼에 여전히 `/uploads/xxx` 상대 경로가 남아 있는 **구형 데이터**임. 이 경우 그 이미지는 이미 유실됐으므로 다시 업로드해야 함.

---

## 5. 문제 해결

### 증상: `Supabase Storage 가 구성되지 않았습니다.`

**원인**: `SUPABASE_URL` 또는 `SUPABASE_SERVICE_KEY` 환경변수 누락.

**해결**: 3-1 / 3-2 에 따라 Railway Variables 또는 backend/.env 확인.

### 증상: `Supabase Storage upload failed: new row violates row-level security policy`

**원인**: service_role 이 아닌 anon 키로 업로드 시도.

**해결**: `SUPABASE_SERVICE_KEY` 값이 **service_role** 키인지 다시 확인 (anon 키 아님).

### 증상: 업로드는 성공했지만 이미지가 404

**원인**: Bucket 이 Public 으로 설정되지 않음.

**해결**: Storage → 버킷 설정 → **Public bucket** 토글 ON.

### 증상: `Bucket not found`

**원인**: `SUPABASE_STORAGE_BUCKET` 값이 실제 bucket 이름과 다름, 또는 bucket 이 아직 생성되지 않음.

**해결**: Supabase Storage 대시보드에서 이름 확인 후 env 값과 일치시키거나 bucket 생성.

---

## 6. 참고 / 후속 작업

- 이전 DB 의 `/uploads/xxx` URL 들은 **파일이 이미 유실된 상태**. 어드민에서 해당 상품을 Edit → 이미지 다시 업로드하면 자동으로 Supabase URL 로 교체됨.
- 업로드된 이미지의 수명/자동 정리 정책은 현재 없음. 필요 시 Supabase Storage 의 수명 정책(Lifecycle policy) 설정으로 30/90일 경과 파일 자동 삭제 가능.
- 썸네일 크기 자동 변환은 Supabase Storage 의 Image Transformation 기능(유료 플랜 또는 Self-Hosted) 로 구현 가능. 필요 시 별도 작업.
- 로컬 `backend/uploads/` 디렉토리는 이제 쓰이지 않지만 `.gitignore` 에 여전히 포함되어 있음. 디렉토리 자체 삭제는 git clean 등에서 자동 처리됨.

---

## 관련 문서

- `docs/DEPLOY_RAILWAY.md` — Railway 배포 전체 가이드
- `docs/DATABASE_SETUP_GUIDE.md` — Supabase PostgreSQL 초기 구축
- `docs/DEVELOPMENT_WORKFLOW.md` — 개발/배포 사이클
