# High1 Resort Booking Platform — MVP Progress

> 외국인 전용 High1 리조트 예약 플랫폼의 MVP 진행 상황입니다.
> 현재 브랜치: `claude/review-progress-iNMNL`

---

## 1. 프로젝트 개요

3-Tier 구조의 예약 플랫폼:

| 모듈 | 설명 | 포트 |
|------|------|------|
| `backend/` | Node.js + Express + sql.js REST API | 4000 |
| `frontend/` | React (Vite) 고객용 사이트 (영/중 i18n) | 3000 |
| `admin/` | React (Vite) 운영자 관리 콘솔 | 3001 |

- 실행: `./start.sh` (원클릭) 또는 각 폴더에서 개별 실행
- 기본 계정: `admin@high1.com / admin123`, `guest@test.com / test123`

---

## 2. 완료된 항목 (Done)

### 2.1 Backend (`backend/`)

#### 데이터 모델 (`backend/src/config/database.js`)
- [x] `users` (role: admin/customer, language, nationality)
- [x] `hotels`, `room_types`, `room_inventory` (날짜별 재고/가격)
- [x] `tickets`, `ticket_inventory`
- [x] `packages`, `package_items`, `package_inventory`
- [x] `bookings` (hotel/ticket/package 공용, guest 예약 지원)
- [x] `payments`, `vouchers`, `promotions` (blackout/기간/할인율 포함)

#### 공개 API
- [x] `POST /api/auth/register`, `POST /api/auth/login` (JWT)
- [x] `GET /api/hotels`, `GET /api/hotels/:id`
- [x] `GET /api/tickets`, `GET /api/tickets/:id`
- [x] `GET /api/packages`, `GET /api/packages/:id`
- [x] `POST /api/bookings` (guest & 로그인 공용, 재고 차감 + voucher 생성)
- [x] `GET /api/bookings/lookup` (비회원 조회: 이메일/전화/예약번호)
- [x] `GET /api/bookings/my` (로그인 사용자 내 예약)
- [x] `GET /api/bookings/:id` (product, room_type, voucher, payment 포함)
- [x] `PUT /api/bookings/:id/cancel` (재고 복원 + 바우처 무효화)

#### 관리자 API (`backend/src/routes/admin/`)
- [x] `products.js` — 호텔/객실타입/티켓/패키지 CRUD, 대량 재고 업데이트, 정렬/featured
- [x] `bookings.js` — 전체 예약 목록/필터, 상태 변경
- [x] `users.js` — 사용자 목록/상세
- [x] `dashboard.js` — 매출/예약 KPI
- [x] `payments.js` — 결제 목록, 상세, 상태 변경, 통계
- [x] `promotions.js` — 프로모션 CRUD (blackout dates 포함)
- [x] `upload.js` — 이미지 업로드 (정적 `/uploads` 서빙)

### 2.2 Frontend — 고객 사이트 (`frontend/`)

페이지 (`frontend/src/pages/`):
- [x] `Home` — 히어로 + SearchBar (DateRangePicker 통합)
- [x] `HotelList`, `HotelDetail` — 객실타입/재고/가격 표시
- [x] `TicketList`, `TicketDetail` — 수량 선택/총액 계산
- [x] `PackageList`, `PackageDetail` — 포함 내역 표시
- [x] `BookingPage` — 공통 예약 폼 (hotel/ticket/package)
- [x] `BookingConfirmation` — 바우처 코드 + 수량 표기
- [x] `MyBookings`, `BookingDetail` — 로그인 사용자
- [x] `OrderLookup` — 비회원 조회
- [x] `Login`, `Register`, `Profile`

공통:
- [x] `DateRangePicker` 영문 캘린더 (SearchBar/상세 페이지 통일)
- [x] i18n: `en.json`, `cn.json` (언어 토글)
- [x] 지연 로드(`React.lazy`) + 로딩 스피너

### 2.3 Admin 콘솔 (`admin/`)

페이지 (`admin/src/pages/`):
- [x] `Dashboard` — KPI 위젯
- [x] `BookingManagement` / `BookingDetail` — 예약 관리
- [x] `ProductManagement` — 통합 상품 페이지
- [x] `HotelManagement`, `TicketManagement`, `PackageManagement` — 카테고리별 관리
  - 이미지 업로드, 리치 텍스트, 대량 재고 입력, 프로모션 연결
  - featured / sort_order 토글로 프론트 노출 우선순위 제어
- [x] `UserManagement` / `UserDetail`
- [x] `PaymentManagement` — 결제 리스트/상태 변경/통계
- [x] `Login` (관리자 JWT 보호 라우트)

### 2.4 기타
- [x] `start.sh` / `stop.sh` / `start-windows.bat` 원클릭 실행 스크립트
- [x] `GUIDE.md` — 비개발자 친화 실행 가이드
- [x] admin Vite `/uploads` 프록시 (이미지 표시)

