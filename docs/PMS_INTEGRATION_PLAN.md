# High1 Resort PMS API 연동 계획서

## 1. 현재 아키텍처 분석

### 현행 구조의 한계

| 항목 | 현재 | PMS 연동 후 |
|---|---|---|
| **재고 관리** | 어드민 수동 입력 (`room_inventory` 테이블) | PMS에서 실시간 동기화 |
| **가격** | 시드 시점 고정 (주말 ×1.3) | PMS 동적 가격 실시간 반영 |
| **예약** | 자체 DB에만 기록 | PMS ↔ 자체 DB 양방향 동기화 |
| **DB 엔진** | sql.js (인메모리, 파일 직렬화) | 운영 환경에서는 PostgreSQL 권장 |
| **동시성** | 단일 프로세스, 트랜잭션 보호 | PMS와의 race condition 고려 필요 |

### 현행 데이터 흐름

```
[어드민 수동입력] → room_inventory(total_rooms, price)
                        ↓
[고객 예약] → bookings.js → booked_rooms += qty (트랜잭션)
                        ↓
[취소] → restoreBookingInventory() → booked_rooms -= qty
```

---

## 2. 목표 아키텍처

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  High1 PMS  │◄─────►│  PMS Adapter      │◄─────►│  Express API     │
│  (외부 시스템) │       │  (새로 구축)       │       │  (기존 백엔드)    │
└─────────────┘       └──────────────────┘       └─────────────────┘
       │                      │                          │
       │  1) 재고/가격 Push    │  2) 내부 DB 갱신          │  3) 고객 조회
       │  또는 Pull           │                          │
       │                      │                          │
       ▼                      ▼                          ▼
  PMS 원천 데이터        pms_sync_log 테이블       room_inventory 테이블
  (객실·티켓·가격)       (동기화 이력 추적)         (기존 구조 유지)
```

### 핵심 설계 원칙

1. **PMS가 원천(Source of Truth)** — 재고/가격은 PMS가 마스터, 자체 DB는 캐시
2. **Adapter 패턴** — PMS API 변경 시 어댑터만 수정, 기존 비즈니스 로직 불변
3. **Graceful Degradation** — PMS 연결 실패 시 마지막 동기화 데이터로 서비스 지속
4. **양방향 예약 동기화** — 고객 예약 → PMS 전송, PMS 예약 변경 → 자체 DB 반영

---

## 3. 구현 단계 (4단계)

### Phase 1 — PMS Adapter 기반 구축

**목표**: PMS API 연결 인프라 + 설정 관리

```
backend/src/
├── pms/
│   ├── client.js          ← PMS HTTP 클라이언트 (인증, 재시도, 타임아웃)
│   ├── adapter.js         ← PMS 응답 → 내부 모델 변환기
│   ├── config.js          ← PMS 접속정보 (환경변수 기반)
│   └── sync/
│       ├── inventory.js   ← 재고 동기화 로직
│       ├── pricing.js     ← 가격 동기화 로직
│       └── booking.js     ← 예약 양방향 동기화
├── routes/
│   └── admin/
│       └── pms.js         ← PMS 관리 API (수동 동기화, 상태 조회)
```

**새 환경변수**:
```env
PMS_BASE_URL=https://pms.high1.com/api/v1
PMS_API_KEY=xxx
PMS_API_SECRET=xxx
PMS_HOTEL_CODE=HIGH1
PMS_SYNC_INTERVAL_MS=300000    # 5분 주기
PMS_TIMEOUT_MS=10000
PMS_RETRY_COUNT=3
```

**새 DB 테이블**:
```sql
-- PMS 동기화 이력 추적
CREATE TABLE pms_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL,         -- 'inventory' | 'pricing' | 'booking'
  direction TEXT NOT NULL,         -- 'inbound' (PMS→자체) | 'outbound' (자체→PMS)
  status TEXT DEFAULT 'pending',   -- 'pending' | 'success' | 'failed'
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  details TEXT                     -- JSON: 동기화 상세 내역
);

