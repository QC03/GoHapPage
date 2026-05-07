또한 관리자 전용 기능(답글/삭제)을 위해 추가 환경변수 `SUPABASE_ADMIN_TOKEN`을 Vercel에 설정하세요.

`SUPABASE_ADMIN_TOKEN` 값은 임의의 강력한 문자열로 설정하고 절대 공개하지 마세요. 이 토큰은 관리자 UI(로컬)에 입력하여 관리 작업을 수행합니다.

메모: 서버리스 프록시(`api/posts.js`)는 `SUPABASE_SERVICE_ROLE_KEY`와 `SUPABASE_URL`을 사용합니다.
# 고합상사 홈페이지 배포 가이드

## 개요
- **호스팅**: Vercel (정적 사이트 + 서버리스 함수)
- **게시판 DB**: Supabase (PostgreSQL)
- **배포 시간**: 약 30-40분

---

## 1단계: Supabase 프로젝트 생성

### 1-1) Supabase 가입 및 프로젝트 생성
1. https://app.supabase.com 방문
2. GitHub 또는 Google로 가입/로그인
3. **"New project"** 클릭
4. 프로젝트 이름: `gohappage` (또는 원하는 이름)
5. 지역: `Asia Pacific (Singapore)` 권장 (한국 가까움)
6. 비밀번호 설정 후 **"Create new project"** 클릭
7. 프로젝트 로드 완료 대기 (2-3분)

### 1-2) 게시판 테이블 생성
1. Supabase 대시보드 → **"SQL Editor"** 클릭
2. **"New query"** 클릭
3. 아래 SQL을 복사해서 붙여넣기:

```sql
create table posts (
  id bigserial primary key,
  author text default '익명',
  content text not null,
  created_at timestamptz default now()
);

-- 개발용 RLS 규칙 (모두 읽기 가능, 누구나 삽입 가능)
alter table posts enable row level security;

create policy "Allow public read" on posts
  for select using (true);

create policy "Allow public insert" on posts
  for insert with check (true);
```

4. **"Run"** 클릭하여 실행

### 1-3) API 키 복사 (중요!)
1. Supabase 대시보드 → **"Settings"** → **"API"** 클릭
2. 아래 두 개를 메모장에 복사해두기:
   - **Project URL** (예: `https://xxxx.supabase.co`)
   - **Service Role Key** (`service_role` 섹션의 key - 길고 비슷해 보이는 문자열)

⚠️ **주의**: Service Role Key는 절대 GitHub에 커밋하면 안 됩니다. Vercel 환경변수로만 설정합니다.

---

## 2단계: GitHub에 레포 푸시

### 2-1) Git 설정 및 커밋
```bash
cd c:\Users\tjdwn\OneDrive\Desktop\Development\GoHapPage

git add .
git commit -m "Add bulletin board with Supabase integration"
```

### 2-2) GitHub에 레포 생성 (처음이면)
1. https://github.com/new 에서 레포 생성
2. 레포 이름: `gohappage` (또는 원하는 이름)
3. **"Create repository"** 클릭
4. 터미널에서:

```bash
git remote add origin https://github.com/당신의아이디/gohappage.git
git branch -M main
git push -u origin main
```

---

## 3단계: Vercel 배포

### 3-1) Vercel 계정 생성 (GitHub 로그인 권장)
1. https://vercel.com 방문
2. **"Sign Up"** → **"Continue with GitHub"** 클릭
3. GitHub 인증 후 진행

### 3-2) 프로젝트 연결
1. Vercel 대시보드 → **"Add New..."** → **"Project"** 클릭
2. GitHub 계정에서 `gohappage` 레포 선택
3. **"Import"** 클릭

### 3-3) 환경변수 설정
1. 배포 설정 화면에서 **"Environment Variables"** 섹션 찾기
2. 다음 2개 변수 추가:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | 1-3단계에서 복사한 **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | 1-3단계에서 복사한 **Service Role Key** |

3. **"Deploy"** 클릭

