# High1 예약 플랫폼 — 프로젝트 여정 & 시현 가이드

> **대상 독자**: 개발 지식이 없는 사내 동료
> **문서 목적**: 프로젝트 구축 과정을 함께 회고하고, 시현 자리에서 재현·설명할 수 있도록 돕는 가이드
> **작성일**: 2026-04-20
> **관련 문서**: `docs/PRD.md` (제품 기획서)

---

## 목차

0. [문서 개요](#0-문서-개요)
1. [프로젝트 한눈에 보기](#1-프로젝트-한눈에-보기)
2. [사전 준비물](#2-사전-준비물)
3. [개발 환경 구축 (Windows)](#3-개발-환경-구축-windows)
4. [GitHub 저장소 생성 및 연결](#4-github-저장소-생성-및-연결)
5. [Claude Code로 개발 진행한 흐름](#5-claude-code로-개발-진행한-흐름)
6. [Supabase 설정 (DB + Storage)](#6-supabase-설정-db--storage)
7. [Railway 배포](#7-railway-배포)
8. [시현 시나리오 (라이브 데모 대본)](#8-시현-시나리오-라이브-데모-대본)
9. [회고 (Retrospective)](#9-회고-retrospective)
10. [부록](#10-부록)

---

## 0. 문서 개요

### 0.1 이 문서는 왜 만들었나요?
우리는 지난 몇 주간 **AI 코딩 도구(Claude Code)** 를 활용해 하이원 리조트 외국인 전용 예약 플랫폼을 구축했습니다. 이 과정에서 사용한 **도구·절차·판단·실수**를 팀 전체가 공유하고, 나중에 다른 프로젝트에도 같은 방식을 재현할 수 있게 하기 위해 이 문서를 작성합니다.

### 0.2 독자
- **비개발 동료** (기획/영업/마케팅/운영/디자인 등)
- 개발 배경이 없어도 따라 읽을 수 있도록 모든 전문 용어를 처음 나올 때 풀어서 설명합니다.
- 시연 자리에서 **어깨 너머로 보고 따라 할 수 있는 수준**의 단계별 안내를 목표로 합니다.

### 0.3 읽는 법
- **시간이 없으면**: 1장(프로젝트 한눈에 보기) + 8장(시현 시나리오) + 9장(회고) 만 읽어도 됩니다.
- **처음부터 끝까지 재현하고 싶으면**: 2장부터 7장까지 순서대로 따라가세요.
- **막히면**: 10장 부록 C(자주 만나는 에러)를 먼저 확인하세요.

### 0.4 용어 미니 사전 (처음 접하는 동료를 위해)
| 용어 | 쉬운 설명 |
|------|----------|
| **레포(Repository)** | 프로젝트 파일 전체가 담긴 폴더. GitHub에 올리면 팀원들과 공유할 수 있습니다. |
| **커밋(Commit)** | "이 시점의 변경 내용을 기록으로 남긴다"는 행위. 파일 저장 + 변경 이력 메모를 합친 것과 같습니다. |
| **푸시(Push)** | 내 컴퓨터의 변경 내용을 GitHub(클라우드)로 업로드하는 것. |
| **배포(Deploy)** | 우리가 만든 웹사이트를 인터넷에 공개해서 실제로 누구나 접속할 수 있게 만드는 작업. |
| **환경변수** | 비밀번호·API 키처럼 **코드에 직접 써넣으면 안 되는 민감한 값**을 따로 저장하는 방식. |
| **CLI / 터미널** | 검은 화면에 명령어를 입력해서 컴퓨터를 조작하는 도구. (마우스 대신 키보드로 조작) |
| **CDN** | 이미지·영상 파일을 전 세계 어디서든 빠르게 불러올 수 있게 해주는 저장·배포망. |
| **Claude Code** | Anthropic의 AI가 터미널 안에서 직접 코드를 읽고·쓰고·실행하는 도구. 우리 프로젝트의 주 개발 도구. |

---

## 1. 프로젝트 한눈에 보기

### 1.1 우리가 만든 것
**High1 Resort 외국인 전용 예약 플랫폼** — 하이원 리조트의 스키·액티비티·숙박·패키지 상품을 **외국인이 영어/중국어로** 직접 예약할 수 있는 웹사이트입니다.

| 부분 | 누가 사용? | 접속 주소 (로컬 기준) |
|------|-----------|----------------------|
| **고객 사이트** | 외국인 방문객 | `http://localhost:3000` |
| **관리자 사이트** | 하이원 운영자 | `http://localhost:3001` |
| **백엔드 API** | (고객·관리자 사이트가 내부적으로 호출) | `http://localhost:4000` |

### 1.2 전체 아키텍처 (그림)

```
  [외국인 고객 브라우저]                [하이원 운영자 브라우저]
         │                                     │
         ▼                                     ▼
  ┌─────────────┐                      ┌──────────────┐
  │  고객 사이트 │                      │  관리자 사이트│
  │   (React)   │                      │    (React)   │
  └──────┬──────┘                      └──────┬───────┘
         │ (예약/조회 요청)                    │ (상품/예약 관리)
         └──────────────┬──────────────────────┘
                        ▼
                ┌───────────────┐
                │   백엔드 API   │
                │   (Express)   │
                └───────┬───────┘
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
    ┌──────────────┐         ┌──────────────┐
    │  Supabase    │         │  Supabase    │
    │ PostgreSQL   │         │   Storage    │
    │  (데이터)    │         │  (이미지)    │
    └──────────────┘         └──────────────┘

          ▲ ▲ ▲ 위 전체가 Railway 라는 클라우드에 배포됨
```

**요약**:
- 고객·관리자가 보는 **화면 2개**와, 그 뒤에서 데이터를 주고받는 **API 서버 1개** = 총 3개의 프로그램이 동시에 돕니다.
- 데이터는 **Supabase** 라는 서비스의 PostgreSQL 데이터베이스에 저장됩니다.
- 이미지(호텔 사진, 쇼케이스 이미지 등)는 **Supabase Storage** 에 저장됩니다.
- 전체는 **Railway** 라는 클라우드 플랫폼에 올려서 24시간 인터넷에 노출됩니다.

### 1.3 완료된 범위 (v1.0 기준)
- ✅ 고객 사이트: 영어/중국어, 호텔/티켓/패키지 예약, 회원/게스트 모두 지원, 예약 조회·취소
- ✅ 관리자 사이트: 상품·재고·예약·결제·프로모션·쇼케이스 관리, 대시보드 통계
- ✅ Google 소셜 로그인, 이미지 업로드, 다국어 콘텐츠
- ✅ Supabase PostgreSQL 연동, Supabase Storage 연동
- ✅ Railway 자동 배포 (GitHub에 푸시 → 자동으로 웹사이트 업데이트)

### 1.4 남은 작업 (로드맵)
상세 내용은 `docs/PRD.md` 11장 참고.
- 🔜 결제(Stripe/Alipay/WeChat Pay) 실연동
- 🔜 이메일 발송 (예약 확정/취소 알림)
- 🔜 PMS(리조트 내부 시스템) 연동 — 재고·가격 실시간 동기화

### 1.5 이 프로젝트가 특별한 이유
> **"개발자 1명 + AI(Claude Code)" 조합으로 몇 주 만에 풀스택 웹 플랫폼을 완성했다.**

전통적으로 이 정도 규모(고객 사이트 + 관리자 페이지 + 백엔드 + DB + 배포)의 플랫폼은 개발자 여러 명과 수개월이 걸렸습니다. 이번 프로젝트는 **AI에게 정확한 지시를 내리는 방법**과 **결과물을 검증하는 체계**를 갖추면 생산성이 몇 배로 올라간다는 것을 실증했습니다.

---

## 2. 사전 준비물

### 2.1 필요한 계정 (모두 무료 가입 가능)

| 서비스 | 용도 | 무료 플랜으로 가능한가? |
|--------|------|----------------------|
| **GitHub** | 소스코드 저장·공유 | ✅ 가능 |
| **Anthropic** | Claude Code 사용 (AI 코딩 도구) | ⚠️ API 사용량 과금 (초기 크레딧 제공) |
| **Supabase** | 데이터베이스 + 이미지 저장 | ✅ 가능 (500MB DB, 1GB Storage까지) |
| **Railway** | 웹사이트 배포 (호스팅) | ⚠️ 월 $5 크레딧 무료, 초과 시 종량제 |
| **Google Cloud** | Google 로그인 기능 | ✅ 가능 (OAuth는 무료) |

> 💡 **예상 월 비용**: 트래픽이 적은 초기엔 거의 **0원~$10 이내**. 사용자가 늘어나면 Railway/Supabase가 먼저 유료로 전환됩니다.

### 2.2 필요한 소프트웨어 (모두 무료)

| 이름 | 역할 | 공식 다운로드 |
|------|------|-------------|
| **Node.js 20+** | 우리 프로젝트를 실행하는 엔진 (JavaScript 런타임) | https://nodejs.org |
| **Git** | 소스코드 버전관리 도구 | https://git-scm.com |
| **VS Code** | 코드 편집기 (메모장의 고급 버전) | https://code.visualstudio.com |
| **PowerShell** | 윈도우 기본 터미널 (이미 설치되어 있음) | Windows 기본 내장 |
| **Claude Code** | AI 코딩 도구 (터미널에서 실행) | npm으로 설치 (3장 참고) |

### 2.3 예상 소요 시간

| 단계 | 예상 시간 (처음 해보는 경우) |
|------|---------------------------|
| 소프트웨어 설치 (Node/Git/VSCode) | 30분 |
| GitHub 계정 및 레포 생성 | 15분 |
| Claude Code 설치 및 인증 | 15분 |
| Supabase 가입 + DB 스키마 생성 | 30분 |
| Railway 가입 + 배포 | 30분 |
| **합계 (처음)** | **약 2시간** |
| 두 번째부터는 | **30~40분이면 끝** |

### 2.4 준비 체크리스트 (시현 전날 점검)
- [ ] 회사 이메일로 GitHub/Supabase/Railway/Anthropic 계정 가입 완료
- [ ] 노트북에 Node.js, Git, VS Code 설치
- [ ] 각 서비스에 로그인된 상태 유지 (시연 중 로그인 반복 방지)
- [ ] 인터넷 연결 (모바일 핫스팟 백업 준비)
- [ ] 이 문서(`DEMO_GUIDE.md`)를 브라우저 탭으로 열어두기
- [ ] `docs/PRD.md` 도 같이 열어두기 (질문 대응용)

---

## 3. 개발 환경 구축 (Windows)

> **이 장의 목표**: 아무것도 설치되지 않은 새 노트북에서 30분 안에 "Claude Code 실행 가능" 상태까지 만들기.

### 3.1 Node.js 설치

**Node.js는 무엇인가요?**
우리 웹사이트를 실제로 돌리는 **엔진**입니다. 엑셀 파일을 열려면 엑셀이 필요하듯, 이 프로젝트를 실행하려면 Node.js가 필요합니다.

**설치 순서**:
1. 브라우저에서 https://nodejs.org 접속
2. **LTS (Long Term Support)** 버전 다운로드 — 화면에서 "LTS" 라고 표시된 녹색 버튼
3. 다운받은 `.msi` 파일 실행 → 모든 옵션을 **기본값**으로 두고 Next 연타
4. 설치 완료 후 **PowerShell 창을 열어서** 아래 명령 실행:

```powershell
node --version
# 예상 출력: v20.11.1 (숫자는 달라도 v20 이상이면 OK)

npm --version
# 예상 출력: 10.2.4
```

> 💡 **PowerShell을 여는 법**: 시작 메뉴 → "PowerShell" 검색 → **Windows PowerShell** 클릭

### 3.2 Git 설치

**Git은 무엇인가요?**
"언제·누가·어떤 파일을 어떻게 바꿨는지" 기록해주는 도구입니다. 파일 이름을 `최종_진짜최종_v3.docx` 식으로 관리할 필요가 없어집니다.

**설치 순서**:
1. https://git-scm.com/download/win 접속 → 자동 다운로드
2. 설치 중 대부분 기본값 유지. 단 아래 2개 옵션만 체크:
   - **"Use Visual Studio Code as Git's default editor"** (VS Code를 먼저 설치했다면)
   - **"Git from the command line and also from 3rd-party software"** (기본 선택됨)
3. 설치 완료 후 PowerShell에서 확인:

```powershell
git --version
# 예상 출력: git version 2.43.0.windows.1
```

**Git 초기 설정 (최초 1회)**:

```powershell
git config --global user.name "홍길동"
git config --global user.email "hong@high1.com"
```

> 💡 이름·이메일은 **GitHub에 올라가는 커밋 기록에 공개**됩니다. 회사 이메일 권장.

### 3.3 VS Code 설치

**VS Code는 무엇인가요?**
마이크로소프트가 만든 **무료 코드 편집기**. 메모장으로도 코드를 볼 수는 있지만, VS Code는 문법 강조·자동완성·터미널 내장 등 편의 기능이 많습니다.

**설치 순서**:
1. https://code.visualstudio.com 접속 → **Download for Windows** 클릭
2. `.exe` 실행 → 모든 기본값으로 설치
3. 설치 중 아래 옵션 체크 권장:
   - ✅ "Add 'Open with Code' action to Windows Explorer file context menu"
   - ✅ "Add 'Open with Code' action to Windows Explorer directory context menu"
   - ✅ "Add to PATH"

**VS Code 추천 확장 프로그램** (좌측 네모 아이콘에서 검색):
| 확장 이름 | 용도 |
|----------|------|
| **ESLint** | 코드 문법·스타일 자동 검사 |
| **Prettier** | 코드 자동 정렬 |
| **GitLens** | Git 기록을 코드 편집기 안에서 시각화 |
| **Korean Language Pack** | VS Code 메뉴를 한국어로 변경 (선택) |

### 3.4 PowerShell 기본 설정

**왜 설정이 필요한가요?**
윈도우 PowerShell은 보안상 **처음엔 스크립트 실행이 막혀 있습니다**. `start.sh` 같은 자동화 스크립트를 쓰려면 살짝 풀어줘야 합니다.

**1) 실행 정책 변경** (최초 1회, PowerShell을 **관리자 권한**으로 열어서):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Y 입력 후 엔터
```

> 💡 **관리자 권한 실행**: 시작 메뉴에서 PowerShell 우클릭 → "관리자 권한으로 실행"

**2) 한글 출력 깨짐 방지** (선택, UTF-8 출력):

```powershell
# PowerShell 프로필에 추가
notepad $PROFILE
```

메모장이 열리면 아래 한 줄 붙여넣고 저장:
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

### 3.5 Claude Code 설치 ⭐ (이 프로젝트의 핵심 도구)

**Claude Code는 무엇인가요?**
Anthropic 이 만든 **터미널용 AI 코딩 비서**. "호텔 예약 페이지 만들어줘" 라고 한글로 말하면 실제로 파일을 생성하고, 코드를 쓰고, 실행해서 결과를 확인해줍니다. 이번 프로젝트의 대부분은 Claude Code 와의 대화로 만들어졌습니다.

**설치 순서**:

**1) npm 으로 전역 설치** (PowerShell에서):

```powershell
npm install -g @anthropic-ai/claude-code
```

> 설치에 1~2분 소요. 에러 나면 PowerShell을 **관리자 권한**으로 다시 열어서 재시도.

**2) 설치 확인**:

```powershell
claude --version
# 예상 출력: 1.x.x (버전 숫자는 다를 수 있음)
```

**3) 처음 실행 및 로그인**:

```powershell
# 프로젝트 폴더로 이동 (예시)
cd C:\Users\사용자명\projects\amt-automation

# Claude Code 실행
claude
```

- 처음 실행하면 브라우저가 열리면서 **Anthropic 계정 로그인** 화면이 나옵니다.
- 회사 이메일로 가입 → 로그인 → 권한 승인 → 터미널로 자동 복귀
- 터미널에 **"Welcome to Claude Code"** 프롬프트가 뜨면 성공 ✅

**Claude Code 기본 사용법**:
```
> 안녕, 현재 프로젝트 구조 알려줘
```
한글로 질문하면 답해줍니다. 코드 작업도:
```
> frontend/src/pages/Home.jsx 의 히어로 이미지를 교체해줘
```

### 3.6 터미널 연결 방식 3가지 비교

프로젝트를 실행할 때 **어떤 터미널에서 명령을 입력할지** 선택할 수 있습니다.

| 방식 | 장점 | 단점 | 추천 대상 |
|------|------|------|----------|
| **윈도우 PowerShell** | 바로 사용 가능, 별도 설치 불필요 | VS Code 와 창을 오가야 함 | 처음 접하는 동료 |
| **VS Code 내장 터미널** ⭐ | 코드와 터미널이 한 화면, 여러 개 동시에 열기 가능 | VS Code 를 먼저 열어야 함 | **권장** (개발 중엔 이걸 씀) |
| **Git Bash** | Mac/Linux 명령어(`ls`, `rm` 등) 지원 | Windows 고유 명령 일부 동작 안함 | 리눅스 친화적인 동료 |

**VS Code 내장 터미널 여는 법** (가장 많이 씀):
1. VS Code 실행 → 프로젝트 폴더 열기 (`File > Open Folder`)
2. 메뉴에서 `Terminal > New Terminal` 또는 단축키 **`` Ctrl + ` ``** (백틱)
3. 하단에 터미널 창이 열림 → 여기서 `claude` 입력해서 Claude Code 시작

**한 화면에 여러 터미널 띄우기 (권장 구성)**:
우리 프로젝트는 **3개 프로세스를 동시에 실행**해야 하므로 VS Code 에서 터미널을 3개 열어서 각각 사용하면 편합니다.
- 터미널 1: 백엔드 (`cd backend && npm start`)
- 터미널 2: 프론트엔드 (`cd frontend && npm run dev`)
- 터미널 3: 관리자 (`cd admin && npm run dev`)

또는 한 번에 모두 실행하는 `./start.sh` 스크립트를 사용 (10장 부록 E 참고).

### 3.7 이 장이 끝나면 가능해지는 것
✅ 내 노트북에서 `claude` 명령 실행 가능
✅ VS Code 에서 프로젝트 파일 편집 가능
✅ PowerShell 에서 Node.js 기반 프로그램 실행 가능
✅ Git 으로 변경 이력 기록 가능

---

## 4. GitHub 저장소 생성 및 연결

> **이 장의 목표**: 프로젝트 파일을 GitHub(클라우드)에 올려서, 팀원들과 공유하고 배포 자동화의 기반을 마련.

### 4.1 GitHub 계정 생성

1. https://github.com 접속 → **Sign up** 클릭
2. 회사 이메일 입력 → 비밀번호 설정 → 사용자 이름 정하기 (예: `sksmsrkk-glitch`)
3. 이메일 인증 완료
4. 무료 플랜 선택 (우리 프로젝트는 무료 플랜으로 충분)

### 4.2 새 레포지터리 생성

**"레포"는 무엇인가요?**
프로젝트 전체가 담긴 **클라우드 폴더**. GitHub에 만든 레포는 전 세계 어디서든 접근할 수 있고, 변경 이력이 자동으로 쌓입니다.

1. GitHub 로그인 후 우측 상단 `+` 아이콘 → **New repository** 클릭
2. 입력 항목:
   - **Repository name**: `amt-automation`
   - **Description**: "High1 Resort 외국인 전용 예약 플랫폼"
   - **Public / Private**: 초기엔 **Private** 권장 (회사 내부용이면)
   - **Add a README file**: 체크 해제 (이미 로컬에 있으므로)
   - **Add .gitignore**: None (직접 관리)
   - **License**: None
3. **Create repository** 클릭

생성 직후 화면에 "Quick setup" 안내가 나오는데, 이 URL을 **복사**해두세요:
```
https://github.com/sksmsrkk-glitch/amt-automation.git
```

### 4.3 로컬 프로젝트를 GitHub에 연결하기

**PowerShell 또는 VS Code 터미널에서**:

```powershell
# 1. 프로젝트 폴더로 이동
cd C:\Users\사용자명\projects\amt-automation

# 2. Git 초기화 (이미 git 프로젝트면 생략)
git init

# 3. 원격 저장소 주소 등록
git remote add origin https://github.com/sksmsrkk-glitch/amt-automation.git

# 4. 모든 파일을 추가
git add .

# 5. 첫 커밋 생성
git commit -m "chore: initial commit"

# 6. 기본 브랜치를 main 으로 설정
git branch -M main

# 7. GitHub에 업로드 (푸시)
git push -u origin main
```

**처음 푸시할 때**:
- 브라우저에서 GitHub 로그인 창이 뜨면 로그인
- 또는 **Personal Access Token(PAT)** 을 비밀번호 대신 입력하라고 안내됨 (4.4 참고)

### 4.4 인증 방법: HTTPS + PAT (권장)

**왜 비밀번호 말고 PAT 인가요?**
2021년부터 GitHub은 **명령줄에서 비밀번호 입력을 금지**했습니다. 대신 임시 토큰(PAT)을 발급받아 사용합니다.

**PAT 발급 순서**:
1. GitHub 우측 상단 프로필 아이콘 → **Settings**
2. 좌측 메뉴 하단 **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token (classic)**
5. 입력 항목:
   - **Note**: "Claude Code on Windows" (메모용)
   - **Expiration**: 90일 또는 No expiration
   - **Scopes**: `repo` 전체 체크, `workflow` 체크 (CI/CD 자동화용)
6. **Generate token** 클릭 → 화면에 뜬 `ghp_...` 로 시작하는 문자열을 **꼭 복사해서 메모장에 저장**
   - ⚠️ 이 화면을 벗어나면 다시는 볼 수 없습니다.

**PAT 사용**:
- `git push` 시 Username: GitHub 사용자 이름, Password: **방금 복사한 PAT** 입력
- 한 번 입력하면 윈도우 자격 증명 관리자에 저장되어 다음부터 자동 입력됨

### 4.5 `.gitignore` — 올리면 안 되는 파일 차단

**왜 필요한가요?**
`.env` 같은 **민감 정보 파일**이나, `node_modules/` 같은 **용량 큰 자동 생성 파일**은 GitHub에 올리면 안 됩니다. `.gitignore` 는 "이 파일/폴더는 무시해라" 는 규칙 목록입니다.

우리 프로젝트의 `.gitignore` 핵심 규칙:
```
# 노드 모듈 (자동 생성, 용량 큼)
node_modules/

# 환경변수 (민감 정보 포함)
.env
.env.local
.env.production

# 로컬 DB 데이터 (개발용)
backend/data/

# 빌드 결과물
dist/
build/

# OS/IDE 파일
.DS_Store
Thumbs.db
.vscode/
.idea/
```

> 💡 **실수로 `.env` 를 올렸다면?** 히스토리까지 삭제해야 안전 (`git filter-branch` 또는 `BFG Repo-Cleaner`). 되도록 처음부터 올리지 않도록 주의!

### 4.6 브랜치 전략 (간단 버전)

**"브랜치"는 무엇인가요?**
같은 프로젝트의 **여러 평행 세계**. 새 기능을 개발할 때 `main` 을 건드리지 않고 `feat/booking-flow` 같은 별도 브랜치에서 작업하면, 문제가 생겨도 `main` 은 안전합니다.

우리 프로젝트에서 쓴 브랜치 이름 규칙:
| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feat/` | 신규 기능 | `feat/supabase-storage-uploads` |
| `fix/` | 버그 수정 | `fix/surface-backend-error-messages` |
| `docs/` | 문서만 수정 | `docs/add-deploy-guide` |
| `chore/` | 설정·의존성 업데이트 | `chore/update-deps` |
| `claude/` | Claude Code가 작업한 브랜치 | `claude/high1-planning-document-aquXi` |

**브랜치 작업 흐름**:
```
main (안정 버전)
 │
 ├── feat/booking-flow ─── 작업 중 ───► PR(검토) ───► main에 병합
 │
 ├── fix/login-error ───── 작업 중 ───► PR ──────────► main에 병합
 │
 └── docs/demo-guide ───── 작업 중 ───► PR ──────────► main에 병합
```

### 4.7 이 장이 끝나면 가능해지는 것
✅ GitHub에 프로젝트 소스코드 공개·공유
✅ 팀원이 `git clone` 으로 내려받아 자기 노트북에서 작업 가능
✅ Railway 가 GitHub 을 감시하다가 **push 되면 자동 배포** 되도록 연결 준비 완료

---

## 5. Claude Code로 개발 진행한 흐름

> **이 장의 목표**: 우리가 Claude Code 와 **어떻게 대화하며** 이 프로젝트를 만들었는지 실제 사례로 보여주기.

### 5.1 `CLAUDE.md` — Claude 에게 프로젝트를 소개하는 문서

**이게 왜 중요한가요?**
Claude Code 는 매 세션마다 프로젝트를 **처음 보는 신입사원** 같습니다. 매번 "우리 프로젝트는 이런 구조고, 이런 규칙이 있어요" 라고 설명하는 건 비효율적이죠. `CLAUDE.md` 파일을 프로젝트 루트에 두면 Claude 가 세션 시작 시 **자동으로 읽어서** 프로젝트 맥락을 파악합니다.

우리 `CLAUDE.md` 에 담긴 것:
- 프로젝트 개요 (백엔드/프론트엔드/관리자 3분할 구조)
- 포트 번호, 로그인 계정 정보
- 기술 스택 (Node.js, Express, React, sql.js → PostgreSQL)
- 개발 시 유의사항 (i18n 동시 업데이트, JWT 미들웨어 통과 등)
- **코딩 원칙** (명시적 코드 선호, 미들웨어 남용 자제 등)

### 5.2 `.claude/` 폴더 — 심화 설정

```
.claude/
├── CLAUDE.md               # 세션 규칙 (11개 critical rules)
├── skills/                 # 단계별 규칙 (dev/test/quality/security)
│   ├── dev_agent.skill.yaml
│   ├── test_agent.skill.yaml
│   ├── quality_agent.skill.yaml
│   └── security_agent.skill.yaml
├── pipeline.yaml           # 4단계 파이프라인 정의
└── hooks/                  # 자동 실행 스크립트
    ├── compile_check.sh        # JS/JSX 저장 시 문법 자동 검증
    └── pipeline_trigger.sh     # 개발 키워드 감지 시 파이프라인 활성화
```

**핵심 개념 — 4단계 파이프라인**:
사용자가 "개발해줘", "구현해줘" 같은 키워드로 요청하면, Claude Code 가 자동으로 4단계를 순서대로 실행합니다.

| 단계 | 역할 | 중단 조건 |
|------|------|----------|
| **1. Development** | 코드 작성/수정 | 문법 오류 |
| **2. Testing** | Jest/Supertest 테스트 작성·실행 | 테스트 실패 |
| **3. Quality** | ESLint 기준 품질 검증 | 린트 위반 |
| **4. Security** | OWASP 기준 보안 점검 | 보안 취약점 |

각 단계 완료 후 **사용자 승인**을 받고 다음 단계로 진행 → 품질을 자동으로 높이는 구조.

### 5.3 우리가 실제로 사용한 프롬프트 사례

#### 사례 A — 초기 프로젝트 뼈대 만들기
```
High1 리조트의 외국인 전용 예약 플랫폼을 만들어줘.
- 백엔드: Node.js + Express + sql.js
- 프론트엔드: React + Vite (영어/중국어 i18n)
- 관리자: 별도 React 앱
- 기능: 호텔/티켓/패키지 예약, 회원/게스트, JWT 인증
- 3개를 동시에 실행하는 start.sh 스크립트도 만들어줘
```

**결과**: Claude 가 `backend/`, `frontend/`, `admin/` 3개 폴더 생성, 각각 package.json/의존성/라우터/페이지 스캐폴딩, 공통 실행 스크립트까지 자동 생성.

#### 사례 B — 기능 개발 (이미지 업로드)
```
관리자가 상품 이미지를 업로드할 수 있도록 기능을 추가해줘.
Railway 같은 클라우드는 재시작 시 파일이 날아가므로
Supabase Storage 를 써야 해. 단건/다중(최대 10장) 모두 지원하고,
관리자 페이지에 업로드 UI 도 같이 만들어줘.
```

**결과**:
- `backend/src/routes/admin/upload.js` 생성 (multer + Supabase SDK)
- `admin/src/components/ImageUpload.jsx` 생성
- `docs/SUPABASE_STORAGE_SETUP.md` 문서까지 자동 작성
- 기존 상품 등록 페이지에 자동 연결

#### 사례 C — 버그 수정 (HTTP 500 에러)
```
관리자 페이지에서 상품을 삭제할 때 "HTTP 500" 이라고만 뜨고
실제 오류 메시지가 안 보여. 백엔드가 내려주는 에러 메시지를
프론트에 그대로 노출해줘.
```

**결과**: 실제 커밋 `cf61bf6 fix(admin): 백엔드 에러 메시지가 'HTTP 500' 으로만 보이던 문제` — 프론트/관리자의 fetch wrapper 를 수정하여 서버 응답의 `error.message` 를 파싱해 화면에 표시.

#### 사례 D — 대규모 리팩터링 (DB 이전)
```
sql.js(파일 기반 SQLite)로는 Railway 배포 후 재시작 시 데이터가 날아가.
Supabase PostgreSQL 로 이전해줘. 기존 API 시그니처는 유지하고,
DATABASE_URL 환경변수만 바뀌면 동작하도록. 마이그레이션 가이드 문서도 작성.
```

**결과**: `backend/src/config/db.js` 재작성, 전체 라우터의 쿼리 호환성 확인, `docs/DATABASE_SETUP_GUIDE.md` 생성.

#### 사례 E — 문서 생성 (본 가이드 포함)
```
지금까지 진행한 내용을 바탕으로 PRD(제품 요구사항 문서)를 만들어줘.
12장 구성으로. 본문은 docs/PRD.md 파일로 저장하고,
답변에도 같은 내용을 보여줘.
```

**결과**: `docs/PRD.md` (1,249줄) — 기능명세·데이터모델·API·비기능요구사항·로드맵을 통합한 기획문서 자동 생성.

### 5.4 잘 된 프롬프트 vs 실패했던 프롬프트

#### ✅ 잘 된 프롬프트의 공통점
1. **목적이 명확**: "왜 필요한가" 를 같이 설명
2. **제약조건 명시**: "기존 API는 유지", "환경변수로만 제어"
3. **결과물 형태 지정**: "파일로 저장", "문서도 함께", "커밋 메시지는 feat: 로 시작"
4. **참고 자료 제시**: "기존 `docs/xxx.md` 참고"

#### ❌ 실패했던 프롬프트의 공통점
1. **너무 추상적**: "예약 기능 좋게 만들어줘" → Claude 가 판단 기준이 없어 엉뚱한 방향
2. **한 번에 너무 많이**: "결제·이메일·SMS·PMS 연동 모두 해줘" → 중간에 중단 or 품질 저하
3. **검증 단계 생략**: "빨리 그냥 해줘" → 버그 누락
4. **컨텍스트 누락**: 기존 파일/규칙을 안 알려주고 요청 → 코드 스타일 불일치

### 5.5 Claude Code 사용 팁 TOP 10

1. **`CLAUDE.md` 를 먼저 잘 써두기** — 모든 세션의 출발점
2. **"왜 필요한가"를 프롬프트에 포함** — 판단 품질 향상
3. **큰 작업은 쪼개서 요청** — 한 번에 3~4 파일 수준
4. **단계별 승인 요청** — "계획 먼저 보여주고, 승인 받으면 실행"
5. **결과는 반드시 직접 확인** — AI 는 "될 것처럼" 보고할 수 있음
6. **커밋은 작게 자주** — 문제 생기면 되돌리기 쉬움
7. **`.claude/skills/` 로 규칙 고정** — 매번 반복 설명 불필요
8. **훅(hook)으로 검증 자동화** — 저장 시 문법 체크 등
9. **실패한 프롬프트는 기록** — 다음엔 같은 실수 안 함
10. **민감 정보는 절대 프롬프트에 직접 쓰지 말기** — `.env` 에만 저장

### 5.6 이 장이 끝나면 가능해지는 것
✅ `CLAUDE.md` 만 잘 써두면 Claude 가 프로젝트 맥락을 자동 파악
✅ 4단계 파이프라인으로 품질을 자동 검증
✅ 어떤 프롬프트가 잘 먹히는지 감이 생김

---

## 6. Supabase 설정 (DB + Storage)

> **이 장의 목표**: 우리 웹사이트가 사용할 **데이터베이스**와 **이미지 저장소**를 Supabase 에서 만들고 연결하기.

### 6.1 Supabase 는 무엇인가요?

**한 줄 설명**: "아마존 AWS 의 어려운 부분을 쉽게 포장해서 가입 5분이면 쓸 수 있게 만든 서비스".

**우리가 Supabase 에서 쓰는 기능**:
| 기능 | 용도 | 비유 |
|------|------|------|
| **PostgreSQL Database** | 예약·사용자·상품 데이터 저장 | 엑셀 파일 (단, 수백만 건도 빠르게 처리) |
| **Storage** | 이미지·파일 저장 | 구글 드라이브 (단, 웹사이트에서 바로 불러올 수 있음) |
| **Auth (선택)** | 사용자 인증 (우리는 자체 JWT 사용, 이 기능은 미사용) | - |

**왜 Supabase 를 골랐나요?**
- ✅ 무료 플랜으로 시작 가능 (DB 500MB, Storage 1GB)
- ✅ PostgreSQL 은 업계 표준 → 나중에 다른 서비스로 이전도 쉬움
- ✅ 이미지 CDN 이 내장 → 별도 서비스(AWS S3, Cloudflare R2) 설정 불필요
- ✅ GUI 대시보드가 친절 → 비개발자도 데이터 직접 조회·편집 가능

### 6.2 Supabase 가입

1. https://supabase.com 접속 → **Start your project** 클릭
2. **Sign in with GitHub** 선택 (GitHub 계정으로 바로 가입)
3. GitHub 인증 승인
4. 조직(Organization) 이름 입력 — 예: `high1-resort` (본인 or 회사 이름)

### 6.3 프로젝트 생성

1. 대시보드에서 **New project** 클릭
2. 입력 항목:
   - **Project name**: `high1-platform`
   - **Database Password**: **강력한 비밀번호 생성** (DB 접속용, 메모장에 복사·보관 필수)
     - 💡 비밀번호 생성 버튼 `Generate a password` 클릭하면 자동 생성됨
   - **Region**: `Northeast Asia (Seoul)` — 한국·중국 고객 대상이면 서울 권장
   - **Pricing Plan**: `Free` (무료 플랜)
3. **Create new project** 클릭 → 1~2분 대기

### 6.4 PostgreSQL 연결 정보 확인 ⭐

프로젝트 생성 완료 후:

1. 좌측 메뉴 하단의 **⚙️ Project Settings** 클릭
2. **Database** 섹션 → **Connection string** 탭
3. 아래 정보를 **메모장에 복사** (시현 중 빨리 찾을 수 있도록):

```
Connection String (URI):
postgresql://postgres:[비밀번호]@db.xxxxxxxx.supabase.co:5432/postgres

Host: db.xxxxxxxx.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: (프로젝트 생성 시 설정한 비밀번호)
```

> ⚠️ **주의**: 이 정보는 **우리 DB 의 마스터 키**와 같습니다. 절대 GitHub에 올리거나 외부에 공유하지 마세요. 오직 `.env` 파일(로컬) 또는 Railway 환경변수(운영)에만 저장.

### 6.5 DB 스키마(테이블) 생성

**"스키마" 는 무엇인가요?**
엑셀로 치면 "시트 이름 + 열 이름" 을 미리 정의하는 것. 우리 프로젝트는 `users`, `hotels`, `bookings` 등 10여 개 테이블이 필요합니다.

1. Supabase 대시보드 좌측 메뉴에서 **SQL Editor** 클릭
2. 우측 **New query** 클릭
3. 우리 레포의 `docs/DATABASE_SETUP_GUIDE.md` 에 있는 **전체 SQL 스크립트를 복사·붙여넣기** (약 200줄)
4. **Run** 버튼 (또는 `Ctrl + Enter`) 클릭
5. "Success. No rows returned" 같은 메시지가 나오면 성공 ✅

**확인 방법**:
좌측 메뉴 **Table Editor** → 좌측 패널에 `users`, `hotels`, `bookings`, `tickets`, `packages`, `showcases` 등이 나열되면 정상.

### 6.6 초기 데이터(시드) 삽입

우리 프로젝트는 `backend/src/seed.js` 로 샘플 데이터(테스트용 호텔·티켓·관리자 계정)를 자동 생성합니다.

**로컬에서 실행**:
```powershell
cd backend
npm run seed
```

**확인**: Supabase **Table Editor → users** 테이블에 `admin@high1.com` 과 `guest@test.com` 두 계정이 생겼는지 확인.

### 6.7 Storage Bucket 생성 (이미지 저장소)

1. 좌측 메뉴 **Storage** 클릭
2. **New bucket** 클릭
3. 입력 항목:
   - **Name**: `product-images`
   - **Public bucket**: ✅ 체크 (고객 사이트에서 이미지를 공개 URL 로 불러와야 하므로)
4. **Create bucket** 클릭

**파일 크기 제한 설정** (권장):
- 생성된 bucket 우측 `...` → **Edit bucket** → **File size limit**: `10 MB`
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

### 6.8 Service Role Key 발급 (서버에서 Storage 에 파일 올릴 때 필요)

1. 좌측 하단 **⚙️ Project Settings** → **API** 클릭
2. 페이지에서 확인할 것:
   - **Project URL**: `https://xxxxxxxx.supabase.co` → 메모장에 복사
   - **Project API keys** → `service_role` → **Reveal** 클릭 → 긴 문자열 복사
3. 두 값을 환경변수로 사용:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_KEY` = service_role key

> ⚠️ **service_role 키 는 관리자 전용**. 고객 브라우저(프론트엔드)에는 절대 노출 금지. 오직 **백엔드 서버**에서만 사용.

### 6.9 로컬 `.env` 파일 만들기

**`.env` 파일은 무엇인가요?**
환경변수(민감 정보)를 담는 파일. 코드 안에 비밀번호를 직접 쓰지 않고, 이 파일에서 읽어오는 방식. `.gitignore` 에 포함되어 **GitHub에 올라가지 않습니다**.

`backend/` 폴더 안에 `.env` 파일을 만들고 아래 내용 입력:

```bash
# ============ Supabase ============
DATABASE_URL=postgresql://postgres:비밀번호@db.xxxxxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...긴문자열...

# ============ JWT (임의 문자열) ============
JWT_SECRET=여기에-32자-이상의-랜덤-문자열-붙여넣기

# ============ 기타 ============
NODE_ENV=development
PORT=4000

# Google 로그인 활성화 시 (선택)
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

**JWT_SECRET 랜덤 문자열 생성 방법**:
PowerShell 에서:
```powershell
# 32바이트 랜덤 문자열 생성
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```
출력된 문자열을 `JWT_SECRET=` 뒤에 붙여넣기.

### 6.10 연결 테스트

```powershell
cd backend
npm start
```

**정상 출력 예시**:
```
✅ Connected to PostgreSQL database
✅ Server listening on port 4000
```

**에러 나는 경우**:
- `ECONNREFUSED` → `DATABASE_URL` 의 호스트/포트 오타 확인
- `password authentication failed` → 비밀번호 오타 (특수문자 URL 인코딩 필요할 수 있음 — `@` → `%40`)
- `relation "users" does not exist` → 6.5 스키마 생성 스크립트를 아직 실행 안 함

### 6.11 Supabase 대시보드 활용 팁 (비개발자도 유용)

| 메뉴 | 언제 쓰나요? |
|------|-------------|
| **Table Editor** | 예약/사용자 데이터를 엑셀처럼 조회·수정 |
| **SQL Editor** | "어제 예약이 몇 건?" 같은 집계 쿼리 직접 작성 |
| **Database → Backups** | 일일 백업 다운로드 (유료 플랜부터 자동) |
| **Storage** | 업로드된 이미지 직접 확인·삭제 |
| **Logs** | 에러 발생 시 "무엇이 잘못됐는지" 시간순 확인 |

### 6.12 이 장이 끝나면 가능해지는 것
✅ 우리 웹사이트의 모든 데이터가 **클라우드 DB 에 영구 저장**
✅ 이미지 업로드 시 **공개 URL 로 즉시 CDN 제공**
✅ `.env` 에 민감 정보가 분리되어 **GitHub에 비밀 누출 없음**

---

## 7. Railway 배포

> **이 장의 목표**: 로컬에서만 돌던 웹사이트를 **인터넷에 공개**해서 누구나 접속 가능하게 만들기.

### 7.1 Railway 는 무엇인가요?

**한 줄 설명**: "GitHub 에 코드 올리면 자동으로 인터넷에 띄워주는 서비스".

**왜 Railway 를 선택?**
- ✅ GitHub 연결 → `git push` 만 하면 자동 배포 (따로 버튼 누를 필요 없음)
- ✅ Docker 설정 자동 감지 (우리 프로젝트는 `Dockerfile` 이 있음)
- ✅ 환경변수 GUI 로 관리 (개발자 아닌 사람도 쉽게 수정)
- ✅ 무료 크레딧 $5/월 (소규모 트래픽이면 무료)
- ✅ 로그·메트릭·배포 이력 시각화 제공

**다른 대안**: Vercel(프론트 전용), Render, Fly.io, AWS EC2, Heroku 등. Railway 는 **단일 Docker 컨테이너**로 백엔드+정적 프론트까지 한번에 띄울 수 있어 우리 구조에 잘 맞습니다.

### 7.2 Railway 가입

1. https://railway.app 접속 → **Start a New Project** 클릭
2. **Login with GitHub** 선택 (GitHub 계정으로 로그인)
3. 권한 승인

### 7.3 GitHub 레포 연결 및 자동 배포 설정

1. 대시보드에서 **New Project** 클릭
2. **Deploy from GitHub repo** 선택
3. Railway 에게 레포 접근 권한 부여:
   - **Configure GitHub App** 클릭 → GitHub 으로 이동
   - `sksmsrkk-glitch/amt-automation` 선택 → **Install**
4. Railway 로 돌아와서 `amt-automation` 레포 선택
5. Railway 가 자동으로:
   - `Dockerfile` 감지 → Docker 기반 빌드 결정
   - `main` 브랜치를 자동 배포 대상으로 설정

### 7.4 환경변수 등록 ⭐ (가장 중요)

**왜 필요한가?**
로컬에선 `.env` 파일을 읽지만, **Railway 는 `.env` 를 읽지 않습니다**. Railway 대시보드에서 **환경변수를 별도로 등록**해야 운영 서버가 DB·Storage 에 접속할 수 있습니다.

**등록 순서**:
1. Railway 프로젝트 페이지 → 서비스 클릭 → **Variables** 탭
2. **New Variable** 또는 **Raw Editor** 선택
3. Raw Editor 를 쓰면 `.env` 파일 내용을 통째로 붙여넣기 가능:

```bash
DATABASE_URL=postgresql://postgres:비밀번호@db.xxxxxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
JWT_SECRET=운영용-32자-이상-랜덤-문자열-반드시-로컬과-다르게
NODE_ENV=production
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
CORS_ORIGIN=https://우리도메인.com
```

4. **Save** 또는 **Deploy** 클릭

> 💡 **운영용 JWT_SECRET 은 로컬과 반드시 다르게**. 로컬용이 유출돼도 운영 토큰은 영향 없도록 분리.

### 7.5 첫 배포 진행

환경변수 저장 직후 Railway 가 자동으로 빌드를 시작합니다.

**배포 진행 상황 확인**:
- 서비스 → **Deployments** 탭 → 최신 배포 클릭 → 실시간 로그 확인
- 단계: `Building` → `Deploying` → `Active` 순으로 진행
- 소요 시간: 처음 배포는 약 5~10분 (이후엔 2~3분)

**성공 확인**:
- 서비스 상단의 **Public Domain** 옆에 `https://xxx.up.railway.app` 주소 생성됨
- 주소 클릭 → 고객 사이트 홈이 떠야 함 ✅

### 7.6 도메인 설정

**Railway 기본 도메인**:
- `https://amt-automation-production.up.railway.app` 같은 무료 주소가 자동 발급됨
- 그대로 써도 되지만, 보통 **커스텀 도메인**을 붙입니다.

**커스텀 도메인 연결 (선택)**:
1. 회사가 보유한 도메인 (예: `booking.high1.com`) 을 Railway 에 연결
2. Railway 서비스 → **Settings → Domains** → **Custom Domain** → 도메인 입력
3. Railway 가 제공하는 `CNAME` 값을 도메인 DNS 관리자에서 등록
4. 5분~1시간 내 HTTPS 인증서 자동 발급 완료

### 7.7 이후 배포는 이렇게 됩니다

**"자동 배포" 의 의미**:
```
  개발자 (또는 Claude Code)
         │
         │ git push
         ▼
    GitHub (main 브랜치)
         │
         │ Railway 가 감지
         ▼
    Railway 자동 빌드
         │
         │ 2~3분 후
         ▼
    운영 사이트 업데이트 ✅
```

즉, **코드를 푸시하기만 하면 알아서 운영 사이트에 반영**됩니다.

### 7.8 자주 만난 배포 이슈 (실제 사례)

| 이슈 | 증상 | 해결 |
|------|------|------|
| **환경변수 미설정** | 배포는 성공, 사이트 접속 시 500 에러 | Variables 탭에서 `DATABASE_URL` 등 재확인 |
| **빌드 실패 (npm ci)** | Deployments 에 "package-lock.json out of sync" | 로컬에서 `npm install` 후 `package-lock.json` 커밋·푸시 |
| **이미지 업로드 안됨** | 관리자가 이미지 올렸는데 표시 안됨 | `SUPABASE_SERVICE_KEY` 누락 또는 bucket 이름 불일치 |
| **CORS 에러** | 프론트에서 API 호출 시 브라우저 콘솔에 CORS 에러 | `CORS_ORIGIN` 환경변수에 운영 도메인 추가 |
| **Google 로그인 실패** | "redirect_uri_mismatch" 에러 | Google Cloud Console 에서 **운영 도메인**을 승인된 리디렉션 URI 에 추가 |
| **재시작 후 이미지 사라짐** | 업로드했는데 다음 날 사라짐 | Railway 디스크가 아닌 **Supabase Storage** 를 쓰는지 확인 |

### 7.9 모니터링 & 로그 확인

**운영 중 사이트에 문제가 생기면**:
1. Railway 대시보드 → 서비스 → **Logs** 탭
2. 최근 몇 분간의 출력을 확인 (에러는 빨간색으로 표시)
3. 특정 시간대로 필터링 가능

**메트릭**:
- **Metrics** 탭: CPU/메모리/네트워크 사용량 그래프
- 트래픽 증가 시 인스턴스 수를 늘리는 판단 근거

### 7.10 이 장이 끝나면 가능해지는 것
✅ 전 세계 어디서든 `https://xxx.up.railway.app` 으로 사이트 접속 가능
✅ 코드 수정 후 `git push` → **알아서 운영 반영**
✅ 에러 발생 시 Railway 대시보드에서 로그·메트릭 확인

---

## 8. 시현 시나리오 (라이브 데모 대본)

> **이 장의 목표**: 동료 앞에서 **10~15분 안에** 프로젝트의 핵심 가치를 보여주는 시연 대본.

### 8.1 시연 준비 체크리스트 (당일 아침)

- [ ] 노트북 완충 + 전원 어댑터 챙기기
- [ ] HDMI/USB-C 변환기 (외부 모니터 연결용)
- [ ] 인터넷 연결 사전 테스트 + 모바일 핫스팟 백업
- [ ] 브라우저 탭 미리 열어두기:
  - [ ] 고객 사이트 운영 URL (Railway)
  - [ ] 관리자 사이트 운영 URL (로그인 완료 상태)
  - [ ] Supabase 대시보드 (Table Editor 페이지)
  - [ ] Railway 대시보드 (Deployments 페이지)
  - [ ] GitHub 레포 페이지
  - [ ] `docs/DEMO_GUIDE.md` (이 문서) + `docs/PRD.md`
- [ ] VS Code 실행 + `amt-automation` 폴더 열기
- [ ] VS Code 터미널 1개 열어두기 + Claude Code 실행 준비 (`claude` 입력만 남긴 상태)
- [ ] 화면 글자 크기 키우기 (Ctrl + `+`) — 뒤에서도 잘 보이도록
- [ ] 알림·메신저 끄기 (집중 모드)
- [ ] 시드 데이터 정상 상태 확인 — 테스트 예약 1~2건은 남겨두기 (데모 중 조회 시연용)

### 8.2 시연 흐름 (15분 버전)

#### 🎬 오프닝 (1분)
> "안녕하세요. 오늘은 저희가 지난 몇 주간 **개발자 1명 + AI 도구(Claude Code)** 로 만든 하이원 외국인 전용 예약 플랫폼을 소개하겠습니다. 크게 **3개의 데모**를 보여드릴 예정이에요.
>
> 1. 외국인 고객이 보는 예약 화면
> 2. 우리 운영팀이 쓸 관리자 화면
> 3. 새 기능을 AI 에게 시켜서 실시간으로 만들어보는 시연"

#### 🎬 데모 1: 고객 사이트 (5분)

**대본**:
> "먼저 중국인 고객 시점으로 예약해볼게요."

1. **언어 전환 시연**
   - 운영 URL 접속 → 우측 상단 `EN ▾` → `中文` 클릭
   - 메뉴·버튼·콘텐츠가 **모두 중국어로 즉시 변경**되는 것 보여주기
   - 👉 **포인트**: "번역 페이지를 따로 만든 게 아니라, 같은 사이트가 실시간으로 언어를 바꾸도록 설계했습니다."

2. **패키지 예약 (게스트)**
   - Packages → 아무 패키지 클릭 → 날짜 선택 → "Book Now"
   - **회원가입 건너뛰고 게스트 정보 입력** (이름/이메일/전화)
   - 👉 **포인트**: "외국인은 한국 회원가입에 부담이 커요. 이메일만으로도 예약할 수 있게 했습니다."
   - 예약 완료 → **Booking Number + Voucher** 화면 보여주기

3. **예약 조회 시연 (비회원)**
   - 상단 메뉴의 "Find My Booking" (OrderLookup) 클릭
   - Booking Number + 이메일 입력 → 방금 만든 예약이 조회됨
   - 👉 **포인트**: "회원이 아니어도 본인 예약을 언제든 찾아볼 수 있어요."

#### 🎬 데모 2: 관리자 사이트 (4분)

**대본**:
> "이제 하이원 운영팀 시점으로 이동해볼게요."

1. **대시보드**
   - 관리자 URL 접속 (이미 로그인된 상태)
   - 총 예약/매출/사용자 카드, 월별 매출 차트 보여주기
   - 👉 **포인트**: "매출을 실시간으로 파악할 수 있고, 엑셀로 보고서 내보낼 필요가 없어졌어요."

2. **방금 만든 예약 처리**
   - **Bookings** → 방금 데모 1에서 만든 예약 클릭
   - 상태를 `pending` → `confirmed` 로 변경하는 시연
   - (옵션) 환불 버튼 누르기 → 금액 입력 → **재고 자동 복원**
   - 👉 **포인트**: "취소·환불하면 재고가 알아서 복원됩니다. 운영자가 엑셀 따로 업데이트할 필요 없어요."

3. **상품·재고 관리 살짝**
   - **HotelManagement** → 객실 재고 페이지
   - 12/20~01/05 기간 **주말 가격 × 1.5** 일괄 적용 시연 (실제 클릭은 하지 말고 설명만)
   - 👉 **포인트**: "성수기마다 가격을 수동으로 바꾸던 걸, 기간 선택 + 배수만 입력하면 한번에 처리됩니다."

#### 🎬 데모 3: AI 로 실시간 기능 추가 (4분) — **하이라이트**

**대본**:
> "마지막으로, 이 프로젝트의 가장 인상적인 부분입니다. AI 에게 말로 새 기능을 요청하면 실시간으로 코드가 만들어집니다."

1. **VS Code 터미널** 에서 `claude` 입력 → Claude Code 실행
2. 아래 프롬프트 입력 (미리 메모해둘 것):

```
고객 사이트 홈 페이지 하단에 "영업시간 안내" 섹션을 추가해줘.
영어/중국어 모두 지원하고, 평일 09:00-18:00, 주말 08:00-20:00 로 표시.
스타일은 기존 홈 섹션과 일관되게.
```

3. Claude 가 실시간으로:
   - 기존 홈 페이지 파일 읽기
   - i18n 번역 키 추가 (en.json / cn.json)
   - 새 컴포넌트 또는 섹션 생성
   - 결과 요약 보고

4. 로컬에서 즉시 확인 (`frontend/` 는 이미 `npm run dev` 로 실행 중이라 가정)
5. 👉 **포인트**:
   - "원래 이 정도 변경은 개발자가 30분~1시간 걸렸어요."
   - "AI 가 기존 코드 스타일을 **자동으로 학습해서** 일관되게 작성해줍니다."
   - "우리는 AI 에게 **뭘 만들지 정확히 설명하는 역할**만 하면 됩니다."

#### 🎬 마무리 (1분)
> "지금까지 보신 기능들이 **PRD.md 문서 한 개와, Claude Code 와의 대화 수십 번**으로 만들어졌어요.
>
> 이 방식의 핵심은 **'AI 를 쓰는 사람의 기획·검증 역량'** 입니다. AI 는 도구일 뿐이고, **'무엇을 왜 만드는가'** 를 정확히 전달하는 능력이 가장 중요합니다.
>
> 질문 받겠습니다!"

### 8.3 예상 Q&A 준비

| 예상 질문 | 준비한 답변 |
|----------|------------|
| **비용이 얼마나 드나요?** | 초기엔 월 0~$10 (Supabase 무료 + Railway $5 크레딧). 사용자 1,000명 규모까진 월 $20~50 예상. |
| **AI 가 만든 코드 믿을 수 있나요?** | 4단계 파이프라인(개발→테스트→품질→보안)으로 자동 검증 + 개발자가 PR 리뷰. 버그 발견 시 `fix/` 브랜치로 즉시 수정. |
| **결제는 언제 되나요?** | v1.1 로드맵 — Stripe(국제 카드) → Alipay/WeChat Pay 순으로. 실제 결제는 사업 계약 + PG 심사가 필요해서 현재는 설계만 완료. |
| **기존 PMS 와 연동은?** | `docs/PMS_INTEGRATION_PLAN.md` 에 4단계 phased plan 작성됨. v1.2부터 시작 예정. |
| **한국어 지원은 왜 없나요?** | 의도적으로 **외국인 전용**. 기존 한국어 공식 사이트와 역할 분리. 추후 수요 확인 후 일본어와 함께 추가 가능. |
| **AI 가 일 자리를 뺏지 않나요?** | 이번 사례는 **"1명 + AI = 3명 분의 속도"**. 개발자가 줄어드는 게 아니라, **한 사람이 더 큰 영향**을 낼 수 있게 됐습니다. 역할이 "코드 작성자" 에서 "기획+검증자" 로 이동. |
| **데이터 안전한가요?** | HTTPS, JWT, bcrypt, 환경변수 분리, Supabase 일일 백업, GitHub 에 민감정보 절대 미커밋. GDPR/PIPL 대응은 v1.2 로드맵. |

### 8.4 시연 실패 시 Plan B

| 문제 | 대응 |
|------|------|
| **인터넷이 끊겼다** | 모바일 핫스팟 전환 + 로컬 `./start.sh` 로 로컬 버전 시연 |
| **Railway 사이트가 안 뜬다** | 로컬 백업 노트북에서 시연 + "방금 Railway 가 재배포 중인데 몇 분만 기다리시면..." |
| **Claude Code 가 응답이 느리다** | "AI 응답을 기다리는 동안, 이전에 작업한 커밋 로그를 GitHub 에서 보여드릴게요" 로 시간 벌기 |
| **예상 못한 에러** | 당황하지 말고 **"이런 에러가 실제로 발생할 수 있다"** 는 것 자체를 보여주는 기회로 전환. 로그 확인 → 원인 추정 → 수정 계획 설명 |

---

## 9. 회고 (Retrospective)

> **이 장의 목표**: 이번 프로젝트에서 **얻은 것·힘들었던 것·다음엔 이렇게 해볼 것** 을 정리.

### 9.1 잘 된 점 (Keep — 계속 유지)

#### ✅ `CLAUDE.md` 를 프로젝트 첫날 작성한 것
- 세션마다 프로젝트 맥락을 다시 설명할 필요가 없어져 **시간 절약**
- "도메인 지식 없는 개발자" 기준의 코딩 원칙을 명시 → **일관된 코드 스타일 유지**

#### ✅ 4단계 파이프라인 (dev → test → quality → security)
- 각 단계에서 자동 검증 → 버그/보안 이슈를 **조기 발견**
- 단계별 사용자 승인 구조 → **통제 가능한 자동화**

#### ✅ 문서 우선 문화 (`docs/` 폴더)
- PRD, DB 셋업 가이드, 배포 가이드, PMS 연동 계획을 **먼저 문서화**
- 나중에 합류하는 팀원도 빠르게 맥락 파악 가능

#### ✅ Supabase + Railway 조합
- 무료 플랜으로 시작 → 트래픽 늘어나면 자연스럽게 유료 전환
- GUI 대시보드로 **비개발자도 데이터 조회 가능**
- 별도 서버 운영(OS 패치, 백업 등) 부담 없음

#### ✅ 기능 브랜치 + PR 기반 작업
- `main` 을 항상 안정 상태로 유지
- 커밋 로그가 **"누가·왜·무엇을 바꿨는지"** 명확

### 9.2 어려웠던 점 (Problem — 문제 정리)

#### ⚠️ 초반에 sql.js 를 선택했던 것
- **문제**: Railway 배포 후 재시작 시 데이터가 모두 날아감 (컨테이너가 ephemeral)
- **해결**: 프로젝트 중반에 **PostgreSQL(Supabase) 로 전면 이전**
- **교훈**: 처음부터 **"배포 환경의 특성"** 을 고려해서 DB 선택해야 함

#### ⚠️ 이미지 업로드도 같은 문제
- **문제**: 로컬 디스크에 저장했더니 재배포 시 소실
- **해결**: Supabase Storage 로 전환
- **교훈**: **"상태(state) 는 반드시 외부 저장소에"** — 컨테이너는 무상태로

#### ⚠️ AI 가 "될 것처럼" 보고하는 경우
- **문제**: Claude 가 코드 수정 완료 보고 → 실제로는 타입 오류로 빌드 실패
- **해결**: `compile_check.sh` 훅을 `.claude/hooks/` 에 추가 → **저장 시 자동 문법 검증**
- **교훈**: **AI 의 보고를 그대로 믿지 말고 기계적 검증 레이어를 둘 것**

#### ⚠️ 환경변수 관리의 혼란
- **문제**: 로컬 `.env` 과 Railway 환경변수가 동기화 안 되어 운영에서만 나는 버그
- **해결**: **환경변수 체크리스트** (10장 부록 B) 를 만들고, 새 변수 추가 시 두 곳 모두 업데이트하는 PR 규칙화
- **교훈**: **"로컬에선 되는데 운영에선 안 되는"** 이슈는 대부분 환경변수

#### ⚠️ CORS 설정 이슈
- **문제**: 운영 도메인을 CORS 화이트리스트에 추가 안해서 프론트 API 호출 전부 실패
- **해결**: `CORS_ORIGIN` 환경변수를 추가하고 Railway 에 등록
- **교훈**: **배포 후 E2E 테스트 (실제 브라우저로 홈 → 예약까지) 를 반드시 수행**

#### ⚠️ i18n 누락
- **문제**: 영어 텍스트 추가하면서 중국어 번역을 빠뜨림 → 중국어 사용자에게 영문이 섞여 보임
- **해결**: `CLAUDE.md` 에 "문자열 추가 시 `frontend/src/i18n/` 의 영어+중국어 **동시** 업데이트" 명시
- **교훈**: **AI 에게 언어 동시 업데이트를 매번 주지시켜야 함**

### 9.3 다음엔 이렇게 해볼 것 (Try — 개선 아이디어)

#### 🔜 E2E 자동 테스트 (Playwright / Cypress)
- 현재: 수동 테스트
- 개선: 매 배포 전 **"홈 → 예약 → 취소"** 전체 흐름을 자동으로 검증
- 기대 효과: 배포 후 CORS 같은 이슈를 사전에 발견

#### 🔜 에러 추적 (Sentry 도입)
- 현재: Railway 로그를 수동으로 뒤져봄
- 개선: Sentry 로 **운영 에러 발생 시 즉시 알림** + 스택 트레이스 자동 수집
- 기대 효과: 고객이 신고하기 전에 운영자가 먼저 인지

#### 🔜 스테이징(staging) 환경 추가
- 현재: 로컬 → 바로 운영
- 개선: `develop` 브랜치 → 스테이징 → `main` 브랜치 → 운영 순서
- 기대 효과: 실제 운영 배포 전 **실전 테스트** 한 단계 추가

#### 🔜 Claude Code 활용 팁 사내 공유 세션
- 현재: 소수 개발자만 Claude Code 를 적극 활용
- 개선: 비개발 동료도 **"자기 업무에 AI 쓰는 법"** 워크숍 개최
- 기대 효과: 기획자도 프로토타입을 직접 만들 수 있게 됨

#### 🔜 비용 모니터링 자동화
- 현재: Railway/Supabase 비용을 월말에 확인
- 개선: **주간 비용 알림** 설정 (임계치 초과 시 Slack)
- 기대 효과: 트래픽 급증 시 조기 대응

### 9.4 프로젝트 타임라인 요약

| 시기 | 주요 이벤트 |
|------|-----------|
| Week 1 | 프로젝트 킥오프, GitHub 레포 생성, `CLAUDE.md` 작성, 초기 스캐폴딩 |
| Week 2 | 고객 사이트 핵심 플로우 (호텔/티켓/패키지 탐색 → 예약) |
| Week 3 | 관리자 사이트 (대시보드, 상품·예약 관리, 재고 대량 수정) |
| Week 4 | 다국어 (i18n), Google 로그인, 쇼케이스 |
| Week 5 | sql.js → Supabase PostgreSQL 마이그레이션 |
| Week 6 | 이미지 업로드 → Supabase Storage, Railway 배포 |
| Week 7 | 버그 수정 라운드 (HTTP 500 메시지, 대시보드 await 순서 등) |
| Week 8 | 기획문서(PRD.md), 시현 가이드(본 문서) 작성 |

### 9.5 핵심 깨달음

> **"AI 를 쓴다고 개발이 쉬워지는 게 아니라, '무엇을 왜 만드는가' 를 더 명확히 해야 한다."**

- **기획 역량이 더 중요해졌다**: 요구사항이 모호하면 AI 결과물도 모호해짐
- **검증 역량이 더 중요해졌다**: AI 가 빨리 만들어내기 때문에, 빨리 확인·피드백 줘야 함
- **코드 읽기 역량은 여전히 필요**: PR 리뷰, 에러 로그 해석, 아키텍처 판단

### 9.6 Claude Code 활용 팁 TOP 10 (총정리)

1. **`CLAUDE.md` 를 프로젝트 첫날 작성** — 모든 세션의 공통 기반
2. **"왜" 를 프롬프트에 포함** — 판단 기준이 명확해짐
3. **큰 작업은 쪼개기** — 한 세션당 기능 1~2개
4. **계획 먼저 보고, 승인 후 실행** — "바로 해줘" 금지
5. **결과는 반드시 직접 확인** — 브라우저로 실제 동작 검증
6. **커밋은 작게, 자주** — 롤백 용이
7. **`.claude/skills/` 로 규칙 고정** — 반복 설명 불필요
8. **훅으로 자동 검증** — 저장 시 린트·타입 체크
9. **실패한 프롬프트 기록** — 다음엔 같은 실수 안 함
10. **민감 정보 금지** — `.env` 와 Railway Variables 에만

---

## 10. 부록

### A. 주요 명령어 치트시트 (Windows PowerShell + VS Code)

#### 프로젝트 실행
```powershell
# 전체 실행 (백엔드 + 프론트엔드 + 관리자)
./start.sh

# 전체 종료
./stop.sh

# 개별 실행 (각각 터미널에서)
cd backend  ; npm run seed ; npm start    # 백엔드 (시드 포함)
cd frontend ; npm run dev                  # 프론트엔드
cd admin    ; npm run dev                  # 관리자

# 데이터 초기화
cd backend ; Remove-Item -Recurse -Force data ; npm run seed ; npm start
```

#### Git 기본 명령
```powershell
git status                          # 변경 사항 확인
git diff                            # 실제 변경 내용 보기
git add .                           # 모든 변경 파일 스테이징
git add 파일명                      # 특정 파일만 스테이징
git commit -m "메시지"              # 커밋
git push                            # GitHub 에 업로드
git pull                            # GitHub 에서 최신 내려받기
git log --oneline -10               # 최근 10개 커밋 요약
git branch                          # 현재 브랜치 확인
git checkout -b feat/새기능         # 새 브랜치 생성 + 이동
git checkout main                   # main 브랜치로 이동
```

#### Claude Code
```powershell
claude                              # 프로젝트 폴더에서 실행
claude --version                    # 버전 확인
claude --model claude-sonnet-4-6    # 특정 모델로 실행 (속도 우선)
```

### B. 환경변수 전체 목록

| 변수 이름 | 필수? | 값 예시 | 민감도 | 어디서 얻나? |
|----------|------|--------|--------|-------------|
| `DATABASE_URL` | ✅ 필수 | `postgresql://postgres:PW@db.xxx.supabase.co:5432/postgres` | 🔴 High | Supabase → Project Settings → Database |
| `JWT_SECRET` | ✅ 필수(운영) | `base64 랜덤 32자 이상` | 🔴 High | PowerShell 명령어로 직접 생성 |
| `NODE_ENV` | 권장 | `production` | 🟢 Low | 직접 입력 |
| `PORT` | 자동 | `4000` | 🟢 Low | Railway 가 자동 주입 |
| `SUPABASE_URL` | ⭐ 선택(이미지) | `https://xxx.supabase.co` | 🟡 Medium | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | ⭐ 선택(이미지) | `eyJhbGci...` | 🔴 High | Supabase → Project Settings → API |
| `GOOGLE_CLIENT_ID` | ⭐ 선택(소셜) | `xxx.apps.googleusercontent.com` | 🟡 Medium | Google Cloud Console → OAuth credentials |
| `CORS_ORIGIN` | 권장 | `https://우리도메인.com` | 🟢 Low | 직접 입력 (쉼표 구분 다중 허용) |

**민감도 범례**:
- 🔴 **High**: 유출 시 즉시 재발급 필요 (DB/Storage/JWT)
- 🟡 **Medium**: 유출 시 이슈 있으나 파급력은 제한적 (OAuth Client ID 는 공개여도 보안적으론 안전하나 관리 차원에서)
- 🟢 **Low**: 공개되어도 무방

### C. 자주 만나는 에러 → 해결법

#### 로컬 실행 시
| 에러 메시지 | 원인 | 해결 |
|------------|------|------|
| `Error: listen EADDRINUSE :::4000` | 4000 포트가 이미 사용 중 | `./stop.sh` 실행 또는 작업관리자에서 node 프로세스 종료 |
| `Cannot find module 'express'` | 의존성 미설치 | `cd backend ; npm install` |
| `JWT_SECRET is not defined` | `.env` 파일 없음/키 누락 | `.env` 생성 + JWT_SECRET 추가 |
| `password authentication failed` | Supabase 비밀번호 오타 | `DATABASE_URL` 재확인 (특수문자는 URL 인코딩 필요) |
| `ECONNREFUSED 127.0.0.1:5432` | 로컬 PostgreSQL 에 연결하려 함 | `DATABASE_URL` 을 Supabase 주소로 변경 |

#### 배포 시 (Railway)
| 증상 | 원인 | 해결 |
|------|------|------|
| 빌드 실패: "package-lock.json out of sync" | 로컬/원격 lockfile 불일치 | 로컬에서 `npm install` → `git add package-lock.json` → push |
| 배포 성공했는데 500 에러 | 환경변수 누락 | Railway → Variables 탭에서 필수 변수 확인 |
| 이미지 업로드 안됨 | `SUPABASE_SERVICE_KEY` 또는 bucket 이름 틀림 | 환경변수 확인 + Supabase bucket 이름이 `product-images` 인지 확인 |
| 프론트에서 CORS 에러 | `CORS_ORIGIN` 에 운영 도메인 없음 | Railway 환경변수에 추가 후 재배포 |
| Google 로그인 "redirect_uri_mismatch" | Google Console 에 운영 도메인 미등록 | Google Cloud Console → OAuth → 승인된 redirect URI 추가 |

#### Claude Code 관련
| 증상 | 해결 |
|------|------|
| `API Error: Stream idle timeout` | 요청을 작게 쪼개서 재시도 / 다른 모델로 전환 (`/model claude-sonnet-4-6`) |
| Claude 가 엉뚱한 파일을 수정 | 프롬프트에 **정확한 파일 경로 명시** |
| 영어로만 응답 | 프롬프트에 "한국어로 답변해줘" 추가 |
| 승인 받지 않고 커밋·푸시 | `.claude/CLAUDE.md` 의 "Plan First" 규칙 재확인 |

### D. 참고 문서 링크

#### 우리 레포 내부 문서
| 문서 | 용도 |
|------|------|
| `README.md` | 프로젝트 개요 + 빠른 시작 |
| `CLAUDE.md` | Claude Code 프로젝트 가이드 |
| `GUIDE.md` | 한국어 실행 가이드 |
| `docs/PRD.md` | 제품 요구사항 문서 (이 프로젝트의 "설계도") |
| `docs/DEMO_GUIDE.md` | ← 본 문서 |
| `docs/DATABASE_SETUP_GUIDE.md` | Supabase PostgreSQL 스키마 SQL |
| `docs/DEPLOY_RAILWAY.md` | Railway 배포 상세 절차 |
| `docs/DEVELOPMENT_WORKFLOW.md` | 브랜치 전략 + 로컬 개발 팁 |
| `docs/SUPABASE_STORAGE_SETUP.md` | 이미지 저장소 설정 |
| `docs/PMS_INTEGRATION_PLAN.md` | 향후 PMS 연동 계획 |

#### 외부 공식 문서
| 주제 | 링크 |
|------|------|
| Claude Code | https://docs.claude.com/en/docs/claude-code |
| Node.js | https://nodejs.org/en/docs |
| Git | https://git-scm.com/doc |
| GitHub 기본 사용법 | https://docs.github.com |
| Supabase | https://supabase.com/docs |
| Railway | https://docs.railway.app |
| React | https://react.dev |
| Express | https://expressjs.com |

### E. 빠른 재시작 치트 (시연 전 긴급 점검용)

**5분 안에 "로컬에서 시연 가능" 상태 만들기**:

```powershell
# 1. 프로젝트 폴더로 이동
cd C:\Users\사용자명\projects\amt-automation

# 2. 최신 코드 받기
git pull origin main

# 3. 의존성 설치 (package.json 바뀐 경우)
npm run install:all

# 4. DB 초기화 + 시작
cd backend ; Remove-Item -Recurse -Force data -ErrorAction SilentlyContinue ; npm run seed
cd ..

# 5. 전체 실행
./start.sh

# 6. 브라우저에서 확인
start http://localhost:3000        # 고객 사이트
start http://localhost:3001        # 관리자 사이트
```

### F. 기본 테스트 계정

| 역할 | 이메일 | 비밀번호 | 비고 |
|------|--------|---------|------|
| 관리자 | `admin@high1.com` | `admin123` | 운영 전 반드시 변경 |
| 테스트 고객 | `guest@test.com` | `test123` | 개발/시연 전용 |

> ⚠️ **운영 배포 후 즉시 관리자 비밀번호를 변경**해주세요.

### G. 문서 변경 이력

| 버전 | 일자 | 요약 |
|------|------|------|
| v1.0 | 2026-04-20 | 최초 작성 — 프로젝트 전체 여정 + 비개발자 대상 시현 가이드 |

---

**문서 끝.**

질문·개선 제안은 `#high1-platform` Slack 채널 또는 GitHub Issue 로 부탁드립니다.

> 💡 **Pro Tip**: 이 문서는 프로젝트가 진화하면서 **계속 업데이트**되어야 합니다. 새 기능을 추가했거나, 배포 절차가 바뀌었거나, 새로운 에러를 만났다면 부담없이 PR 로 보완해주세요.