-- PMS 매핑 테이블 (PMS 상품 ID ↔ 자체 상품 ID)
CREATE TABLE pms_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,       -- 'room_type' | 'ticket' | 'package'
  local_id INTEGER NOT NULL,
  pms_id TEXT NOT NULL,            -- PMS 측 ID (문자열)
  pms_code TEXT,                   -- PMS 상품 코드
  last_synced_at TEXT,
  is_active INTEGER DEFAULT 1,
  UNIQUE(entity_type, local_id),
  UNIQUE(entity_type, pms_id)
);

-- 예약 PMS 연동 추적
ALTER TABLE bookings ADD COLUMN pms_reservation_id TEXT;
ALTER TABLE bookings ADD COLUMN pms_sync_status TEXT DEFAULT 'pending';
  -- 'pending' | 'synced' | 'failed' | 'cancelled_in_pms'
ALTER TABLE bookings ADD COLUMN pms_synced_at TEXT;
```

---

### Phase 2 — 재고 + 가격 실시간 동기화 (Inbound)

**목표**: PMS → 자체 DB로 객실 재고와 가격을 주기적으로 동기화

#### 2-1. PMS Client 구현

```javascript
// backend/src/pms/client.js — PMS HTTP 클라이언트
class PmsClient {
  constructor(config) { /* baseUrl, apiKey, timeout, retry */ }

  // 객실 재고 조회 (날짜 범위)
  async getRoomAvailability(fromDate, toDate) { }

  // 객실 가격 조회 (날짜 범위, 객실 유형)
  async getRoomRates(roomTypeCode, fromDate, toDate) { }

  // 티켓 재고 조회
  async getTicketAvailability(ticketCode, fromDate, toDate) { }

  // 예약 전송 (자체 → PMS)
  async createReservation(bookingData) { }

  // 예약 취소 전송
  async cancelReservation(pmsReservationId) { }

  // 예약 상태 조회
  async getReservationStatus(pmsReservationId) { }
}
```

#### 2-2. 동기화 스케줄러

```javascript
// backend/src/pms/sync/inventory.js
async function syncInventory() {
  // 1) PMS에서 향후 90일 재고 데이터 조회
  const pmsData = await pmsClient.getRoomAvailability(today, today+90);

  // 2) pms_mappings로 local room_type_id 매핑
  // 3) 기존 room_inventory UPSERT (현행 admin/products.js 패턴 재사용)
  //    - total_rooms = PMS 전체 재고
  //    - booked_rooms = PMS 예약 수 (또는 PMS sold count)
  //    - price = PMS 가격
  // 4) pms_sync_log에 결과 기록
}
```

**동기화 전략 — Delta vs Full**:

| 전략 | 설명 | 용도 |
|---|---|---|
| **Full Sync** | 향후 90일 전체 재고/가격 교체 | 5분 주기, 서버 기동 시 |
| **Delta Sync** | 변경분만 갱신 (PMS가 webhook 지원 시) | 실시간 반영 |
| **On-demand** | 고객이 상세 페이지 접근 시 PMS 조회 | 최신 가격 보장 |

#### 2-3. 가격 동기화 흐름

```
[PMS 가격 API] → adapter.transformRates()
                     ↓
              room_inventory.price UPSERT
                     ↓
              기존 availability API가 자동으로 최신 가격 반환
              (hotels.js:164 — inv.price || base_price 패턴 유지)
```

**기존 코드 변경 없이 동작하는 이유**: 현재 `GET /hotels/:id/availability`는 이미 `room_inventory.price`를 우선 조회합니다. PMS가 이 값을 갱신하면 고객에게 자동 반영됩니다.

---

### Phase 3 — 예약 양방향 동기화 (Outbound + Inbound)

**목표**: 고객 예약 → PMS 전송, PMS 변경 → 자체 DB 반영

#### 3-1. Outbound (자체 → PMS)

현행 `POST /bookings` 트랜잭션 흐름에 PMS 전송 단계를 추가:

```
기존 흐름:
  validate → check inventory → decrement → insert booking → payment → voucher

