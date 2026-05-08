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
      postEl.className = 'post-item';
      postEl.style.cssText = 'padding: 14px; border: 1px solid rgba(16,24,72,0.06); border-radius: 8px; margin-bottom: 12px;';

      const author = sanitizeHtml(post.author || '익명');
      const content = sanitizeHtml(post.content || '');
      const createdAt = new Date(post.created_at).toLocaleString('ko-KR');
      
      // Header
      const header = document.createElement('div');
      header.className = 'post-header';
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;font-size:13px;';
      
      const authorSpan = document.createElement('span');
      authorSpan.className = 'post-author';
      authorSpan.textContent = author;
      authorSpan.style.cssText = 'font-weight:600;color:#172033;';
      
      const dateSpan = document.createElement('span');
      dateSpan.className = 'post-date';
      dateSpan.textContent = createdAt;
      dateSpan.style.cssText = 'color:var(--muted);';
      
      if(post.is_secret){
        const badgeEl = document.createElement('span');
        badgeEl.className = 'post-secret-badge';
        badgeEl.textContent = '비밀글';
        badgeEl.style.cssText = 'background:var(--brand-blue);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;';
        header.appendChild(authorSpan);
        header.appendChild(badgeEl);
        header.appendChild(dateSpan);
      } else {
        header.appendChild(authorSpan);
        header.appendChild(dateSpan);
      }
      postEl.appendChild(header);

      // Content area
      const contentArea = document.createElement('div');
      contentArea.className = 'post-content';
      contentArea.style.cssText = 'color:#172033;line-height:1.5;word-wrap:break-word;margin-bottom:8px;';

      if(post.is_secret){
        contentArea.innerHTML = '<em>비밀글입니다. 보기 버튼을 눌러 비밀번호를 입력하세요.</em> ';
        const viewBtn = document.createElement('button');
        viewBtn.style.cssText = 'margin-left:8px;padding:4px 10px;background:var(--brand-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;';
        viewBtn.textContent = '보기';
        viewBtn.addEventListener('click', ()=> verifyAndShow(post.id, contentArea, post));
        contentArea.appendChild(viewBtn);
      } else {
        const maxLen = 100;
        let displayContent = content;
        if(content.length > maxLen) {
          displayContent = content.substring(0, maxLen) + '...';
        }
        contentArea.textContent = displayContent;
      }

      postEl.appendChild(contentArea);

      // Reply display (only show if post is not secret)
      if(post.reply_content && !post.is_secret){
        const replyEl = document.createElement('div');
        replyEl.className = 'post-reply';
        replyEl.style.cssText = 'margin-top:12px;padding:12px;border-left:3px solid var(--brand-blue);background:rgba(18,18,161,0.03);border-radius:4px;font-size:13px;';
        if(post.reply_is_secret){
          replyEl.innerHTML = '<em>관리자 전용 비밀댓글</em>';
        } else {
          const replyTitle = document.createElement('strong');
          replyTitle.style.cssText = 'color:var(--brand-blue);display:block;margin-bottom:4px;';
          replyTitle.textContent = '답글';
          const replyContent = document.createElement('div');
          replyContent.style.cssText = 'color:var(--muted);';
          replyContent.textContent = post.reply_content;
          replyEl.appendChild(replyTitle);
          replyEl.appendChild(replyContent);
        }
        postEl.appendChild(replyEl);
      }

      // Delete button (with admin password)
      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.style.cssText = 'margin-top:8px;padding:6px 12px;background:#dc3545;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;';
      delBtn.addEventListener('click', async ()=>{
        const pw = prompt('삭제하려면 관리자 비밀번호를 입력하세요');
        if(pw === null) return;
        if(pw !== '0610') return alert('비밀번호가 틀렸습니다');
        const r = await fetch('/api/posts?action=delete&id=' + encodeURIComponent(post.id), { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ password: pw }) });
        if(!r.ok) return alert('삭제 실패');
        alert('삭제됨'); loadPosts(currentPage);
      });
      const buttonWrapper = document.createElement('div');
      buttonWrapper.style.cssText = 'display:flex;gap:8px;';
      buttonWrapper.appendChild(delBtn);
      postEl.appendChild(buttonWrapper);

      // Admin reply button (password-based)
      const replyAdminBtn = document.createElement('button');
      replyAdminBtn.textContent = '답글';
      replyAdminBtn.style.cssText = 'margin-top:8px;padding:6px 12px;background:var(--brand-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;';
      replyAdminBtn.addEventListener('click', async ()=>{
        const pw = prompt('답글을 등록하려면 관리자 비밀번호를 입력하세요');
        if(pw === null) return;
        if(pw !== '0610') return alert('비밀번호가 틀렸습니다');
        
        // Create inline reply form
        const replyFormWrapper = document.createElement('div');
        replyFormWrapper.style.cssText = 'margin-top:8px;padding:12px;background:#f5f8ff;border-radius:8px;border:1px solid rgba(18,18,161,0.1);';
        
        const replyInput = document.createElement('textarea');
        replyInput.placeholder = '답글 내용을 입력하세요';
        replyInput.style.cssText = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px;font-family:inherit;margin-bottom:8px;';
        replyInput.rows = 3;
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = '답글 등록';
        submitBtn.style.cssText = 'padding:8px 16px;background:var(--brand-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;margin-right:8px;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '취소';
        cancelBtn.style.cssText = 'padding:8px 16px;background:#ccc;color:#333;border:none;border-radius:4px;cursor:pointer;font-weight:600;';
        
        submitBtn.addEventListener('click', async ()=>{
          if(!replyInput.value.trim()) return alert('답글 내용을 입력하세요');
          const payload = { reply_content: replyInput.value, reply_is_secret: post.is_secret, password: pw };
          const r = await fetch('/api/posts?action=reply&id=' + encodeURIComponent(post.id), { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
          if(!r.ok) return alert('답글 등록 실패');
          alert('답글 등록됨'); replyFormWrapper.remove(); loadPosts(currentPage);
        });
        
        cancelBtn.addEventListener('click', ()=>{
          replyFormWrapper.remove();
        });
        
        replyFormWrapper.appendChild(replyInput);
        replyFormWrapper.appendChild(submitBtn);
        replyFormWrapper.appendChild(cancelBtn);
        postEl.appendChild(replyFormWrapper);
      });
      buttonWrapper.appendChild(replyAdminBtn);

      boardContainer.appendChild(postEl);
    });
  }

  // 피드백 메시지 표시
  function showFeedback(message, type = 'success') {
    const feedbackEl = document.getElementById('form-feedback');
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.className = 'form-feedback ' + type;
    feedbackEl.style.display = 'block';
    if(type === 'success') {
      setTimeout(() => { feedbackEl.style.display = 'none'; }, 3000);
    }
  }

  // 게시글 등록
  async function submitPost(e) {
    e.preventDefault();
    console.log('[Board] submitPost 시작');

    const authorInput = document.getElementById('post-author');
    const contentInput = document.getElementById('post-content');
    const feedbackEl = document.getElementById('form-feedback');

    if (!authorInput || !contentInput) {
      console.error('[Board] 폼 입력 요소 없음');
      return;
    }

    const author = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) {
      showFeedback('내용을 입력하세요', 'error');
      return;
    }

    console.log('[Board] 등록할 데이터:', { author, content });

    const isSecret = !!(secretCheckbox && secretCheckbox.checked);
    const password = passwordInput ? passwordInput.value : '';
    if(isSecret && !password){ 
      showFeedback('비밀글이면 비밀번호를 입력하세요', 'error');
      return;
    }

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
        const errorMsg = errorBody.details?.error || errorBody.error || '등록 실패. 다시 시도해주세요.';
        showFeedback(errorMsg, 'error');
        return;
      }

      console.log('[Board] 등록 성공');
      showFeedback('문의가 등록되었습니다. 감사합니다!', 'success');
      // 성공 - 폼 초기화 및 목록 갱신
      authorInput.value = '';
      contentInput.value = '';
      if(secretCheckbox) secretCheckbox.checked = false;
      if(passwordInput) {
        passwordInput.value = '';
        passwordInput.style.display = 'none';
      }
      setTimeout(() => { loadPosts(); }, 500);
    } catch (error) {
      console.error('[Board] 등록 에러:', error);
      showFeedback('네트워크 오류가 발생했습니다.', 'error');
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
      const r = await fetch('/api/posts?action=verify&id=' + encodeURIComponent(id), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
      if(!r.ok){ const e = await r.json().catch(()=>({})); return showFeedback(e.error || '비밀번호가 틀립니다', 'error'); }
      const data = await r.json();
      contentArea.textContent = data.content || '';
      
      // Remove existing reply element if it exists
      const existingReply = contentArea.parentElement.querySelector('.post-reply');
      if(existingReply) existingReply.remove();
      
      if(data.reply_content){
        const replyEl = document.createElement('div'); 
        replyEl.className = 'post-reply';
        replyEl.style.cssText='margin-top:12px;padding:12px;border-left:3px solid var(--brand-blue);background:rgba(18,18,161,0.03);border-radius:4px;font-size:13px;';
        const replyTitle = document.createElement('strong');
        replyTitle.style.cssText = 'color:var(--brand-blue);display:block;margin-bottom:4px;';
        replyTitle.textContent = '답글';
        const replyContent = document.createElement('div');
        replyContent.style.cssText = 'color:var(--muted);';
        replyContent.textContent = data.reply_content;
        replyEl.appendChild(replyTitle);
        replyEl.appendChild(replyContent);
        contentArea.parentElement.appendChild(replyEl);
      }
    }catch(err){ console.error(err); showFeedback('검증 중 오류가 발생했습니다', 'error'); }
  }

  // admin panel - hidden, no password display
  function renderAdminPanel(){
    if(!paginationEl) return;
    let adminWrap = document.getElementById('admin-wrap');
    if(adminWrap) return;
    // No display needed - password handled inline per operation
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
