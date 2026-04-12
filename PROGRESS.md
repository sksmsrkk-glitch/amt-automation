# PROGRESS.md — High1 Resort 외국인 전용 예약 플랫폼

> 이 파일은 Claude Code 세션 간 인수인계용입니다. 세션이 끊기거나 새 세션을 시작할 때 **가장 먼저 이 파일을 읽히면** 프로젝트 컨텍스트가 바로 복원됩니다.
>
> **사용법 (새 세션에서)**: "PROGRESS.md 를 읽고 이어서 작업해줘"

---

## 1. 프로젝트 개요

High1 리조트의 외국인 전용 예약 플랫폼. 3개 워크스페이스로 구성:

| 워크스페이스 | 역할 | 포트 |
|---|---|---|
| `backend/` | Express + sql.js API 서버 | 4000 |
| `frontend/` | 고객용 예약 사이트 (React + Vite) | 3000 |
| `admin/` | 운영자용 관리 페이지 (React + Vite) | 3001 |

**주요 도메인**: 호텔/객실, 티켓, 패키지, 예약, 프로모션, 재고. 영어/중국어 i18n. 결제/예약 흐름 포함.

**실행**: 루트에서 `./start.sh` (원클릭) 또는 각 워크스페이스에서 `npm run dev` / `npm start`. 자세한 내용은 `GUIDE.md` 참고.

**기본 계정**:
- 관리자: `admin@high1.com` / `admin123`
- 테스트 고객: `guest@test.com` / `test123`

---

## 2. 기술 스택

- **Backend**: Node.js, Express, sql.js (SQLite in JS, 크로스 플랫폼), JWT 인증, multer + sharp (이미지 업로드/리사이즈)
- **Frontend / Admin**: React 18, Vite, React Router, 순수 CSS (styles 오브젝트)
- **데이터**: `backend/data/` 안에 SQLite 파일 (seed로 초기화: `npm run seed`)

---

## 3. 현재까지 구현된 기능 (git log 기준)

### 백엔드
- 인증 (JWT, admin/user 권한 분리)
- 호텔/객실/티켓/패키지 CRUD
- 예약 API (`bookings`)
- 관리자 API (`routes/admin/*`): products, bookings, upload, inventory, promotions
- 이미지 업로드 라우트 (`routes/admin/upload.js`) — **sharp로 2000px 이하로 자동 리사이즈**
- 대량 재고(bulk inventory) API
- 블랙아웃 날짜가 적용된 프로모션

### 사용자 프론트엔드 (`frontend/`)
- Home, Hotel/Package/Ticket Detail
- SearchBar + DateRangePicker (영어 로케일, 날짜 검증)
- Booking flow → BookingConfirmation (수량 표시 포함)
- Login, Register, Profile, OrderLookup
- MyBookings, BookingDetail
- 영어/중국어 i18n

### 관리자 프론트엔드 (`admin/`)
- Login
- Hotel / Package / Ticket Management 페이지 (재고/가격/프로모션 관리 UI)
- Settings
- `ImageUploader` 컴포넌트 — **업로드 전 Canvas로 2000px 이하 리사이즈**
- 상품 featured/sort_order 우선순위 컨트롤
- `/uploads` 프록시 (vite.config)

---

## 4. 최근 세션에서 한 일

### 2026-04-12 — 이미지 2000px 리사이즈 (commit `2bb5969`)

**문제**: Claude Code 세션이 "An image in the conversation exceeds the dimension limit for many-image requests (2000px)" 에러로 계속 실패. 핸드폰 원본 사진(4000px+)이 그대로 저장되어 대화 히스토리에 들어가는 것이 원인.

**수정**:
1. `backend/src/routes/admin/upload.js` — `multer.memoryStorage()` + `sharp` 파이프라인으로 교체. `fit: 'inside'`, `withoutEnlargement: true`, EXIF 방향 반영. GIF는 프레임 손실 방지 위해 원본 저장. `/` 와 `/multiple` 둘 다 적용.
2. `admin/src/components/ImageUploader.jsx` — `resizeImageFile()` 추가. JPEG/PNG/WebP는 업로드 전 브라우저 Canvas에서 축소. 실패 시 원본 fallback.
3. `backend/package.json` — `sharp@^0.33.5` 추가, 설치 완료.

**검증**: 4000×3000 → 2000×1500으로 축소, 800×600은 유지되는 것 확인.

**한계**: 이 수정은 **앞으로의 업로드만** 보호합니다. 기존 세션 히스토리에 이미 박혀 있는 큰 이미지는 되살릴 수 없어서, 문제가 난 Claude 세션은 버리고 **새 세션**을 시작해야 합니다.

---

## 5. 알려진 이슈 / 주의사항

- **multer 1.x 보안 경고**: `npm install` 시 "Multer 1.x is impacted by vulnerabilities, upgrade to 2.x" 경고가 뜹니다. 아직 업그레이드 안 됨.
- **`backend/uploads/` 폴더**: 존재하지만 비어 있을 수 있음. 상품 이미지를 올리면 여기에 쌓입니다. 개발 편의상 `.gitignore`에서 관리 여부 확인 필요.
- **seed 데이터의 이미지 URL**: `/images/hotels/*.jpg` 등의 경로가 DB에 들어가는데 실제 파일은 존재하지 않음. 필요 시 실제 이미지를 `frontend/public/images/...`에 넣거나 URL을 빈 값으로 바꿀 것.
- **이미지 용량**: 2000px 이하로 축소되므로 Claude에게 파일을 첨부할 때도 이 제한을 지키세요. 한 대화에 이미지 5~10장 이상 쌓이지 않도록 세션을 잘게 쪼개는 것이 안전합니다.

---

## 6. 다음에 이어서 할 일 (TODO)

<!-- 이어서 작업할 때 여기 항목을 채워 넣으세요. 끝낸 항목은 [x]로 체크 -->

- [ ] (기록되지 않은 진행 중 작업이 있다면 여기에 추가)
- [ ] multer 2.x 업그레이드 검토
- [ ] seed.js의 placeholder 이미지 URL 처리 방식 정리
- [ ] `backend/uploads/` 운영 배포 시 영속 스토리지 전략

---

## 7. 유용한 명령어 치트시트

```bash
# 전체 실행
./start.sh

# 백엔드만
cd backend && npm run seed && npm start

# 프론트엔드 (사용자)
cd frontend && npm run dev

# 프론트엔드 (관리자)
cd admin && npm run dev

# 데이터 초기화
cd backend && rm -rf data && npm run seed && npm start

# 전체 종료
./stop.sh
```

---

## 8. 브랜치 / 배포

- **메인 브랜치**: `main`
- **현재 작업 브랜치**: `claude/initial-setup-y2zL3`
- 푸시는 항상 지정된 claude 작업 브랜치로만.
