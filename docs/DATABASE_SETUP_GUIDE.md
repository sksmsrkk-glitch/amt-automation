# High1 Resort — 실제 DB 구축 및 연결 가이드

> 대상: DB를 처음 다루는 개발자
> 현재 상태: sql.js (인메모리 파일 DB) → 목표: PostgreSQL (실제 운영 DB)

---

## 왜 DB를 바꿔야 하나?

현재 시스템의 `sql.js`는 **장난감 DB**입니다:

| 항목 | sql.js (현재) | PostgreSQL (목표) |
|---|---|---|
| 데이터 저장 | 메모리 → 파일 1개 (`high1.db`) | 전용 DB 서버에 영구 저장 |
| 동시 접속 | 1명만 안전 | 수백~수천 명 동시 처리 |
| 서버 재시작 | 데이터 유실 위험 | 안전하게 보존 |
| 백업/복구 | 수동 파일 복사 | 자동 백업, 시점 복구 |
| PMS 연동 | 불가능 (단일 프로세스) | 외부 시스템 동시 접근 가능 |

---

## 선택: Supabase (무료 클라우드 PostgreSQL)

설치 없이 5분 만에 실제 DB를 만들 수 있는 **Supabase**를 사용합니다.

**왜 Supabase인가?**
- 무료 플랜으로 충분 (500MB, 무제한 API)
- PostgreSQL 그대로 사용 (업계 표준)
- 설치 필요 없음 (웹 브라우저에서 관리)
- 나중에 AWS/자체 서버로 이전 쉬움

---

## Step 1: Supabase 계정 + 프로젝트 생성

### 1-1. 회원가입

1. https://supabase.com 접속
2. **Start your project** 클릭
3. GitHub 계정으로 로그인 (가장 간편)

### 1-2. 새 프로젝트 생성

1. **New Project** 클릭
2. 다음 값 입력:

| 항목 | 입력값 |
|---|---|
| Name | `high1-resort` |
| Database Password | 강력한 비밀번호 입력 (반드시 메모!) |
| Region | `Northeast Asia (Seoul)` 선택 |
| Plan | Free 선택 |

3. **Create new project** 클릭
4. 2~3분 기다리면 프로젝트 생성 완료

### 1-3. 연결 정보 확인

프로젝트 생성 후:

1. 좌측 메뉴 **Settings** (톱니바퀴) 클릭
2. **Database** 탭 클릭
3. **Connection string** 섹션에서 **URI** 복사