### 3-4) 배포 대기
- 배포 로그가 나타남 (약 1-2분)
- ✅ "Deployment completed successfully" 메시지 확인

---

## 4단계: 배포 후 확인

### 4-1) 라이브 사이트 확인
1. Vercel 대시보드에서 배포 URL 클릭 (예: `https://gohappage.vercel.app`)
2. `/Pages/contact.html` 로 접속
3. "게시판" 섹션에서:
   - **이름** 입력 (선택)
   - **문의 내용 입력** 칸에 테스트 메시지 작성
   - **"등록"** 클릭
4. ✅ 글이 아래 목록에 나타나는지 확인

### 4-2) 문제 발생 시
**✗ "게시글 로드 실패" 또는 "등록 실패"**
- Vercel 대시보드 → **"Deployments"** → 최신 배포 선택
- **"Functions"** 탭 클릭 → `api/posts.js` 로그 확인
- 환경변수가 올바른지 재확인

**✗ CORS 또는 네트워크 에러**
- Supabase 대시보드 → **"Settings"** → **"API"** → **"CORS configuration"**
- 배포된 URL(예: `https://gohappage.vercel.app`)을 CORS 화이트리스트에 추가

---

## 5단계: (선택) 커스텀 도메인 연결

1. Vercel 프로젝트 설정 → **"Domains"** 클릭
2. 원하는 도메인 입력 (예: `gohappage.kr`)
3. DNS 레코드 설정 (도메인 호스팅사 지시 따르기)
4. Vercel에서 확인될 때까지 대기

---

## 6단계: (선택) 보안 강화

### 6-1) 운영 전 RLS 규칙 강화
게시판이 스팸으로 악용되지 않도록 아래 중 선택:

**Option A: reCAPTCHA 추가** (권장)
- `Pages/contact.html`의 form에 Google reCAPTCHA v3 적용
- 스팸 봇 자동 차단

**Option B: Rate Limiting**
- Vercel Middleware 또는 서버리스 함수에 rate-limit 추가
- IP당 1시간에 최대 10개 글 제한

**Option C: 인증 추가** (고급)
- Supabase Auth와 통합
- 로그인한 사용자만 글 등록 허용

### 6-2) 데이터 백업
- Supabase 대시보드 → **"Backups"** 에서 자동 백업 설정 확인

---

## 로컬 테스트 (Vercel CLI 사용, 선택사항)

배포 전에 로컬에서 서버리스 함수를 테스트하고 싶다면:

```bash
# Vercel CLI 설치
npm install -g vercel

# Vercel 로그인
vercel login

# 환경변수 파일 생성
echo "SUPABASE_URL=https://xxxx.supabase.co" > .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_key" >> .env.local

# 로컬 서버 시작 (http://localhost:3000 에서 테스트)
vercel dev
```

그 후 브라우저에서 `http://localhost:3000/Pages/contact.html` 접속해 게시판 테스트.

---

## 자주 묻는 질문 (FAQ)

### Q1: 게시판을 비활성화하려면?
- `Pages/contact.html`에서 `<section id="board">...</section>` 블록 삭제 또는 주석 처리

### Q2: 게시판 스타일을 다르게 하려면?
- `Pages/css/style.css`에 아래 추가:
```css
#board { 
  background: #f9f9f9; 
  padding: 20px; 
  border-radius: 12px; 
}
```

### Q3: 글자 수 제한을 추가하려면?
- `Pages/js/board.js`의 `if(!content)` 부분 수정:
```js
if(!content || content.length > 500) {
  return alert('내용은 1자 이상 500자 이하여야 합니다');
}
```

### Q4: 배포 후 내용이 변경되지 않으면?
- Vercel 대시보드에서 **"Redeploy"** 클릭 또는 GitHub에 새로 push

---

## 지원
문제 발생 시:
- Vercel 로그 확인: Deployments → 최신 배포 → Logs
- Supabase 로그: Database → Logs
- GitHub 이슈 생성 또는 AI에 도움 요청

배포 완료를 축하합니다! 🎉
