// 고합상사 게시판 - 서버리스 프록시 모드
// 모든 요청은 /api/posts를 거쳐 Supabase와 통신

(function() {
  console.log('[Board] board.js 로드됨');
  const boardContainer = document.getElementById('posts-list');
  const formElement = document.getElementById('post-form');
  const secretCheckbox = document.getElementById('post-secret');
  const passwordInput = document.getElementById('post-password');
  const paginationEl = document.getElementById('pagination');
  
  console.log('[Board] boardContainer:', boardContainer ? 'found' : 'NOT found');
  console.log('[Board] formElement:', formElement ? 'found' : 'NOT found');

  let currentPage = 1;

  // 게시글 목록 조회
  async function loadPosts(page = 1) {
    console.log('[Board] loadPosts 시작');
    if (!boardContainer) {
      console.error('[Board] posts-list 컨테이너 없음');
      return;
    }
    currentPage = page;

    try {
      console.log('[Board] /api/posts?page=' + page + ' 요청 시작');
      const response = await fetch('/api/posts?page=' + page, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('[Board] 응답 상태:', response.status);

      if (!response.ok) {
        boardContainer.innerText = '게시글 로드 실패';
        console.error('[Board] API 에러:', response.status);
        return;
      }

      const posts = await response.json();
      console.log('[Board] 받은 게시글 수:', posts.length);
      displayPosts(posts || []);
      // pagination: check next page existence
      checkHasNext(page);
    } catch (error) {
      boardContainer.innerText = '게시글 로드 실패';
      console.error('[Board] Fetch 에러:', error);
    }
  }

  async function checkHasNext(page){
    try{
      const r = await fetch('/api/posts?page=' + (page+1));
      if(!r.ok) return renderPagination(false);
      const data = await r.json();
      renderPagination(data.length > 0);
    }catch(e){ renderPagination(false); }
  }

  function renderPagination(hasNext){
    if(!paginationEl) return;
    paginationEl.innerHTML = '';
    const prevBtn = document.createElement('button'); prevBtn.textContent = '◀ 이전'; prevBtn.disabled = currentPage <= 1;
    const nextBtn = document.createElement('button'); nextBtn.textContent = '다음 ▶'; nextBtn.disabled = !hasNext;
    const pageLabel = document.createElement('span'); pageLabel.textContent = `페이지 ${currentPage}`;
    prevBtn.addEventListener('click', ()=> loadPosts(currentPage-1));
    nextBtn.addEventListener('click', ()=> loadPosts(currentPage+1));
    paginationEl.appendChild(prevBtn);
    paginationEl.appendChild(pageLabel);
    paginationEl.appendChild(nextBtn);
  }

  // XSS 방지 - HTML 이스케이프
  function sanitizeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 게시글 렌더링
  function displayPosts(posts) {
    if (!boardContainer) return;

    boardContainer.innerHTML = '';

    if (posts.length === 0) {
      boardContainer.innerHTML = '<div style="text-align: center; color: var(--muted);">등록된 글이 없습니다.</div>';
      return;
    }

    posts.forEach(post => {
      const postEl = document.createElement('div');
      postEl.style.cssText = 'padding: 12px; border: 1px solid rgba(16,24,72,0.06); border-radius: 8px; margin-bottom: 8px;';

      const author = sanitizeHtml(post.author || '익명');
      const content = sanitizeHtml(post.content || '');
      const createdAt = new Date(post.created_at).toLocaleString('ko-KR');
      // Header
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
      header.innerHTML = `<strong style="color: var(--brand-blue);">${author}</strong><span style="color: var(--muted); font-size: 12px;">${createdAt}</span>`;
      postEl.appendChild(header);

      // Content area
      const contentArea = document.createElement('div');
      contentArea.style.cssText = 'color:#333;line-height:1.5;word-wrap:break-word;margin-bottom:8px;';

      if(post.is_secret){
        contentArea.innerHTML = '<em>비밀글입니다. 보기 버튼을 눌러 비밀번호를 입력하세요.</em> ';
        const viewBtn = document.createElement('button'); viewBtn.textContent = '보기';
        viewBtn.addEventListener('click', ()=> verifyAndShow(post.id, contentArea, post));
        contentArea.appendChild(viewBtn);
      } else {
        contentArea.innerHTML = content;
      }

      postEl.appendChild(contentArea);

      // Reply display
      if(post.reply_content){
        const replyEl = document.createElement('div');
        replyEl.style.cssText = 'margin-top:8px;padding:10px;border-left:3px solid var(--brand-blue);background:#fff7;';
        if(post.reply_is_secret && !post.is_secret){
          replyEl.innerHTML = '<em>관리자 전용 비밀댓글</em>';
        } else {
          // if post was secret but unlocked, post.reply_content may be available via verify response
          replyEl.innerHTML = `<strong style="color:var(--brand-blue)">답글</strong><div style="color:var(--muted);margin-top:6px">${sanitizeHtml(post.reply_content)}</div>`;
        }
        postEl.appendChild(replyEl);
      }

      // Admin controls (login via localStorage token)
      const adminToken = localStorage.getItem('adminToken');
      if(adminToken){
        const ctl = document.createElement('div'); ctl.style.cssText='margin-top:8px;display:flex;gap:8px';
        // Reply form
        const replyInput = document.createElement('input'); replyInput.placeholder='관리자 답글'; replyInput.style.width='240px';
        const replySecret = document.createElement('input'); replySecret.type='checkbox';
        const replySecretLabel = document.createElement('label'); replySecretLabel.appendChild(replySecret); replySecretLabel.append(' 비밀');
        const replyBtn = document.createElement('button'); replyBtn.textContent='답글 등록';
        replyBtn.addEventListener('click', async ()=>{
          const payload = { reply_content: replyInput.value, reply_is_secret: !!replySecret.checked };
          const r = await fetch('/api/posts/'+post.id+'/reply', { method: 'PATCH', headers: { 'Content-Type':'application/json', 'x-admin-token': adminToken }, body: JSON.stringify(payload) });
          if(!r.ok) return alert('답글 등록 실패');
          alert('답글 등록됨'); loadPosts(currentPage);
        });
        const delBtn = document.createElement('button'); delBtn.textContent='삭제'; delBtn.addEventListener('click', async ()=>{
          if(!confirm('정말 삭제할까요?')) return;
          const r = await fetch('/api/posts/'+post.id, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
          if(!r.ok) return alert('삭제 실패');
          alert('삭제됨'); loadPosts(currentPage);
        });
        ctl.appendChild(replyInput); ctl.appendChild(replySecretLabel); ctl.appendChild(replyBtn); ctl.appendChild(delBtn);
        postEl.appendChild(ctl);
      }

      boardContainer.appendChild(postEl);
    });
  }

  // 게시글 등록
  async function submitPost(e) {
    e.preventDefault();
    console.log('[Board] submitPost 시작');

    const authorInput = document.getElementById('post-author');
    const contentInput = document.getElementById('post-content');

    if (!authorInput || !contentInput) {
      console.error('[Board] 폼 입력 요소 없음');
      return;
    }

    const author = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) {
      alert('내용을 입력하세요');
      return;
    }

    console.log('[Board] 등록할 데이터:', { author, content });

    const isSecret = !!(secretCheckbox && secretCheckbox.checked);
    const password = passwordInput ? passwordInput.value : '';
    if(isSecret && !password){ alert('비밀글이면 비밀번호를 입력하세요'); return }

    try {
      console.log('[Board] /api/posts POST 요청 시작');
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author || '익명',
          content: content,
          is_secret: isSecret,
          password: password
        })
      });

      console.log('[Board] 응답 상태:', response.status);

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        let errorBody = {};
        try {
          errorBody = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          errorBody = { raw: responseText };
        }
        console.error('[Board] API 에러:', response.status, errorBody);
        alert(errorBody.details?.error || errorBody.error || '등록 실패. 다시 시도해주세요.');
        return;
      }

      console.log('[Board] 등록 성공');
      // 성공 - 폼 초기화 및 목록 갱신
      authorInput.value = '';
      contentInput.value = '';
      loadPosts();
    } catch (error) {
      console.error('[Board] 등록 에러:', error);
      alert('네트워크 오류가 발생했습니다.');
    }
  }

  // 이벤트 바인딩
  if (formElement) {
    console.log('[Board] 폼 제출 이벤트 바인딩');
    formElement.addEventListener('submit', submitPost);
  } else {
    console.error('[Board] 폼을 찾을 수 없어 이벤트 바인딩 실패');
  }

  // secret checkbox show/hide password
  if(secretCheckbox && passwordInput){
    secretCheckbox.addEventListener('change', ()=>{
      passwordInput.style.display = secretCheckbox.checked ? 'block' : 'none';
    });
  }

  // verify and show secret content
  async function verifyAndShow(id, contentArea, post){
    const pw = prompt('비밀번호를 입력하세요');
    if(pw === null) return;
    try{
      const r = await fetch('/api/posts/' + id + '/verify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
      if(!r.ok){ const e = await r.json().catch(()=>({})); return alert(e.error || '비밀번호가 틀립니다'); }
      const data = await r.json();
      contentArea.innerHTML = sanitizeHtml(data.content || '');
      if(data.reply_content){
        const replyEl = document.createElement('div'); replyEl.style.cssText='margin-top:8px;padding:10px;border-left:3px solid var(--brand-blue);';
        replyEl.innerHTML = `<strong style="color:var(--brand-blue)">답글</strong><div style="color:var(--muted);margin-top:6px">${sanitizeHtml(data.reply_content)}</div>`;
        contentArea.parentElement.appendChild(replyEl);
      }
    }catch(err){ console.error(err); alert('검증 중 오류'); }
  }

  // admin login panel in pagination
  function renderAdminPanel(){
    if(!paginationEl) return;
    let adminWrap = document.getElementById('admin-wrap');
    if(adminWrap) return;
    adminWrap = document.createElement('div'); adminWrap.id='admin-wrap'; adminWrap.style.cssText='margin-left:16px;';
    const btn = document.createElement('button');
    const token = localStorage.getItem('adminToken');
    btn.textContent = token ? '관리자 로그아웃' : '관리자 로그인';
    btn.addEventListener('click', ()=>{
      if(localStorage.getItem('adminToken')){ localStorage.removeItem('adminToken'); alert('로그아웃됨'); btn.textContent='관리자 로그인'; loadPosts(currentPage); return }
      const t = prompt('관리자 토큰을 입력하세요'); if(!t) return; localStorage.setItem('adminToken', t); alert('관리자 로그인됨'); btn.textContent='관리자 로그아웃'; loadPosts(currentPage);
    });
    adminWrap.appendChild(btn);
    paginationEl.appendChild(adminWrap);
  }

  // 페이지 로드 완료 후 초기 게시글 로드
  console.log('[Board] 초기 로드 시작, readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[Board] DOMContentLoaded 이벤트 리스너 추가');
    document.addEventListener('DOMContentLoaded', ()=>{ loadPosts(); renderAdminPanel(); });
  } else {
    console.log('[Board] 페이지 이미 로드됨, 즉시 loadPosts 호출');
    loadPosts(); renderAdminPanel();
  }
})();