형태가 다음과 같습니다:
```
postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

**이 URI를 메모장에 저장해두세요.** 이후 코드에서 사용합니다.

---

## Step 2: 테이블 생성 (SQL 실행)

### 2-1. SQL Editor 열기

1. Supabase 대시보드 좌측 메뉴 → **SQL Editor** 클릭
2. **New query** 클릭

### 2-2. 아래 SQL을 통째로 복사 → 붙여넣기 → Run 클릭

```sql
-- ============================================
-- High1 Resort 전체 스키마 (PostgreSQL 버전)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  nationality TEXT,
  role TEXT DEFAULT 'customer',
  language TEXT DEFAULT 'en',
  google_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_cn TEXT,
  description_en TEXT,
  description_cn TEXT,
  address TEXT,
  image_url TEXT,
  images TEXT DEFAULT '[]',
  rating REAL DEFAULT 0,
  amenities TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_restricted INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_types (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_cn TEXT,
  description_en TEXT,
  description_cn TEXT,
  max_guests INTEGER DEFAULT 2,
  bed_type TEXT,
  amenities TEXT DEFAULT '[]',
  image_url TEXT,
  images TEXT DEFAULT '[]',
  base_price REAL NOT NULL,
  status TEXT DEFAULT 'active',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS room_inventory (
  id SERIAL PRIMARY KEY,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_rooms INTEGER NOT NULL,
  booked_rooms INTEGER DEFAULT 0,
  price REAL,
  UNIQUE(room_type_id, date)
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_cn TEXT,
  description_en TEXT,
  description_cn TEXT,
  category TEXT,
  image_url TEXT,
  images TEXT DEFAULT '[]',
  base_price REAL NOT NULL,
  duration TEXT,
  location TEXT,
  status TEXT DEFAULT 'active',
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_restricted INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_inventory (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_quantity INTEGER NOT NULL,
  booked_quantity INTEGER DEFAULT 0,
  price REAL,
  UNIQUE(ticket_id, date)
);

CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_cn TEXT,
  description_en TEXT,
  description_cn TEXT,
  image_url TEXT,
  images TEXT DEFAULT '[]',
  base_price REAL NOT NULL,
  includes TEXT DEFAULT '[]',
  duration TEXT,
  status TEXT DEFAULT 'active',
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_restricted INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS package_items (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS package_inventory (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_quantity INTEGER NOT NULL,
  booked_quantity INTEGER DEFAULT 0,
  price REAL,
  UNIQUE(package_id, date)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_number TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  product_type TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  room_type_id INTEGER,
  check_in TEXT,
  check_out TEXT,
  visit_date TEXT,
  guests INTEGER DEFAULT 1,
  quantity INTEGER DEFAULT 1,
  nights INTEGER DEFAULT 1,
  total_price REAL NOT NULL,
  currency TEXT DEFAULT 'KRW',
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  payment_id TEXT,
  special_requests TEXT,
  access_code_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'KRW',
  method TEXT DEFAULT 'stripe',
  stripe_payment_id TEXT,
  status TEXT DEFAULT 'pending',
  refund_amount REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  qr_data TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value REAL NOT NULL DEFAULT 0,
  product_type TEXT,
  product_id INTEGER,
  start_date TEXT,
  end_date TEXT,
  blackout_dates TEXT DEFAULT '[]',
  min_quantity INTEGER DEFAULT 1,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_until TEXT,
  note TEXT,
  status TEXT DEFAULT 'active',
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS showcases (
  id SERIAL PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_cn TEXT,
  summary_en TEXT,
  summary_cn TEXT,
  content_en TEXT,
  content_cn TEXT,
  thumbnail_url TEXT,
  images TEXT DEFAULT '[]',
  youtube_url TEXT,
  category TEXT DEFAULT 'facility',
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_access_codes_user_product ON access_codes(user_id, product_type, product_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_room_inv_date ON room_inventory(room_type_id, date);
CREATE INDEX IF NOT EXISTS idx_ticket_inv_date ON ticket_inventory(ticket_id, date);
```

**Run** 버튼을 클릭하면 모든 테이블이 생성됩니다.

> 성공 메시지: `Success. No rows returned` — 이게 정상입니다.

---

## Step 3: 백엔드 코드 수정

### 3-1. pg 패키지 설치

로컬 PowerShell에서:

```powershell
cd C:\Users\jhivv\amt-automation\backend
npm install pg
```

### 3-2. 환경변수 파일 생성

`backend/.env` 파일을 새로 만들고 (메모장으로):

```env
DATABASE_URL=postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
JWT_SECRET=my-super-secret-key-change-this
```

> ⚠️ `DATABASE_URL`은 Step 1-3에서 복사한 URI를 붙여넣으세요.
> ⚠️ `.env` 파일은 절대 git에 올리면 안 됩니다.

### 3-3. .gitignore에 .env 추가

`.gitignore` 파일에 다음 줄 추가:

```
.env
```

### 3-4. database.js 교체

이 단계는 제가 코드로 직접 수정해드립니다. 사용자분이 해야 할 것은:

1. Step 1 (Supabase 프로젝트 생성)
2. Step 2 (SQL 실행)
3. Step 3-1, 3-2, 3-3 (npm install + .env 생성)

이 세 가지를 완료하신 후 알려주시면, `database.js`를 PostgreSQL 연결 코드로 교체하고 전체 시스템이 실제 DB와 연결되도록 작업하겠습니다.

---

## 전체 흐름 요약

```
[지금 상태]
Express 서버 → sql.js → high1.db 파일 (내 컴퓨터 안에만 존재)

[목표 상태]
Express 서버 → pg 라이브러리 → Supabase PostgreSQL (클라우드 DB)
                                    ↑
                        인터넷 어디서든 접근 가능
                        PMS도 여기에 연결 가능
```

```
해야 할 일 (순서대로):

1. Supabase 가입 + 프로젝트 생성        ← 브라우저에서 5분
2. SQL Editor에서 테이블 생성            ← 위 SQL 복붙 + Run
3. npm install pg                       ← PowerShell 1줄
4. .env 파일에 DB 주소 입력              ← 메모장으로 1분
5. database.js 코드 교체                 ← 제가 해드림
6. seed.js 수정 + 초기 데이터 입력        ← 제가 해드림
7. 서버 재시작 → 실제 DB와 연결 완료!
```

---

## 자주 묻는 질문

### Q: 돈이 드나요?
Supabase 무료 플랜: 500MB 저장소, 무제한 API 호출. 이 프로젝트에 충분합니다.
유료로 전환할 필요가 생기면 월 $25부터 시작합니다.

### Q: 내 컴퓨터에 뭘 설치해야 하나요?
`npm install pg` 하나만 하면 됩니다. PostgreSQL 서버를 내 컴퓨터에 설치할 필요 없습니다 (Supabase가 클라우드에서 돌려줌).

### Q: 데이터가 날아가면?
Supabase가 자동으로 매일 백업합니다. 수동 백업도 대시보드에서 가능합니다.

### Q: 나중에 다른 DB로 바꿀 수 있나요?
Supabase는 표준 PostgreSQL입니다. AWS RDS, Google Cloud SQL, 자체 서버 등 어디로든 그대로 이전 가능합니다.

### Q: PMS 연동은?
실제 DB가 구축되면, PMS 서버도 같은 DB에 접속하거나 API를 통해 데이터를 주고받을 수 있습니다. 이것이 sql.js로는 불가능했던 핵심 기능입니다.