PMS 연동 후:
  validate → check inventory → decrement → insert booking → payment → voucher
                                                     ↓
                                             [PMS 예약 전송] (비동기)
                                                     ↓
                                             bookings.pms_reservation_id 업데이트
                                             bookings.pms_sync_status = 'synced'
```

**핵심 결정: 동기 vs 비동기**

| 방식 | 장점 | 단점 |
|---|---|---|
| **동기 (권장 X)** | 즉시 확정 | PMS 장애 시 예약 불가 |
| **비동기 (권장)** | PMS 장애에도 예약 가능 | 일시적 불일치 가능 |

**권장: 비동기 + 재시도 큐**

```javascript
// bookings.js POST / 트랜잭션 완료 후
// PMS 전송은 트랜잭션 밖에서 비동기로 처리
setImmediate(async () => {
  try {
    const pmsRes = await pmsClient.createReservation(mappedBooking);
    db.prepare('UPDATE bookings SET pms_reservation_id=?, pms_sync_status=?, pms_synced_at=datetime("now") WHERE id=?')
      .run(pmsRes.reservationId, 'synced', bookingId);
  } catch (err) {
    db.prepare('UPDATE bookings SET pms_sync_status="failed" WHERE id=?')
      .run(bookingId);
    // 재시도 큐에 등록
    syncQueue.push({ type: 'booking', bookingId, retryCount: 0 });
  }
});
```

#### 3-2. Inbound (PMS → 자체)

PMS에서 직접 예약이 발생하거나 변경될 때 자체 DB를 갱신:

```
방법 A: Webhook (PMS가 지원하는 경우)
  POST /api/pms/webhook → 예약 생성/변경/취소 이벤트 수신

방법 B: Polling (폴백)
  5분 주기로 PMS의 최근 변경 예약 조회 → 자체 DB 반영
```

**새 API 엔드포인트**:
```
POST /api/pms/webhook           ← PMS 이벤트 수신 (HMAC 서명 검증)
GET  /api/admin/pms/status      ← 동기화 상태 대시보드
POST /api/admin/pms/sync        ← 수동 동기화 트리거
GET  /api/admin/pms/logs        ← 동기화 이력 조회
PUT  /api/admin/pms/mappings    ← PMS 상품 매핑 관리
```

---

### Phase 4 — 어드민 대시보드 + 모니터링

**목표**: 동기화 상태 실시간 모니터링 + 수동 제어

#### 어드민 PMS 관리 페이지

```
admin/src/pages/PmsManagement.jsx
├── 동기화 상태 카드 (마지막 성공/실패 시각, 다음 스케줄)
├── 상품 매핑 테이블 (PMS ID ↔ 자체 ID, 활성 상태)
├── 동기화 이력 로그 (필터: 유형/상태/기간)
├── 수동 동기화 버튼 (재고/가격/예약 각각)
└── PMS 연결 상태 헬스체크
```

---

## 4. API 설계 상세

### PMS → 자체 시스템 (Inbound)

#### 재고 동기화 응답 매핑

```javascript
// PMS 응답 (예시 — 실제 PMS 스펙에 따라 adapter에서 변환)
{
  "roomTypeCode": "DLX-TWIN",
  "date": "2026-04-20",
  "totalInventory": 25,
  "soldCount": 8,
  "rate": 320000,
  "currency": "KRW",
  "restrictions": { "minStay": 1, "maxStay": 7 }
}

// adapter.js 에서 내부 모델로 변환
{
  room_type_id: 3,        // pms_mappings에서 조회
  date: "2026-04-20",
  total_rooms: 25,        // totalInventory
  booked_rooms: 8,        // soldCount
  price: 320000           // rate
}

