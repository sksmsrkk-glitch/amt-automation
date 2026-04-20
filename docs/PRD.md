# PRD — High1 Resort 외국인 전용 예약 플랫폼

**문서 버전**: v1.0
**작성일**: 2026-04-20
**상태**: Draft
**대상 저장소**: `sksmsrkk-glitch/amt-automation`

---

## 목차

1. [문서 개요](#1-문서-개요)
2. [서비스 비전 및 배경](#2-서비스-비전-및-배경)
3. [타깃 사용자](#3-타깃-사용자)
4. [서비스 범위 (Scope)](#4-서비스-범위-scope)
5. [기능 명세](#5-기능-명세)
6. [정보구조(IA) 및 화면 흐름](#6-정보구조ia-및-화면-흐름)
7. [데이터 모델](#7-데이터-모델)
8. [API 명세 요약](#8-api-명세-요약)
9. [비기능 요구사항](#9-비기능-요구사항)
10. [운영 및 통합 계획](#10-운영-및-통합-계획)
11. [향후 로드맵](#11-향후-로드맵)
12. [부록](#12-부록)

---

## 1. 문서 개요

### 1.1 목적
본 문서는 **High1 Resort 외국인 전용 예약 플랫폼**의 제품 요구사항(Product Requirements)을 정의한다. 현재 저장소에 커밋된 소스코드와 기존 운영 문서(README, GUIDE, docs/*.md)를 근거로 작성되었으며, 기능·데이터·운영 정책을 단일 문서에 통합하여 개발·QA·운영·비즈니스 이해관계자가 동일한 기준을 참조하도록 한다.

### 1.2 독자
- **제품/기획**: 범위와 우선순위 확인
- **개발 (Backend / Frontend / Admin)**: 기능·API·데이터 스펙 준수
- **QA**: 수용 기준과 테스트 시나리오 도출
- **운영/CS**: 예약·결제·환불·다국어 정책 확인
- **사업/영업**: KPI, 로드맵, 연동 계획 확인

### 1.3 버전 관리
| 버전 | 일자 | 작성자 | 변경 요약 |
|------|------|--------|----------|
| v1.0 | 2026-04-20 | Claude Code (자동 생성) | 최초 초안 — 저장소 전체 분석 기반 |

### 1.4 용어 정의
| 용어 | 정의 |
|------|------|
| **PMS** | Property Management System — 리조트 내부 운영 시스템(객실·상품 재고 원장) |
| **Voucher** | 예약 확정 시 발급되는 교환권. QR 코드 기반 현장 체크인에 사용 (`VCR-XXXX`) |
| **Booking Number** | 사용자 식별용 예약 번호 (`BK-XXXX`). 비회원 조회 키로도 사용 |
| **Access Code** | 특정 상품에 한정된 할인/프로모션 코드 |
| **Showcase** | 리조트 시설·액티비티·다이닝을 소개하는 마케팅 콘텐츠 (HTML + 이미지 + YouTube) |
| **Room Inventory** | 객실 유형별·일자별 재고 레코드. 동적 가격(주말 ×1.3 등) 포함 |
| **i18n** | 다국어 지원 — 본 서비스는 영어(en) / 중국어 간체(cn) 2개 언어 |
| **Guest Booking** | 비회원 예약. `booking_number + guest_email` 조합으로 조회 |

---

## 2. 서비스 비전 및 배경

### 2.1 사업 배경

하이원 리조트는 강원도 정선에 위치한 국내 대표 종합 리조트이나, 기존 공식 예약 채널은 **한국어 중심**으로 설계되어 외국인 방문객(특히 스키 시즌의 중국·동남아·영어권 고객)이 아래와 같은 장벽에 직면해 왔다:

1. **언어 장벽**: 한국어 전용 UI, 한국어 고객센터 의존
2. **결제 장벽**: 국내 PG·휴대폰 본인인증 중심 결제 플로우
3. **정보 접근성**: 스키·액티비티·숙박·패키지가 분산되어 있어 외국인이 종합 정보를 파악하기 어려움
4. **비회원 접근성**: 간단한 예약에도 한국 기반 회원가입을 요구

본 플랫폼은 위 장벽을 제거한 **외국인 전용 예약 창구**로, 영어·중국어 UI, Google 소셜 로그인, 비회원 예약·조회, 통합 상품 카탈로그를 제공한다.

### 2.2 비전 (Vision)
> **"외국인 방문객이 한국어를 한 글자도 몰라도 하이원 리조트의 스키·액티비티·숙박·패키지를 3분 이내에 예약할 수 있게 한다."**

### 2.3 미션 (Mission)
- **언어 중립**: 영어·중국어 완전 지원, UI·콘텐츠·고객 커뮤니케이션 전 영역
- **게스트 우선**: 회원가입 없이도 예약 가능 (이메일만으로 확정·조회·취소)
- **통합 카탈로그**: 호텔·티켓·패키지·쇼케이스를 하나의 사이트에서 탐색
- **운영 자동화**: 관리자가 재고·가격·프로모션을 GUI에서 직접 운영
- **확장 가능한 아키텍처**: 장기적으로 PMS 양방향 연동으로 실시간 재고 동기화

### 2.4 성공 지표 (KPI 후보)
| 분류 | 지표 | 목표(초기 6개월) |
|------|------|------------------|
| 트래픽 | 월간 순방문자(MUV) | 10,000+ |
| 전환 | 방문 → 예약 완료 전환율 | 2% 이상 |
| 매출 | 월 예약 GMV | KRW 100M+ |
| 품질 | 예약 취소율 | 10% 이하 |
| 품질 | 결제 실패율 | 2% 이하 |
| 국제화 | 중국어 세션 비율 | 40% 이상 |
| 회원 | Google 소셜 로그인 비율 | 50% 이상 |
| 운영 | 관리자 수동 개입 건수 / 예약 100건 | 5건 이하 |

### 2.5 경쟁/참조 서비스
- **Klook, Trip.com** — 글로벌 OTA. 통합 상품 카탈로그 / 다국어 / 게스트 예약 UX 참조
- **Booking.com, Agoda** — 객실 재고·가격 표시, 취소 정책 UI 참조
- **GetYourGuide** — 티켓·액티비티 바우처 UX 참조

차별점: **단일 리조트 전용 D2C 사이트**로 운영사가 직접 상품·가격·재고를 통제하며, OTA 수수료 없이 외국인에게 직접 판매.

---

## 3. 타깃 사용자

### 3.1 주요 페르소나

#### Persona A — Li Wei (리웨이, 28세, 중국 상하이)
- **직업**: IT 기업 과장, 연 1회 해외 스키 여행
- **언어**: 중국어 모국어, 영어 기본 (독해 가능)
- **디바이스**: 모바일 우선 (iPhone / 위챗 인앱 브라우저)
- **예약 니즈**: 4박 5일 스키 + 숙박 패키지, 친구 3명 동반
- **Pain Point**: 한국어 사이트 번역기 의존 → 가격·취소 조건 파악 어려움
- **기대 UX**: 중국어 UI, 위챗 페이 / Visa 결제, 바우처를 위챗에 저장

#### Persona B — Sarah Johnson (32세, 영국 런던)
- **직업**: 마케팅 매니저, 아시아 1개월 배낭여행 중
- **언어**: 영어 모국어
- **디바이스**: 데스크톱 + 모바일 병용
- **예약 니즈**: 2박 호텔 + 1일 스키 리프트권 (패키지 불필요)
- **Pain Point**: 한국 회원가입의 복잡한 본인인증
- **기대 UX**: Google 로그인 또는 게스트 예약, 이메일로 바우처 수령

#### Persona C — 박민수 (42세, 하이원 외국인 예약 담당 매니저)
- **직업**: 하이원 마케팅팀 / 운영팀
- **언어**: 한국어 (관리자 페이지도 영어 UI로 표시됨)
- **디바이스**: 사무실 PC
- **운영 니즈**: 성수기 재고·가격 일괄 조정, 비회원 예약 고객 응대, 환불 처리
- **Pain Point**: 기존 PMS는 외국인 특화 프로모션 관리 기능이 없음
- **기대 UX**: GUI로 재고/가격/쇼케이스 운영, 대시보드에서 매출 즉시 확인

### 3.2 사용자 시나리오

**시나리오 A1 — 중국인 그룹 스키 패키지 예약**
1. Li Wei가 중국 SNS에서 광고를 보고 사이트 방문 (중국어 자동 감지)
2. Home → Packages → "Ski 3-night Package" 선택
3. 방문일 지정 → 4인 예약 → 게스트 예약으로 진행 (회원가입 스킵)
4. 이메일/전화 입력 후 결제 → 이메일로 바우처 수신
5. 귀국 후 MyBookings 대신 OrderLookup에서 booking_number + email로 조회

**시나리오 B1 — 영국인 개별 호텔 예약**
1. Sarah가 Google에서 "high1 resort english booking" 검색 → 사이트 방문
2. Hotels → 호텔 선택 → 객실 유형/조식 옵션 비교
3. Google Sign-In으로 즉시 로그인 → 카드 결제
4. MyBookings에서 바우처 PDF 다운로드

**시나리오 C1 — 성수기 재고·가격 일괄 조정**
1. 관리자 로그인 → HotelManagement → 객실 유형 선택
2. 재고 관리 탭 → 12/20~01/05 기간 지정
3. 주말(토/일) 가격 ×1.5, 재고 −20% 일괄 적용 (bulk API)
4. Dashboard에서 익일 매출 반영 확인

**시나리오 C2 — 비회원 예약 환불 처리**
1. 고객이 이메일로 환불 요청 → 관리자가 BookingManagement에서 booking_number 검색
2. BookingDetail → 환불 버튼 → 금액 입력 → 환불 처리 (결제 상태 refunded, 재고 복원)
3. 고객은 OrderLookup에서 상태가 'cancelled'로 변경된 것 확인

### 3.3 비대상 사용자 (Non-Target)
- **한국인 내국인 고객**: 기존 한국어 공식 사이트 사용 안내
- **B2B 여행사 대량 예약**: 본 플랫폼은 B2C D2C 전용. B2B는 별도 API/영업 채널 필요 (향후 로드맵)
- **단체 MICE 고객**: 맞춤 견적이 필요한 기업 행사는 대상 외

---

## 4. 서비스 범위 (Scope)

### 4.1 포함 범위 (In-Scope, v1.0)

#### 고객(사용자) 사이트
- ✅ **다국어 UI**: 영어(en), 중국어 간체(cn) 완전 지원
- ✅ **회원 시스템**: 이메일/비밀번호 가입·로그인, Google OAuth 2.0 소셜 로그인
- ✅ **게스트 예약**: 회원가입 없이 예약, `booking_number + email`로 조회
- ✅ **호텔 예약**: 호텔/객실 유형 선택, 체크인·체크아웃 날짜 기반 재고/가격 조회
- ✅ **티켓 예약**: 스키/액티비티/관광/레슨/웰니스 카테고리 단일 날짜 티켓
- ✅ **패키지 예약**: 호텔+티켓 결합 상품, 방문일 기준 재고 관리
- ✅ **Showcase(콘텐츠)**: 액티비티/시설/다이닝 소개 페이지 (HTML + 이미지 + YouTube)
- ✅ **Voucher 발급**: 예약 확정 시 QR 바우처 생성 및 조회
- ✅ **예약 취소**: 사용자 셀프 취소 + 재고 자동 복원

#### 관리자 사이트
- ✅ **대시보드**: 매출/예약 통계, 최근 예약, 월별 차트
- ✅ **상품 CRUD**: 호텔·객실유형·티켓·패키지 생성/수정/삭제
- ✅ **재고·가격 관리**: 일자별 단건 및 대량(bulk) 수정
- ✅ **예약 관리**: 상태 변경, 결제 상태 수동 조정, 환불 처리, CSV 내보내기
- ✅ **할인 코드**: 상품별 access code 발급 및 유효기간 관리
- ✅ **프로모션**: 기간 한정 할인 프로모션 설정
- ✅ **Showcase 관리**: Rich text 콘텐츠 작성, 정렬 순서 변경
- ✅ **사용자 관리**: 조회 및 통계 (읽기 위주)
- ✅ **이미지 업로드**: Supabase Storage 기반 CDN 업로드

#### 인프라/운영
- ✅ **PostgreSQL(Supabase)** 기반 데이터 저장 (sql.js에서 마이그레이션 완료)
- ✅ **Railway 배포** (Docker 단일 컨테이너)
- ✅ **Supabase Storage** 이미지 호스팅
- ✅ **JWT 인증**, bcrypt 비밀번호 해싱

### 4.2 제외 범위 (Out-of-Scope, v1.0)

다음 기능은 **v1.0 범위 외**이며, 로드맵(§11)에서 단계적으로 검토한다:

| 제외 항목 | 사유 | 재검토 시점 |
|----------|------|------------|
| **실시간 PMS 연동** | 별도 `PMS_INTEGRATION_PLAN.md` 기반 phased 구현 | v1.2 |
| **결제 PG 실연동** | 현 단계는 결제 레코드만 기록(Stripe 연동은 문서상 설계), 실 PG 연동은 별도 사업 계약 후 | v1.1 |
| **일본어·한국어 UI** | v1.0은 영어/중국어 집중. 추후 수요 기반 추가 | v2.0 |
| **B2B/여행사 대량 예약 API** | D2C 집중 | v2.0 |
| **모바일 네이티브 앱** | PWA + 반응형 웹으로 커버 | v2.0+ |
| **리뷰/평점 시스템** | v1.0은 판매 집중, 리뷰는 차기 | v1.3 |
| **멤버십/포인트 제도** | 별도 프로모션 기획 필요 | v1.3 |
| **실시간 CS 챗봇** | 이메일 기반 CS로 시작 | v1.2 |
| **SMS 알림** | 이메일 알림으로 시작 | v1.2 |
| **복수 통화 표시** | 내부는 KRW 단일. 표시용 환율 변환은 향후 | v1.1 |

### 4.3 가정 (Assumptions)
- 하이원 리조트 운영사와의 **상품·가격·재고 공급 계약이 체결**되어 있다
- 관리자 계정은 **소수(<10명)** 운영자가 공유하며, 조직 단위 권한은 불필요하다
- v1.0 초기에는 **결제가 수기/Off-line으로 처리**되거나, 별도 결제 링크로 위임될 수 있다
- 이미지·동영상 등 무거운 자산은 **Supabase Storage CDN**으로 서빙한다
- 트래픽은 초기 **동시접속 200 이하**를 가정하며, Railway 단일 인스턴스로 충분하다

### 4.4 의존성 (Dependencies)
- **외부**: Supabase (DB + Storage), Google Cloud (OAuth Client), Railway (호스팅)
- **내부**: 하이원 리조트 공식 상품 카탈로그·가격·재고 데이터 공급
- **선택적**: Stripe (결제), SendGrid/AWS SES (이메일 발송)

---

## 5. 기능 명세

### 5.1 사용자 사이트 (frontend, :3000)

#### F-U-01 회원 시스템
| ID | 기능 | 설명 | 수용 기준 |
|----|------|------|----------|
| F-U-01-1 | 이메일 회원가입 | 이메일/비밀번호/이름/전화/국적/언어 입력 | 이메일 중복 시 409, 비밀번호 bcrypt 해싱 후 저장, 성공 시 JWT 즉시 발급 |
| F-U-01-2 | 이메일 로그인 | 이메일/비밀번호 검증 | 불일치 시 401, 성공 시 JWT(7일) 발급 |
| F-U-01-3 | Google 소셜 로그인 | Google ID 토큰 교환, 동일 이메일 계정 자동 연결 | `GOOGLE_CLIENT_ID` 환경변수 필수, 기존 계정 있으면 `google_id` 연결 (분기 계정 방지) |
| F-U-01-4 | 프로필 조회/수정 | 이름/전화/언어 변경 | JWT 필수, 이메일/비밀번호/역할은 수정 불가 |
| F-U-01-5 | 로그아웃 | 클라이언트 토큰 삭제 | localStorage `token` 제거로 구현 |

**페이지**: `Register.jsx`, `Login.jsx`, `Profile.jsx`

#### F-U-02 상품 탐색 (호텔/티켓/패키지/쇼케이스)
| ID | 기능 | 설명 |
|----|------|------|
| F-U-02-1 | Home 페이지 | 히어로 배너, 추천 상품 노출, 빠른 검색 |
| F-U-02-2 | 호텔 목록 | 전체 호텔 카드 목록, 기본 필터(가격/평점) |
| F-U-02-3 | 호텔 상세 | 소개/편의시설/이미지/객실 유형 리스트 + 날짜별 가용성 조회 |
| F-U-02-4 | 티켓 목록 | 카테고리별 필터(ski/activity/sightseeing/lesson/wellness) |
| F-U-02-5 | 티켓 상세 | 소요시간/장소/가격 + 단일 날짜 가용성 조회 |
| F-U-02-6 | 패키지 목록 | 패키지 카드 리스트 |
| F-U-02-7 | 패키지 상세 | 포함 상품(객실/티켓) 표시 + 방문일 가용성 |
| F-U-02-8 | Showcase 목록 | 카테고리별(활동/시설/다이닝) 콘텐츠 탐색 |
| F-U-02-9 | Showcase 상세 | HTML 본문 + 이미지 갤러리 + YouTube 임베드 |

**수용 기준 (공통)**:
- 모든 상품명/설명은 **현재 언어(localStorage `language`)** 에 맞춰 `name_en`/`name_cn` 중 자동 선택
- 이미지 로딩 실패 시 기본 placeholder 노출
- 가용성 조회는 `GET /api/{resource}/:id/availability?from=&to=` 형태로 호출

**페이지**: `Home.jsx`, `HotelList.jsx`, `HotelDetail.jsx`, `TicketList.jsx`, `TicketDetail.jsx`, `PackageList.jsx`, `PackageDetail.jsx`, `ShowcaseList.jsx`, `ShowcaseDetail.jsx`

#### F-U-03 예약 플로우
| ID | 기능 | 설명 | 수용 기준 |
|----|------|------|----------|
| F-U-03-1 | 예약 입력 | 상품 상세 → "예약" 클릭 시 BookingPage로 이동 (상품/날짜/수량 전달) | 비로그인도 진입 가능 (게스트 예약 지원) |
| F-U-03-2 | 가격 계산 | 객실: `nights × 일자별 price` / 티켓·패키지: `quantity × price` / 주말 ×1.3 자동 반영 | 가격은 서버에서 재계산 후 최종 확정 (프론트 값 신뢰 X) |
| F-U-03-3 | 게스트 정보 | 비회원 예약 시 이름/이메일/전화 필수 입력 | 이메일 형식 검증, 전화는 숫자만 |
| F-U-03-4 | 특별 요청 | free text 입력 (선택) | 최대 500자 |
| F-U-03-5 | 예약 생성 | `POST /api/bookings` 호출 | **트랜잭션**으로 재고 차감 + booking/voucher 생성 |
| F-U-03-6 | 확정 페이지 | booking_number, voucher 코드, 결제 정보 표시 | 바우처 QR 렌더링, 이메일 재전송 버튼 |
| F-U-03-7 | 내 예약 목록 | JWT 필수 회원 전용 | 상태별 필터(confirmed/cancelled), 최신순 정렬 |
| F-U-03-8 | 비회원 예약 조회 | OrderLookup 페이지에서 booking_number + email 조회 | 대소문자 무시, 이메일 완전 일치 필수 |
| F-U-03-9 | 예약 상세 | voucher + payment + product 정보 종합 | 회원은 소유 예약만, 비회원은 lookup 통해서만 진입 |
| F-U-03-10 | 예약 취소 | `PUT /api/bookings/:id/cancel` | 상태 `cancelled`, 재고 복원, 결제 환불은 관리자 개입 필요 |

**페이지**: `BookingPage.jsx`, `BookingConfirmation.jsx`, `BookingDetail.jsx`, `MyBookings.jsx`, `OrderLookup.jsx`

#### F-U-04 다국어
- 언어 토글: 헤더에서 EN ↔ CN 전환 (즉시 반영)
- 저장: `localStorage.language`
- 기본값: `en` (브라우저 언어 감지는 v1.1 검토)
- 번역 키 네임스페이스: `nav`, `home`, `hotels`, `booking`, `auth`, `common`

### 5.2 관리자 사이트 (admin, :3001)

#### F-A-01 대시보드
| ID | 기능 | 설명 |
|----|------|------|
| F-A-01-1 | Overview 카드 | 총 예약/총 매출/총 사용자/오늘 예약 수 |
| F-A-01-2 | 최근 예약 | 최신 10건 테이블 |
| F-A-01-3 | 매출 차트 | 월별 매출 바/라인 차트 (Recharts) |
| F-A-01-4 | 예약 차트 | 월별 예약 수 차트 |

**페이지**: `Dashboard.jsx`

#### F-A-02 상품 관리
| ID | 기능 | 설명 |
|----|------|------|
| F-A-02-1 | 호텔 CRUD | 이름/설명(EN/CN)/주소/이미지/평점/편의시설(JSON)/상태 |
| F-A-02-2 | 객실 유형 CRUD | 호텔 하위, 최대 인원/침대 타입/기본 가격/편의시설 |
| F-A-02-3 | 객실 재고 | 일자별 `total_rooms`, `booked_rooms`, 동적 `price` |
| F-A-02-4 | 객실 재고 대량 수정 | 기간 + 요일 필터 + 가격 배수 적용 |
| F-A-02-5 | 티켓 CRUD | 카테고리/소요시간/위치/기본가격 |
| F-A-02-6 | 티켓 재고 | 일자별 총수량/예약수/가격 |
| F-A-02-7 | 패키지 CRUD | 포함 항목(객실/티켓) 조합, 기본가격 |
| F-A-02-8 | 패키지 재고 | 방문일 기준 재고 |
| F-A-02-9 | 추천 상품 설정 | Home 노출 상품 지정 |
| F-A-02-10 | 이미지 업로드 | 단일/다중 (최대 10장), Supabase Storage CDN |

**페이지**: `HotelManagement.jsx`, `TicketManagement.jsx`, `PackageManagement.jsx`, `ProductManagement.jsx`

#### F-A-03 예약·결제 관리
| ID | 기능 | 설명 |
|----|------|------|
| F-A-03-1 | 예약 목록 | 필터(상태/결제/날짜/상품유형), 검색(booking_number/이메일/이름), 정렬, 페이지네이션 |
| F-A-03-2 | 예약 상세 | 사용자/상품/날짜/금액/바우처/결제 이력 표시 |
| F-A-03-3 | 상태 변경 | confirmed / pending / cancelled 전환 (수기) |
| F-A-03-4 | 결제 상태 변경 | paid / unpaid / refunded 수동 조정 |
| F-A-03-5 | 환불 처리 | 금액 입력 → 결제 상태 refunded + 예약 cancelled + 재고 복원 |
| F-A-03-6 | CSV 내보내기 | 기간 지정 후 필드 선택 다운로드 |
| F-A-03-7 | 예약 통계 | 상태별/일자별/상품별 집계 |
| F-A-03-8 | 결제 조회 | 결제 레코드 목록 + 상태별 필터 |

**페이지**: `BookingManagement.jsx`, `BookingDetail.jsx`, `PaymentManagement.jsx`

#### F-A-04 프로모션·접근 코드
| ID | 기능 | 설명 |
|----|------|------|
| F-A-04-1 | Access Code CRUD | 상품 지정, 할인 유형(percentage/fixed), 할인값, 최대 사용 횟수, 유효기간 |
| F-A-04-2 | 프로모션 CRUD | 전체/카테고리 적용, 기간, 할인값 |
| F-A-04-3 | 활성 프로모션 조회 | 현재 유효한 프로모션만 노출 (고객 사이트 연동용) |

**페이지**: `AccessCodeManagement.jsx`

#### F-A-05 Showcase 관리
| ID | 기능 | 설명 |
|----|------|------|
| F-A-05-1 | Showcase CRUD | 제목/요약/본문(EN/CN), 썸네일, 이미지 배열, YouTube URL, 카테고리 |
| F-A-05-2 | 정렬 순서 변경 | drag & drop 또는 sort_order 편집 |
| F-A-05-3 | 발행 상태 | published / draft 전환 |

**페이지**: `ShowcaseManagement.jsx`

#### F-A-06 사용자 관리
| ID | 기능 | 설명 |
|----|------|------|
| F-A-06-1 | 사용자 목록 | 이메일/이름/국적/가입일/최근 로그인 |
| F-A-06-2 | 사용자 통계 | 국적별/언어별 분포, 월별 가입 수 |
| F-A-06-3 | 사용자 상세 | 프로필 + 예약 이력 (읽기 전용) |

**페이지**: `UserManagement.jsx`, `UserDetail.jsx`

#### F-A-07 설정
| ID | 기능 | 설명 |
|----|------|------|
| F-A-07-1 | 시스템 설정 | 이메일 SMTP, PMS 연동(로드맵), 기본 언어 등 |

**페이지**: `Settings.jsx`

### 5.3 기능 우선순위
| 우선순위 | 기능군 |
|---------|--------|
| **P0 (필수)** | 회원·게스트 예약, 호텔/티켓/패키지 예약 플로우, 관리자 예약·상품 CRUD, 재고 관리, 다국어 |
| **P1 (핵심)** | Showcase, 대시보드 차트, 환불, CSV 내보내기, Google 로그인, 이미지 업로드 |
| **P2 (부가)** | Access Code, 프로모션, 추천 상품, 사용자 통계, 설정 페이지 |

---

## 6. 정보구조(IA) 및 화면 흐름

### 6.1 사이트맵

#### 고객 사이트 (frontend, :3000)
```
/
├── /                          Home
├── /hotels                    HotelList
│   └── /hotels/:id            HotelDetail
├── /tickets                   TicketList
│   └── /tickets/:id           TicketDetail
├── /packages                  PackageList
│   └── /packages/:id          PackageDetail
├── /showcases                 ShowcaseList
│   └── /showcases/:id         ShowcaseDetail
├── /booking                   BookingPage (상품/날짜/수량 쿼리스트링 전달)
├── /booking/confirmation      BookingConfirmation
├── /bookings/:id              BookingDetail
├── /my-bookings               MyBookings (JWT 필수)
├── /lookup                    OrderLookup (비회원)
├── /login                     Login (이메일 + Google)
├── /register                  Register
└── /profile                   Profile (JWT 필수)
```

#### 관리자 사이트 (admin, :3001)
```
/
├── /login                     Login (admin role only)
├── /dashboard                 Dashboard
├── /products                  ProductManagement (허브)
│   ├── /products/hotels       HotelManagement
│   ├── /products/tickets      TicketManagement
│   └── /products/packages     PackageManagement
├── /bookings                  BookingManagement
│   └── /bookings/:id          BookingDetail
├── /payments                  PaymentManagement
├── /showcases                 ShowcaseManagement
├── /access-codes              AccessCodeManagement
├── /users                     UserManagement
│   └── /users/:id             UserDetail
└── /settings                  Settings
```

### 6.2 핵심 사용자 플로우

#### 플로우 1 — 회원 예약 (Happy Path)
```
Home
  │
  ├──► [탐색] HotelList ──► HotelDetail
  │                             │
  │                             ▼
  │        [날짜/객실 선택] ──► "Book Now"
  │                             │
  │                             ▼
  │                        BookingPage
  │                             │
  │                  ┌──────────┴──────────┐
  │                  │                     │
  │         [비로그인]                [로그인됨]
  │                  │                     │
  │                  ▼                     ▼
  │           Login/Register          게스트 정보 자동 입력
  │                  │                     │
  │                  └──────────┬──────────┘
  │                             ▼
  │                     가격 재계산 → 확인
  │                             │
  │                             ▼
  │                   POST /api/bookings
  │                   (재고 차감 트랜잭션)
  │                             │
  │                             ▼
  │                BookingConfirmation
  │                  (voucher QR + 이메일)
  │                             │
  │                             ▼
  └──────────────────► MyBookings / BookingDetail
```

#### 플로우 2 — 게스트 예약 및 조회
```
1. Home → HotelDetail → BookingPage
2. 게스트 정보 입력 (name/email/phone)
3. POST /api/bookings → booking_number 발급
4. 이메일로 booking_number + voucher 수신
5. (나중에) OrderLookup → booking_number + email 입력
6. BookingDetail에서 상태 확인 및 셀프 취소
```

#### 플로우 3 — 예약 취소 (고객 셀프)
```
MyBookings / BookingDetail
         │
         ▼
    "Cancel" 클릭
         │
         ▼
    확인 다이얼로그 (취소 정책 표시)
         │
         ▼
 PUT /api/bookings/:id/cancel
  (status: cancelled, 재고 복원)
         │
         ▼
    결제 환불은 관리자가 별도 처리
    (payment_status: paid 유지, 이후 관리자 환불)
```

### 6.3 관리자 플로우

#### 플로우 4 — 신규 상품 등록 (호텔)
```
Dashboard → HotelManagement → "Add Hotel"
  │
  ├─ 기본 정보 입력 (name_en/cn, 설명, 주소, 편의시설)
  ├─ 이미지 업로드 (POST /api/admin/upload)
  ├─ 호텔 저장 (POST /api/admin/products - hotels)
  │
  ▼
"Add Room Type" (해당 호텔 하위)
  │
  ├─ 객실 정보 입력 (name, max_guests, bed_type, base_price)
  ├─ 객실 저장 (POST /api/admin/products/room-types)
  │
  ▼
"재고 설정" 탭
  │
  ├─ 기간 지정 (12/01 ~ 03/31)
  ├─ 총 객실 수, 기본 가격 입력
  ├─ 주말 배수 (×1.3) 선택
  ├─ Bulk 적용 (POST /api/admin/products/room-inventory/bulk)
  │
  ▼
상품 공개 (status: active) → 고객 사이트 즉시 노출
```

#### 플로우 5 — 예약 처리 및 환불
```
BookingManagement (목록)
  │
  ├─ 검색/필터
  ├─ 행 클릭 → BookingDetail
  │
  ▼
BookingDetail
  │
  ├─ [상태 변경] pending → confirmed (결제 수동 확인 시)
  ├─ [환불 요청] "Refund" 버튼
  │      │
  │      ▼
  │   환불 금액 입력 + 사유
  │      │
  │      ▼
  │   POST /api/admin/bookings/:id/refund
  │   (결제: refunded, 예약: cancelled, 재고 복원)
  │      │
  │      ▼
  │   고객에게 환불 완료 이메일 (v1.2)
```

### 6.4 네비게이션 원칙
- **고객 사이트 헤더 고정 영역**: 로고 / Hotels / Tickets / Packages / Showcases / (검색) / 언어 토글 / 로그인 상태 메뉴
- **게스트 예약 조회 CTA**: 헤더 우측 상단 "Find My Booking" (OrderLookup 진입)
- **관리자 좌측 사이드바**: Dashboard / Products / Bookings / Payments / Showcases / Access Codes / Users / Settings
- **모바일**: 햄버거 메뉴 + 하단 바텀시트 예약 CTA

### 6.5 화면 흐름의 결정 포인트
| 결정 지점 | 분기 조건 | 동작 |
|----------|-----------|------|
| BookingPage 진입 시 | JWT 토큰 여부 | 있으면 프로필로 guest 정보 자동 채움, 없으면 입력폼 노출 |
| 예약 생성 시 | 재고 부족 | 409 Conflict 반환, 다른 날짜 제안 |
| 로그인 시 | 사용자 `role === 'admin'` | 관리자 사이트로 리다이렉트 유도 |
| 언어 변경 시 | 현재 경로 | 유지한 채 UI만 리렌더 (번역 리소스 교체) |

---

## 7. 데이터 모델

### 7.1 ERD (텍스트 다이어그램)

```
┌──────────┐
│  users   │
│──────────│
│ id (PK)  │◄───────────────┐
│ email U  │                │
│ password │                │
│ role     │                │ user_id (nullable)
│ google_id│                │
│ language │                │
└──────────┘                │
                            │
┌──────────┐      ┌─────────┴────────┐      ┌──────────┐
│ hotels   │      │     bookings     │      │ payments │
│──────────│      │──────────────────│      │──────────│
│ id (PK)  │◄──┐  │ id (PK)          │◄────►│ id (PK)  │
│ name_en  │   │  │ booking_number U │      │booking_id│
│ name_cn  │   │  │ user_id (FK)     │      │ amount   │
│ status   │   │  │ guest_email      │      │ method   │
└────┬─────┘   │  │ product_type     │      │ status   │
     │         │  │ product_id       │      └──────────┘
     │1:N      │  │ room_type_id(opt)│            ▲
     ▼         │  │ check_in         │            │
┌──────────┐   │  │ check_out        │      ┌─────┴──────┐
│room_types│◄──┤  │ visit_date       │      │  vouchers  │
│──────────│   │  │ guests           │      │────────────│
│ id (PK)  │◄┐ │  │ quantity         │      │ id (PK)    │
│ hotel_id │ │ │  │ total_price      │      │ booking_id │
│ base_price││ │  │ status           │      │ code U     │
└────┬─────┘ │ │  │ payment_status   │      │ qr_data    │
     │       │ │  └────┬─────────────┘      └────────────┘
     │1:N    │ │       │
     ▼       │ │       │ product_type='hotel' → hotels.id
┌──────────┐ │ │       │ product_type='ticket' → tickets.id
│  room_   │ │ │       │ product_type='package' → packages.id
│inventory │ │ │
│──────────│ │ │
│ id (PK)  │ │ │
│room_type_│─┘ │
│ date     │   │
│ total    │   │
│ booked   │   │
│ price    │   │
└──────────┘   │
               │
┌──────────┐   │
│ tickets  │◄──┤
│──────────│   │
│ id (PK)  │◄──┐
│ category │   │
│ base_price│   │
└────┬─────┘   │
     │1:N      │
     ▼         │
┌──────────┐   │
│  ticket_ │   │
│inventory │   │
└──────────┘   │
               │
┌──────────┐   │
│ packages │◄──┘
│──────────│
│ id (PK)  │◄──┐
│ base_price│   │
└────┬─────┘   │
     │1:N      │1:N
     ▼         ▼
┌──────────┐ ┌──────────┐
│ package_ │ │ package_ │
│  items   │ │inventory │
│──────────│ │──────────│
│ id       │ │ id       │
│package_id│ │package_id│
│item_type │ │ date     │
│item_id   │ └──────────┘
└──────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  showcases   │  │ access_codes │  │  promotions  │
│──────────────│  │──────────────│  │──────────────│
│ id           │  │ id           │  │ id           │
│ title_en/cn  │  │ code U       │  │ title_en/cn  │
│ content_en/cn│  │ product_type │  │ discount     │
│ category     │  │ product_id   │  │ start_date   │
│ sort_order   │  │ discount     │  │ end_date     │
│ status       │  │ expires_at   │  │ status       │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 7.2 엔티티별 상세 필드

#### users
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | serial | PK | |
| email | varchar | UNIQUE, NOT NULL | 로그인 ID |
| password | varchar | NOT NULL | bcrypt 해시 (Google 전용 계정은 더미) |
| name | varchar | | 성명 |
| phone | varchar | | 국제전화 포맷 |
| nationality | varchar | | ISO country code 권장 |
| role | varchar | DEFAULT 'customer' | `customer` / `admin` |
| language | varchar | DEFAULT 'en' | `en` / `cn` |
| google_id | varchar | UNIQUE nullable | 소셜 로그인 연결 |
| avatar_url | text | | 프로필 사진 |
| created_at / updated_at | timestamptz | | |

#### hotels / room_types / room_inventory
- `hotels`: name_en/cn, description_en/cn, address, image_url, rating, amenities(JSON), status
- `room_types`: hotel_id(FK), name_en/cn, description_en/cn, max_guests, bed_type, amenities, image_url, base_price(int KRW), status
- `room_inventory`: room_type_id(FK), date(DATE), total_rooms(int), booked_rooms(int), price(int) — **UNIQUE(room_type_id, date)**

#### tickets / ticket_inventory
- `tickets`: name_en/cn, description_en/cn, category(ENUM: ski/activity/sightseeing/lesson/wellness), image_url, base_price, duration(text), location, status
- `ticket_inventory`: ticket_id(FK), date, total_quantity, booked_quantity, price — **UNIQUE(ticket_id, date)**

#### packages / package_items / package_inventory
- `packages`: name_en/cn, description_en/cn, image_url, base_price, includes(JSON), duration, status
- `package_items`: package_id(FK), item_type('room_type'|'ticket'), item_id(int), quantity
- `package_inventory`: package_id(FK), date, total_quantity, booked_quantity, price

#### bookings
| 필드 | 타입 | 설명 |
|------|------|------|
| id | serial | PK |
| booking_number | varchar | UNIQUE `BK-XXXX` |
| user_id | int | FK users (nullable → 게스트) |
| guest_name / guest_email / guest_phone | varchar | 게스트 정보 (회원도 중복 저장) |
| product_type | varchar | `hotel` / `ticket` / `package` |
| product_id | int | product_type에 따른 FK |
| room_type_id | int | 호텔 예약 시만 사용 |
| check_in / check_out | date | 호텔 |
| visit_date | date | 티켓/패키지 |
| guests / quantity | int | 투숙객 수 / 티켓 수량 |
| nights | int | 호텔 박 수 |
| total_price | int | KRW 합계 |
| status | varchar | `confirmed` / `pending` / `cancelled` |
| payment_status | varchar | `paid` / `unpaid` / `refunded` |
| special_requests | text | |
| created_at | timestamptz | |

#### payments
- booking_id(FK), amount(int), currency(DEFAULT 'KRW'), method(stripe/manual/…), stripe_payment_id, status(paid/pending/refunded), refund_amount, created_at

#### vouchers
- booking_id(FK), code UNIQUE `VCR-XXXX`, qr_data(JSON: booking_number/product/date), status(active/cancelled)

#### showcases
- title_en/cn, summary_en/cn, content_en/cn(HTML), thumbnail_url, images(JSON[]), youtube_url, category(activity/facility/dining), sort_order(int), status(published/draft)

#### access_codes
- code UNIQUE, product_type, product_id, discount_type(percentage/fixed), discount_value, max_uses, used_count, expires_at, status

#### promotions
- title_en/cn, description, discount_type, discount_value, applicable_to(all/categories), categories(JSON[]), start_date, end_date, max_uses, used_count, status

### 7.3 상태 전이

#### bookings.status
```
   [생성]
     │
     ▼
  pending ──────(관리자 확인)────► confirmed
     │                                │
     │                                │
     ├──(고객/관리자 취소)──► cancelled ◄───┤
     │
     └──(시간 초과)─────────► cancelled (자동, v1.2)
```

#### bookings.payment_status
```
   unpaid ──(결제 완료)──► paid ──(환불)──► refunded
                            ▲
                            │
   unpaid ──(관리자 수동)───┘
```

#### access_codes.status
```
   active ──(사용 완료 or max_uses 도달)──► inactive
      │                                      ▲
      └──(expires_at 경과)──► expired ───────┘
```

### 7.4 핵심 비즈니스 규칙
- **재고 차감은 트랜잭션**: 예약 생성 시 `booked_quantity += N` 과 booking/voucher insert를 단일 트랜잭션으로 처리 (동시성 방지).
- **주말 가격**: 토/일은 기본가 ×1.3 (관리자가 재고 레코드에서 덮어쓸 수 있음).
- **게스트 예약 조회 키**: `booking_number + guest_email` (이메일 정규화 시 lowercase 비교).
- **통화 단일화**: 저장은 **정수(KRW)** 만. 외화 표시는 UI 레이어에서 환율 변환 (v1.1).
- **언어 필드 저장 규칙**: 모든 콘텐츠 테이블은 `*_en`, `*_cn` 쌍으로 저장. 한 쪽이 비어도 저장 가능하나 고객 사이트는 fallback(en) 노출.

---

## 8. API 명세 요약

### 8.1 인증/인가 정책

| 항목 | 방식 |
|------|------|
| 토큰 유형 | JWT (HS256), 7일 만료 |
| 전달 방식 | `Authorization: Bearer <token>` 헤더 |
| 시크릿 | `JWT_SECRET` 환경변수. 프로덕션 누락 시 서버 기동 실패 (FATAL). 개발은 프로세스별 랜덤 |
| 비밀번호 | bcryptjs 해시 (cost factor 10) |
| 역할 | `customer` (기본), `admin` (관리자 라우트 필수) |
| 미들웨어 체인 | `authenticate` → `requireAdmin` (admin 전용) |
| 실패 응답 | 401 Unauthorized (토큰 없음/만료/사용자 삭제), 403 Forbidden (역할 부족) |

### 8.2 엔드포인트 인벤토리

#### 공개 API (인증 불필요)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 이메일 회원가입 → JWT |
| POST | `/api/auth/login` | 이메일 로그인 → JWT |
| POST | `/api/auth/google` | Google ID 토큰 교환 → JWT |
| GET | `/api/hotels` | 호텔 목록 |
| GET | `/api/hotels/:id` | 호텔 상세 (+room_types) |
| GET | `/api/hotels/:id/availability` | 호텔 객실 가용성 (from, to 쿼리) |
| GET | `/api/tickets` | 티켓 목록 (category 필터) |
| GET | `/api/tickets/:id` | 티켓 상세 |
| GET | `/api/tickets/:id/availability` | 티켓 가용성 (date 쿼리) |
| GET | `/api/packages` | 패키지 목록 |
| GET | `/api/packages/:id` | 패키지 상세 |
| GET | `/api/packages/:id/availability` | 패키지 가용성 |
| GET | `/api/showcases` | 쇼케이스 목록 (category 필터) |
| GET | `/api/showcases/:id` | 쇼케이스 상세 |

#### 인증(선택) — 회원/게스트 공용

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/bookings` | 예약 생성 (user_id 또는 guest 정보) |
| GET | `/api/bookings/lookup` | 비회원 조회 (booking_number + email) |
| GET | `/api/bookings/:id` | 예약 상세 (소유자 또는 lookup 통한 접근) |
| PUT | `/api/bookings/:id/cancel` | 예약 취소 |

#### 인증(필수) — 회원

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/auth/me` | 내 정보 |
| PUT | `/api/auth/me` | 내 정보 수정 |
| GET | `/api/bookings/my` | 내 예약 목록 |

#### 관리자 API (JWT + admin role)

**대시보드**
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/recent-bookings`
- `GET /api/admin/dashboard/revenue-chart`
- `GET /api/admin/dashboard/booking-chart`

**예약 관리**
- `GET /api/admin/bookings`
- `GET /api/admin/bookings/stats`
- `GET /api/admin/bookings/export` (CSV)
- `GET /api/admin/bookings/:id`
- `PUT /api/admin/bookings/:id/status`
- `PUT /api/admin/bookings/:id/payment`
- `POST /api/admin/bookings/:id/refund`

**결제 관리**
- `GET /api/admin/payments`
- `GET /api/admin/payments/stats`
- `GET /api/admin/payments/:id`
- `PUT /api/admin/payments/:id/status`

**상품 관리** (`/api/admin/products`)
- 호텔: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`
- 객실 유형: `GET /room-types`, `POST /room-types`, `PUT /room-types/:id`, `DELETE /room-types/:id`
- 티켓: `GET /tickets`, `POST /tickets`, `PUT /tickets/:id`, `DELETE /tickets/:id`
- 패키지: `GET /packages`, `POST /packages`, `PUT /packages/:id`, `DELETE /packages/:id`
- 추천: `PUT /featured`

**재고 관리** (`/api/admin/products`)
- 조회: `GET /room-inventory/:room_type_id`, `GET /ticket-inventory/:ticket_id`, `GET /package-inventory/:package_id`
- 단일 수정: `PUT /room-inventory`, `PUT /ticket-inventory`, `PUT /package-inventory`
- 대량: `POST /room-inventory/bulk`, `POST /ticket-inventory/bulk`, `POST /package-inventory/bulk`

**접근 코드 & 프로모션**
- Access Code: `GET /api/admin/access-codes`, `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- 프로모션: `GET /api/admin/promotions`, `POST`, `PUT /:id`, `DELETE /:id`, `GET /active`

**Showcase 관리**
- `GET /api/admin/showcases`, `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `PUT /api/admin/showcases/reorder`

**사용자 관리**
- `GET /api/admin/users/stats`
- `GET /api/admin/users`

**이미지 업로드**
- `POST /api/admin/upload` (단일 이미지, Supabase Storage)
- `POST /api/admin/upload/multiple` (최대 10장)

### 8.3 공통 응답 규약

#### 성공 응답
```json
{
  "success": true,
  "data": { ... }
}
```
- 목록 API는 `{ "data": [...], "meta": { "total": 120, "page": 1, "limit": 20 } }` 형태 권장
- 단건 리소스는 `data`에 객체 그대로

#### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "BOOKING_INVENTORY_INSUFFICIENT",
    "message": "Selected dates are sold out."
  }
}
```

| HTTP 상태 | 사용처 |
|----------|--------|
| 200 | 성공 |
| 201 | 생성 성공 (예약, 상품 CRUD) |
| 400 | 요청 검증 실패 (필수 파라미터 누락 등) |
| 401 | 인증 실패 |
| 403 | 권한 부족 (admin 라우트에 customer 접근) |
| 404 | 리소스 없음 |
| 409 | 재고 부족, 이메일 중복 |
| 422 | 비즈니스 검증 실패 (잘못된 날짜 범위 등) |
| 500 | 서버 오류 |

#### 에러 코드 네임스페이스 (권장 규약)
- `AUTH_*` — 인증 관련 (`AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`)
- `BOOKING_*` — 예약 (`BOOKING_INVENTORY_INSUFFICIENT`, `BOOKING_NOT_FOUND`)
- `PRODUCT_*` — 상품 (`PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`)
- `PAYMENT_*` — 결제
- `VALIDATION_*` — 입력 검증

### 8.4 페이징/정렬 규약
- 쿼리스트링: `?page=1&limit=20&sort=created_at&order=desc`
- 목록 응답 meta: `total`, `page`, `limit`, `total_pages`
- 최대 limit: 100 (초과 시 400)

---

## 9. 비기능 요구사항 (NFR)

### 9.1 다국어 (i18n)
| 요구사항 | 수용 기준 |
|---------|----------|
| 영어/중국어 간체 완전 지원 | 모든 정적 UI 텍스트가 `frontend/src/i18n/en.json`, `cn.json`에 존재 |
| 콘텐츠 이중 저장 | DB 컬럼 `*_en`, `*_cn` 쌍. 관리자 CRUD 시 최소 1개 언어 입력 필수 |
| 런타임 언어 전환 | 언어 토글 시 페이지 리로드 없이 리소스 교체, 현재 경로 유지 |
| Fallback | 선택 언어 리소스 누락 시 en으로 대체 |
| 관리자 UI 언어 | 영어 단일 (운영자는 영문 고정) |

### 9.2 성능
| 지표 | 목표 |
|------|------|
| TTFB (홈 페이지) | < 500ms (Railway + CDN 기준) |
| LCP (호텔 상세) | < 2.5s (Lighthouse Mobile 4G) |
| API p95 응답시간 | < 400ms (단일 조회), < 800ms (목록 + 조인) |
| 예약 생성 (트랜잭션) | p95 < 1s |
| 이미지 최적화 | Supabase Storage 또는 CDN에서 WebP 변환 제공 |
| 번들 크기 | 초기 JS < 200KB gzip (Vite code-splitting 활용) |

### 9.3 가용성 / 확장성
- **SLA 목표**: 월 99.5% uptime (초기 단일 인스턴스 기준)
- **수평 확장**: stateless Express 서버 → Railway 인스턴스 수 증가로 대응
- **DB 확장**: Supabase pg 자동 스케일 + 읽기 전용 복제본 (v1.2)
- **캐싱**: Showcase/상품 목록은 1분 in-memory 캐시 고려 (v1.1)
- **Rate Limit**: 인증 엔드포인트는 IP당 분당 10회, 일반 엔드포인트 60회 (`express-rate-limit` 도입 권장)

### 9.4 보안
| 항목 | 요구사항 |
|------|---------|
| **비밀번호** | bcryptjs 해시, 최소 8자 + 영문·숫자 포함 (프론트 검증) |
| **JWT** | HS256, 환경변수 시크릿 필수(운영), 7일 만료 |
| **HTTPS** | Railway 기본 TLS, 모든 쿠키/토큰은 HTTPS 전용 |
| **CORS** | 프론트/관리자 Origin만 허용 (환경변수 화이트리스트) |
| **CSRF** | JWT Bearer 방식이므로 쿠키 공격면 없음. 추가 쿠키 사용 시 SameSite=Lax |
| **SQL Injection** | 파라미터 바인딩 필수 (pg driver prepared statement) |
| **XSS** | React 기본 이스케이프 + Showcase HTML은 `DOMPurify` sanitize 필수 |
| **업로드 검증** | MIME 화이트리스트(image/jpeg, png, webp), 최대 10MB, 10장/요청 |
| **민감 정보 로깅 금지** | 비밀번호/토큰/결제 토큰은 로그 마스킹 |
| **관리자 분리** | admin 사이트는 별도 서브도메인 권장 + IP 제한 검토 |
| **Secret 관리** | `.env` 파일은 커밋 금지, Railway/Supabase secret 사용 |
| **Google OAuth** | ID 토큰은 서버에서 `google-auth-library`로 검증 후 사용 |

### 9.5 접근성 (A11y)
- 모든 인터랙션 요소에 `aria-label` 또는 명시적 텍스트
- 색 대비: WCAG AA 이상 (본문 4.5:1)
- 키보드 내비게이션: Tab 순서 논리적, 모달은 focus trap
- 이미지 대체 텍스트: 상품/쇼케이스 이미지는 관리자가 alt 입력 (v1.1)

### 9.6 반응형 / 지원 환경
| 장치/해상도 | 지원 수준 |
|------------|----------|
| Desktop 1280px+ | 1급 |
| Tablet 768~1279px | 1급 |
| Mobile 360~767px | 1급 (메인 타깃) |
| Mobile 320~359px | 최소 지원 (깨지지 않음) |

**브라우저**
- Chrome/Edge 최신 2버전, Safari 최신 2버전, Firefox 최신 2버전
- 모바일: iOS Safari 15+, Android Chrome 최신
- 중국 시장: 위챗 인앱 브라우저, QQ Browser 호환 테스트

### 9.7 관측성 (Observability)
- **로깅**: request id, user id, method, path, status, duration를 JSON line 포맷
- **에러 추적**: Sentry 도입 (v1.1)
- **대시보드**: Railway 메트릭 + Supabase Dashboard
- **Health check**: `GET /health` 엔드포인트 (DB ping 포함)

### 9.8 데이터 보존 / 프라이버시
- 사용자 탈퇴 시 개인정보 파기, 예약 레코드는 **익명화**하여 통계 보존
- 비회원 예약 이메일/전화는 최소 1년 보관 (CS 목적), 이후 마스킹
- GDPR/PIPL 대응: 데이터 열람/삭제 요청 프로세스 문서화 (v1.2)
- 결제 민감정보는 저장 안 함 (PG 토큰만)

---

## 10. 운영 및 통합 계획

### 10.1 배포 환경

#### 구성
- **호스팅**: Railway (단일 Docker 컨테이너)
- **베이스 이미지**: `node:20-slim`
- **빌드 단계**: backend/frontend/admin 각각 `npm ci` → frontend/admin `npm run build` (dist/) → backend 실행
- **포트**: Express 4000 포트가 정적 frontend/admin 빌드 산출물도 서빙
- **자동 배포**: GitHub main 브랜치 push 시 Railway가 자동 빌드/배포
- **로컬 개발**: `./start.sh` (3개 프로세스 병렬: backend 4000, frontend 3000, admin 3001)

#### 환경 변수 (Railway)
| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | 필수 | Supabase PostgreSQL 연결 문자열 |
| `JWT_SECRET` | 필수(운영) | JWT 서명 시크릿 (미설정 시 서버 기동 실패) |
| `NODE_ENV` | 권장 | `production` 지정 |
| `SUPABASE_URL` | 선택 | 이미지 업로드용 |
| `SUPABASE_SERVICE_KEY` | 선택 | Storage 업로드 권한 |
| `GOOGLE_CLIENT_ID` | 선택 | 소셜 로그인 활성화 시 |
| `CORS_ORIGIN` | 권장 | 프론트/관리자 URL 쉼표 구분 |
| `PORT` | 자동 | Railway가 주입 |

### 10.2 데이터 저장소 (Supabase PostgreSQL)
- 기존 sql.js(파일 기반) → Supabase PostgreSQL로 마이그레이션 완료 (`docs/DATABASE_SETUP_GUIDE.md` 참조)
- 스키마: `docs/DATABASE_SETUP_GUIDE.md`의 SQL Editor 스크립트로 전체 테이블·인덱스 생성
- 초기 시드: `backend/src/seed.js` — 샘플 호텔/티켓/패키지/쇼케이스/관리자 계정
- 백업: Supabase Point-in-Time Recovery (Pro 플랜), 일일 스냅샷
- 커넥션 풀: `pg` 기본 풀 (기본값 10), 트래픽 증가 시 PgBouncer 도입 검토

### 10.3 이미지 / 정적 파일 저장 (Supabase Storage)
- **필요성**: Railway 컨테이너는 ephemeral → 재시작 시 파일 소실
- **Bucket**: `product-images` (public, 10MB per file)
- **업로드 경로**: 관리자 페이지 → `POST /api/admin/upload` → Supabase Storage → 공개 CDN URL 반환
- **파일 정책**:
  - 허용 MIME: image/jpeg, image/png, image/webp
  - 파일명: `uuid-v4.ext` (충돌 방지)
  - 업로드 제한: 단건 10MB, 다중 최대 10장/요청

### 10.4 PMS (Property Management System) 연동 계획
별도 문서 `docs/PMS_INTEGRATION_PLAN.md` 에 단계별 계획 존재. 요약:

**Phase 1 — Adapter 구축 (v1.2)**
- 디렉터리: `backend/src/pms/` (client, adapter, sync 모듈)
- PMS API 인증(API Key/Secret), 기본 읽기 엔드포인트 연동

**Phase 2 — 재고 단방향 동기화 (v1.3)**
- PMS → 플랫폼 일일 동기화 (cron)
- 환경변수: `PMS_SYNC_INTERVAL_MS`

**Phase 3 — 가격 동기화 (v1.4)**
- 동적 가격 정책을 PMS로 push 혹은 pull 합의

**Phase 4 — 양방향 예약 동기화 (v2.0)**
- 플랫폼 예약 → PMS 반영 (webhook 또는 주기 push)
- 충돌 해결 규칙, 실패 재시도, 이중 예약 방지

**환경변수**: `PMS_BASE_URL`, `PMS_API_KEY`, `PMS_API_SECRET`, `PMS_SYNC_INTERVAL_MS`

### 10.5 결제 연동 (계획)
- v1.0: 결제 레코드만 기록, 실제 결제는 off-platform (수동 확인 또는 결제 링크)
- v1.1: Stripe 본격 연동 (국제 카드) — `method=stripe`, `stripe_payment_id` 저장
- v1.2: 중국 결제 수단 (Alipay / WeChat Pay) — Stripe Payment Method 또는 직접 연동
- 환불 플로우: 관리자 환불 버튼 → 결제 API 호출 → `payment.status=refunded` + `booking.status=cancelled` + 재고 복원

### 10.6 이메일 / 알림
- v1.0: 수동 확인 (바우처를 사이트에서 직접 다운로드)
- v1.1: SMTP 기반 예약 확정/취소 이메일 (SendGrid 또는 AWS SES)
- v1.2: SMS/카카오 알림톡 (국내 고객용은 해당 없음, 외국인 타깃 확인 필요)

### 10.7 CI/CD 및 브랜치 전략
- 기본 브랜치: `main` (프로덕션 자동 배포)
- 기능 브랜치 네이밍: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`
- Claude Code 작업 브랜치: `claude/<topic>-<hash>` (본 문서 작성 브랜치: `claude/high1-planning-document-aquXi`)
- PR 정책: 1명 이상 리뷰, CI 통과(빌드/린트/테스트) 후 병합
- 훅: 프로젝트 `.claude/` pipeline — development → testing → quality → security 4단계

### 10.8 운영 체크리스트 (Go-Live 전)
- [ ] Railway 프로덕션 환경변수 설정 (DATABASE_URL, JWT_SECRET, SUPABASE_* 등)
- [ ] Supabase 프로덕션 DB 스키마 생성 및 시드 1회 실행
- [ ] Supabase Storage `product-images` bucket 생성 (public)
- [ ] Google OAuth 클라이언트 (프로덕션 도메인 추가)
- [ ] 커스텀 도메인 + HTTPS 인증서
- [ ] 관리자 초기 비밀번호 즉시 변경
- [ ] robots.txt, sitemap.xml 검토
- [ ] Lighthouse / WebPageTest로 성능 측정
- [ ] 취약점 스캔 (npm audit)
- [ ] 백업 복원 절차 실제 테스트 1회

---

## 11. 향후 로드맵

### 11.1 단기 (v1.0 → v1.1, ~1개월)
- [ ] Stripe 결제 실연동 (국제 카드)
- [ ] 이메일 발송 (예약 확정/취소, SMTP)
- [ ] 환율 변환 UI (USD/CNY 표시, 내부 저장은 KRW 유지)
- [ ] Sentry 에러 추적 도입
- [ ] Rate limit 미들웨어 (`express-rate-limit`)
- [ ] 이미지 alt 텍스트 관리 (접근성)
- [ ] 브라우저 언어 자동 감지 (`Accept-Language`)

### 11.2 중기 (v1.2 → v1.3, 1~3개월)
- [ ] PMS 연동 Phase 1~3 (Adapter → 재고 동기화 → 가격 동기화)
- [ ] 중국 결제 수단 (Alipay, WeChat Pay)
- [ ] 리뷰/평점 시스템
- [ ] 멤버십/포인트 제도
- [ ] 관리자 역할 세분화 (super_admin, operator, viewer)
- [ ] CS 티켓 시스템 또는 이메일 스레드 연동
- [ ] 다국어 확장 (일본어, 한국어 선택 지원)
- [ ] GDPR/PIPL 데이터 요청 응대 프로세스

### 11.3 장기 (v2.0+, 3개월+)
- [ ] B2B/여행사 API (대량 예약, 전용 요율)
- [ ] PMS 양방향 실시간 연동
- [ ] 모바일 네이티브 앱 (React Native, iOS/Android)
- [ ] 추천 엔진 (행동 기반 개인화)
- [ ] 구독형 시즌 패스
- [ ] 멀티 리조트 확장 (High1 외 파트너 리조트 수용)

### 11.4 미해결 의사결정 항목 (Open Questions)
| 번호 | 항목 | 결정 필요 시점 |
|------|------|----------------|
| Q1 | 결제 PG 선택 (Stripe vs Toss Payments vs NICE) | v1.1 킥오프 전 |
| Q2 | 환불 정책의 자동화 범위 (취소 시 자동 환불 vs 관리자 승인) | v1.1 설계 |
| Q3 | 비회원 예약 이메일 발송 보존 기간 (1년? 3년?) | Go-Live 전 |
| Q4 | PMS 공급사 및 API 스펙 확정 | v1.2 킥오프 전 |
| Q5 | 중국 사이트 접속 최적화 (CDN, ICP 등록 여부) | v1.1 |
| Q6 | 관리자 IP 제한 여부 및 SSO 도입 | v1.2 |
| Q7 | 이메일 템플릿 다국어 설계 (EN/CN 별도 vs 단일 템플릿 + 변수) | v1.1 |

---

## 12. 부록

### A. 기본 계정 / 테스트 데이터
| 역할 | 이메일 | 비밀번호 | 비고 |
|------|--------|---------|------|
| 관리자 | `admin@high1.com` | `admin123` | **Go-Live 전 반드시 변경** |
| 테스트 고객 | `guest@test.com` | `test123` | 개발 환경 전용 |

### B. 폴더 구조
```
amt-automation/
├── CLAUDE.md                  # Claude Code 프로젝트 가이드
├── GUIDE.md                   # 실행 가이드 (한국어)
├── README.md                  # 프로젝트 개요
├── Dockerfile                 # Railway 배포용
├── railway.json               # Railway 설정
├── start.sh / stop.sh         # 로컬 원클릭 실행/종료
├── start-windows.bat          # Windows 실행
├── package.json               # 루트 스크립트 (install:all, build, dev)
│
├── docs/
│   ├── PRD.md                              # ← 본 문서
│   ├── DATABASE_SETUP_GUIDE.md             # PostgreSQL 전환
│   ├── DEPLOY_RAILWAY.md                   # Railway 배포
│   ├── DEVELOPMENT_WORKFLOW.md             # 개발 사이클
│   ├── PMS_INTEGRATION_PLAN.md             # PMS 연동 계획
│   └── SUPABASE_STORAGE_SETUP.md           # 이미지 저장소
│
├── backend/                   # Express API (:4000)
│   ├── package.json
│   └── src/
│       ├── index.js           # 서버 진입점
│       ├── seed.js            # 샘플 데이터
│       ├── config/            # DB/환경 설정
│       ├── middleware/
│       │   └── auth.js        # JWT 인증 + requireAdmin
│       └── routes/
│           ├── auth.js
│           ├── hotels.js
│           ├── tickets.js
│           ├── packages.js
│           ├── showcases.js
│           ├── bookings.js
│           └── admin/
│               ├── dashboard.js
│               ├── bookings.js
│               ├── payments.js
│               ├── products.js
│               ├── access-codes.js
│               ├── promotions.js
│               ├── showcases.js
│               ├── upload.js
│               └── users.js
│
├── frontend/                  # 고객 사이트 React SPA (:3000)
│   ├── package.json
│   └── src/
│       ├── pages/             # 라우트별 페이지 (17개)
│       ├── components/        # 공용 컴포넌트
│       └── i18n/              # en.json / cn.json
│
└── admin/                     # 관리자 SPA (:3001)
    ├── package.json
    └── src/
        ├── pages/             # 라우트별 페이지 (14개)
        └── components/        # 관리자 공용 컴포넌트
```

### C. 기술 스택 요약
| 레이어 | 기술 |
|--------|------|
| **백엔드** | Node.js 20, Express 4, pg, bcryptjs, jsonwebtoken, uuid, multer, @supabase/supabase-js, google-auth-library |
| **프론트엔드** | React 18, Vite 5, react-router-dom 6, i18next, react-i18next |
| **관리자** | React 18, Vite 5, react-router-dom 6, recharts |
| **DB** | PostgreSQL (Supabase) |
| **Storage** | Supabase Storage (product-images bucket) |
| **Auth** | JWT (HS256) + Google OAuth 2.0 |
| **배포** | Docker + Railway (자동 배포) |
| **런타임** | Node.js >= 18 |
| **테스트(계획)** | Jest + Supertest (백엔드), React Testing Library (프론트) |
| **Lint(계획)** | ESLint + eslint-plugin-react + eslint-plugin-react-hooks |

### D. 참고 문서
| 문서 | 목적 |
|------|------|
| `CLAUDE.md` | Claude Code 프로젝트 가이드 및 코딩 원칙 |
| `GUIDE.md` | 한국어 실행/운영 가이드 |
| `README.md` | 프로젝트 개요 및 빠른 시작 |
| `docs/DATABASE_SETUP_GUIDE.md` | Supabase PostgreSQL 스키마 생성 |
| `docs/DEPLOY_RAILWAY.md` | Railway 배포 절차 |
| `docs/DEVELOPMENT_WORKFLOW.md` | 브랜치 전략 및 로컬 개발 |
| `docs/PMS_INTEGRATION_PLAN.md` | PMS 연동 Phase별 계획 |
| `docs/SUPABASE_STORAGE_SETUP.md` | 이미지 저장소 설정 |

### E. 주요 명령어
```bash
# 로컬 통합 실행
./start.sh

# 로컬 종료
./stop.sh

# 의존성 일괄 설치
npm run install:all

# 개별 실행
cd backend  && npm run seed && npm start    # 백엔드 + 시드
cd frontend && npm run dev                  # 프론트엔드
cd admin    && npm run dev                  # 관리자

# 데이터 초기화
cd backend && rm -rf data && npm run seed && npm start

# 빌드 (배포용)
npm run build                               # frontend + admin 빌드

# 컨테이너 빌드/실행 (선택)
docker build -t high1-platform .
docker run -p 4000:4000 --env-file .env high1-platform
```

### F. 상태 코드 참조 (Booking · Payment)
| 필드 | 값 | 의미 |
|------|-----|-----|
| `bookings.status` | `pending` | 생성 직후, 결제/확정 대기 |
| | `confirmed` | 확정 (결제 완료 또는 관리자 확인) |
| | `cancelled` | 취소 (재고 복원 완료) |
| `bookings.payment_status` | `unpaid` | 미결제 |
| | `paid` | 결제 완료 |
| | `refunded` | 환불 완료 |
| `payments.status` | `pending` | 결제 요청 중 |
| | `paid` | 결제 승인 |
| | `refunded` | 환불 처리됨 |

### G. 변경 이력
| 버전 | 일자 | 요약 |
|------|------|------|
| v1.0 | 2026-04-20 | 최초 작성 — 저장소 전체 분석 기반 PRD 초안 |

---

**문서 끝.** 추가·수정 요청은 저장소 이슈 또는 PR로 제출해주세요.
