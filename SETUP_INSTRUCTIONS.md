# 최종 설정 가이드

현재 코드는 배포되어 있습니다. 아래 3단계만 수동으로 완료하면 게시판이 작동합니다.

---

## 1단계: Supabase 데이터베이스 설정

### 1-1) Supabase SQL Editor에서 테이블 생성

1. https://app.supabase.com 방문
2. 좌측 메뉴 → **"SQL Editor"** 클릭
3. **"New query"** 클릭
4. 아래 SQL 복사 후 붙여넣기:

```sql
-- posts 테이블 생성
create table if not exists posts (
  id bigserial primary key,
  author text default '익명',
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security 활성화
alter table posts enable row level security;

-- 기존 정책 삭제
drop policy if exists "Allow public read" on posts;
drop policy if exists "Allow public insert" on posts;

-- 읽기 정책 (모두 조회 가능)
create policy "Allow public read" on posts
  for select using (true);

-- 쓰기 정책 (누구나 삽입 가능)
create policy "Allow public insert" on posts
  for insert with check (true);
```

5. **"Run"** 클릭 → 실행
6. ✓ 테이블 생성 확인

---

## 2단계: Vercel 환경변수 설정

### 2-1) Vercel 대시보드 접속

1. https://vercel.com 접속
2. **"gohap-page"** 프로젝트 클릭
3. 상단 메뉴 → **"Settings"** 클릭
4. 좌측 메뉴 → **"Environment Variables"** 클릭

### 2-2) 환경변수 추가

**첫 번째 변수:**
- Name: `SUPABASE_URL`
- Value: `https://gbyvejifhlgxsmbfhlte.supabase.co`
- 환경: Production, Preview, Development 모두 선택
- **"Save"** 클릭

**두 번째 변수:**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXZlamlmaGxneHNtYmZobHRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODEzNzExMCwiZXhwIjoyMDkzNzEzMTEwfQ.Yk_eUdxE8GGQWVPVSyAHGbzNF_HYCLLb-2L9bPvriOk`
- 환경: Production, Preview, Development 모두 선택
- **"Save"** 클릭

---

## 3단계: Vercel 재배포

### 3-1) 배포 재시작

1. Vercel 대시보드 → **"Deployments"** 탭 클릭
2. 최신 배포 클릭 (상단)
3. 오른쪽 상단 **"Redeploy"** 또는 **"..."** 메뉴 → **"Redeploy"** 클릭
4. "Redeploy" 확인 클릭

배포 완료 대기 (약 1-2분)

### 3-2) 배포 후 테스트

1. 배포 완료 후 배포 URL 클릭 (또는 `https://gohap-page.vercel.app`)
2. `/contact.html` 페이지 접속
3. 게시판 섹션에서:
   - 이름 입력 (선택)
   - 문의 내용 입력
   - **"등록"** 클릭
4. ✓ 글이 목록에 나타나는지 확인

---

## 테스트 체크리스트

```
✅ Supabase posts 테이블 생성
✅ Vercel 환경변수 설정 (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
✅ Vercel 재배포 완료
✅ https://gohap-page.vercel.app/contact.html 접속
✅ 게시판 글 등록 테스트
✅ 글 목록 확인
```

---

## 문제 해결

### Q: "게시글 로드 실패" 또는 "등록 실패" 에러
- Vercel 환경변수 설정 재확인 (공백 없음)
- Vercel 재배포 (새로운 배포에서 환경변수 적용됨)
- Supabase posts 테이블 존재 확인

### Q: API 요청 실패 (네트워크 에러)
- Supabase 프로젝트가 활성 상태인지 확인
- SUPABASE_URL이 정확한지 확인
- Supabase 대시보드 → Settings → API 에서 Project URL 재확인

### Q: SQL 쿼리 실행 중 오류
- Supabase SQL Editor에서 하나씩 실행해보기
- "drop policy if exists" 부분 제거 후 재시도

---

## 완료!

모든 단계를 완료하면 게시판이 완벽하게 작동합니다. 🎉

필요시 추가 커스터마이징:
- 게시판 스타일 변경: `Pages/css/style.css`
- 글자 수 제한 추가: `Pages/js/board.js`
- 스팸 방지: `api/posts.js` 에 rate-limit 추가