---

## 3. 남은 MVP 항목 (TODO)

### 3.1 결제 (Payment) — ⚠️ Critical
현재 `payments` 테이블은 존재하지만 실제 결제 게이트웨이 연동이 없고, 생성 시 `status='pending'`으로만 기록됩니다.

- [ ] Stripe (또는 대체 PG) Checkout Session 생성 엔드포인트 (`POST /api/payments/checkout`)
- [ ] Stripe webhook 수신 엔드포인트 → `payments.status='paid'` 자동 업데이트 + `bookings.status='confirmed'`
- [ ] `POST /api/admin/payments/:id/refund` 환불 API (`refund_amount` 필드 활용)
- [ ] 환불 시 재고 복원 로직 확인 및 연동
- [ ] 프론트엔드 결제 단계: `BookingPage` → Stripe Checkout 리다이렉트 → `BookingConfirmation` 흐름 연결
- [ ] 통화 처리: 현재 `currency='KRW'` 하드코딩, 외국인 대상이므로 USD/CNY 표시 전환 확인

### 3.2 바우처 / 이메일 알림
- [ ] 예약 확정 이메일 전송 (nodemailer 또는 SendGrid) — 바우처 코드 + QR 포함
- [ ] QR 코드 이미지 렌더링 (`qrcode` 패키지) — 현재는 `qr_data` JSON만 저장됨
- [ ] 바우처 PDF 생성/다운로드 (`BookingDetail`에서 "Download Voucher")
- [ ] 예약 취소 알림 이메일

### 3.3 Settings 페이지 마무리 (`admin/src/pages/Settings.jsx`)
명시된 TODO:
- [ ] `Settings.jsx:23` — 관리자 비밀번호 변경 API 연동 (`PUT /api/auth/password`)
- [ ] `Settings.jsx:166` — General settings (사이트명, 연락처, 기본 통화 등) 저장/로드
- [ ] `Settings.jsx:272` — Notification settings (이메일 발송 on/off, 수신 주소)

### 3.4 프로모션 적용 로직
- [ ] `POST /api/bookings`에서 프로모션 코드/자동 할인 계산 로직 (현재 스키마만 존재)
- [ ] 프론트엔드 프로모션 코드 입력 UI + 총액 재계산

### 3.5 재고/가격 강화
- [ ] 동시 예약 경쟁 상태 방지 (트랜잭션 래핑 점검)
- [ ] 호텔 예약 주말/성수기 차등 가격 샘플 시드 확인
- [ ] 관리자 재고 경고 (품절 임박 배지)

### 3.6 국제화/현지화
- [ ] i18n 키 누락 점검 (관리자 콘솔은 영어만)
- [ ] 통화 포맷터 공통화 (`KRW` / `USD` / `CNY`)
- [ ] 타임존 처리: 서버/클라이언트 날짜 경계 확인

### 3.7 품질/운영
- [ ] 간단한 API 스모크 테스트 (Jest/Vitest 또는 REST 파일)
- [ ] `.env.example` + 환경변수 기반 설정 (JWT_SECRET, STRIPE_KEYS, SMTP)
- [ ] 로깅 개선 (현재 `console.error`만) — pino 또는 morgan
- [ ] 프로덕션 배포 스크립트 / Dockerfile (현재는 로컬 개발 전용)
- [ ] 백엔드 `cors()` 전체 개방 → 화이트리스트로 좁히기

### 3.8 UX 마감
- [ ] 404 / 에러 바운더리 페이지
- [ ] 예약 실패 시 inline 에러 메시지 다듬기
- [ ] 모바일 반응형 점검 (DateRangePicker 드롭다운 overflow 등)

---

## 4. 권장 우선순위

MVP를 실제 운영 가능 수준까지 끌어올리려면 다음 순서를 권장합니다:

1. **결제 플로우 연결** (3.1) — 이게 빠지면 "예약"이 완결되지 않음
2. **바우처 이메일/QR** (3.2) — 외국인 고객 입장에서 필수 산출물
3. **Settings 마감 + 환경변수화** (3.3, 3.7 일부) — 운영 가능성
4. **프로모션 적용 로직** (3.4) — 이미 UI/스키마가 있으므로 완성도 ↑
5. **i18n/통화/타임존 점검** (3.6) — 외국인 대상 서비스 특성상 중요
6. **테스트/로깅/배포** (3.7 나머지)

---

## 5. 참고 파일 포인터

- 예약 생성 로직: `backend/src/routes/bookings.js:17`
- 관리자 결제 상태 업데이트: `backend/src/routes/admin/payments.js:133`
- Settings TODO: `admin/src/pages/Settings.jsx:23,166,272`
- 라우터 마운트: `backend/src/index.js:46`
- 프론트 라우팅: `frontend/src/App.jsx:32`
- 관리자 라우팅: `admin/src/App.jsx:43`