// 기존 UPSERT 패턴으로 room_inventory에 반영
```

### 자체 시스템 → PMS (Outbound)

#### 예약 전송 매핑

```javascript
// 자체 booking 데이터
{
  booking_number: "BK-ABC123",
  guest_name: "John Smith",
  guest_email: "john@example.com",
  product_type: "hotel",
  room_type_id: 3,
  check_in: "2026-04-20",
  check_out: "2026-04-22",
  guests: 2,
  total_price: 640000
}

// adapter.js 에서 PMS 포맷으로 변환
{
  externalId: "BK-ABC123",
  roomTypeCode: "DLX-TWIN",    // pms_mappings에서 조회
  arrivalDate: "2026-04-20",
  departureDate: "2026-04-22",
  guestCount: 2,
  guestInfo: { name: "John Smith", email: "john@example.com" },
  totalAmount: 640000,
  currency: "KRW",
  source: "WEB_FOREIGN"        // 외국인 전용 채널 식별자
}
```

---

## 5. 에러 처리 + 장애 대응

### 시나리오별 대응

| 시나리오 | 대응 전략 |
|---|---|
| **PMS 응답 지연** | 타임아웃 10초, 3회 재시도 (지수 백오프) |
| **PMS 완전 다운** | 마지막 동기화 데이터로 서비스 지속, 어드민에 경고 표시 |
| **재고 불일치** | PMS 값이 마스터, 주기적 Full Sync로 보정 |
| **예약 전송 실패** | 자체 예약은 유지, 재시도 큐에 등록, 어드민에 알림 |
| **이중 예약 (Overbooking)** | PMS 재고 확인 → 자체 재고 차감 순서 보장 |

### 재시도 큐 설계

```javascript
// 실패한 PMS 작업을 재시도하는 간단한 인메모리 큐
// 운영 환경에서는 Redis/BullMQ 등으로 교체 권장
class SyncRetryQueue {
  maxRetries = 5
  backoffMs = [5000, 15000, 60000, 300000, 900000]  // 5초→15분

  async processQueue() {
    for (const job of this.queue) {
      try {
        await this.executeJob(job);
        this.remove(job);
      } catch (err) {
        job.retryCount++;
        if (job.retryCount >= this.maxRetries) {
          this.markFailed(job);  // pms_sync_log에 최종 실패 기록
          this.alertAdmin(job);  // 어드민 알림
        }
      }
    }
  }
}
```

---

## 6. 구현 우선순위 및 일정 제안

| 단계 | 내용 | 선행 조건 |
|---|---|---|
| **Phase 1** | PMS Client + DB 스키마 + 설정 | PMS API 문서 + 테스트 계정 |
| **Phase 2** | 재고/가격 Inbound 동기화 | Phase 1 + PMS 재고 API 확인 |
| **Phase 3** | 예약 양방향 동기화 | Phase 2 + PMS 예약 API 확인 |
| **Phase 4** | 어드민 모니터링 대시보드 | Phase 2~3 완료 |

---

## 7. 시작 전 필요한 정보

PMS 연동 구현을 시작하려면 다음 정보가 필요합니다:

1. **PMS 벤더/제품명** — High1이 사용 중인 PMS 시스템 (예: Oracle Opera, Mews, Cloudbeds 등)
2. **API 문서** — 엔드포인트, 인증 방식, 요청/응답 스키마
3. **테스트 환경** — Sandbox URL, API 키
4. **상품 코드 매핑표** — PMS의 객실 유형 코드 ↔ 자체 시스템의 room_type_id 대응표
5. **Webhook 지원 여부** — PMS가 이벤트 push를 지원하는지, polling만 가능한지
6. **데이터 갱신 주기 요구사항** — 실시간(초 단위) vs 준실시간(분 단위)
