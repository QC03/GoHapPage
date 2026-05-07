# 배포 체크리스트 (지금 바로 시작)

다음을 순서대로 체크해가며 진행하세요.

## 📋 1단계: Supabase 설정 (15분)
- [ ] https://app.supabase.com 방문 → 가입/로그인
- [ ] 새 프로젝트 생성 (`gohappage`)
- [ ] SQL Editor에서 테이블 생성 (DEPLOYMENT.md 1-2 참고)
- [ ] Settings → API 에서 **Project URL** 복사
- [ ] Settings → API 에서 **Service Role Key** 복사
- [ ] 복사한 2개 값을 메모장에 안전하게 저장

## 🔧 2단계: GitHub 연결 (5분)
- [ ] 터미널에서 다음 실행:
```powershell
cd "c:\Users\tjdwn\OneDrive\Desktop\Development\GoHapPage"
git add .
git commit -m "Add bulletin board with Supabase integration"
```
- [ ] https://github.com/new 에서 `gohappage` 레포 생성
- [ ] 터미널에서 GitHub 푸시 (위의 DEPLOYMENT.md 2-2 참고)

## 🚀 3단계: Vercel 배포 (10분)
- [ ] https://vercel.com 방문 → GitHub로 가입/로그인
- [ ] "Add New" → "Project" 클릭
- [ ] `gohappage` 레포 선택 → Import
- [ ] **Environment Variables** 추가:
  - `SUPABASE_URL` = (위에서 복사한 값)
  - `SUPABASE_SERVICE_ROLE_KEY` = (위에서 복사한 값)
- [ ] **Deploy** 클릭 → 배포 완료 대기

## ✅ 4단계: 배포 확인 (5분)
- [ ] Vercel에서 배포 URL 클릭
- [ ] `/Pages/contact.html` 접속
- [ ] 게시판에 테스트 글 작성 → 등록
- [ ] 글이 목록에 나타나는지 확인

## 🎉 완료!
모든 항목을 체크했다면 배포 완료!

---

## 다음 단계 (선택)
- 도메인 연결 (DEPLOYMENT.md 5단계)
- 스팸 방지 (DEPLOYMENT.md 6단계)
- 커스터마이징 (DEPLOYMENT.md FAQ)
