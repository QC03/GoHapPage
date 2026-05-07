// 고합상사 게시판 - 서버리스 프록시 모드
// 모든 요청은 /api/posts를 거쳐 Supabase와 통신

(function() {
  console.log('[Board] board.js 로드됨');
  const boardContainer = document.getElementById('posts-list');
  const formElement = document.getElementById('post-form');
  
  console.log('[Board] boardContainer:', boardContainer ? 'found' : 'NOT found');
  console.log('[Board] formElement:', formElement ? 'found' : 'NOT found');

  // 게시글 목록 조회
  async function loadPosts() {
    console.log('[Board] loadPosts 시작');
    if (!boardContainer) {
      console.error('[Board] posts-list 컨테이너 없음');
      return;
    }
    
    try {
      console.log('[Board] /api/posts 요청 시작');
      const response = await fetch('/api/posts', {
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
    } catch (error) {
      boardContainer.innerText = '게시글 로드 실패';
      console.error('[Board] Fetch 에러:', error);
    }
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

      postEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--brand-blue);">${author}</strong>
          <span style="color: var(--muted); font-size: 12px;">${createdAt}</span>
        </div>
        <div style="color: #333; line-height: 1.5; word-wrap: break-word;">${content}</div>
      `;

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

    try {
      console.log('[Board] /api/posts POST 요청 시작');
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author || '익명',
          content: content
        })
      });

      console.log('[Board] 응답 상태:', response.status);

      if (!response.ok) {
        console.error('[Board] API 에러:', response.status);
        alert('등록 실패. 다시 시도해주세요.');
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

  // 페이지 로드 완료 후 초기 게시글 로드
  console.log('[Board] 초기 로드 시작, readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[Board] DOMContentLoaded 이벤트 리스너 추가');
    document.addEventListener('DOMContentLoaded', loadPosts);
  } else {
    console.log('[Board] 페이지 이미 로드됨, 즉시 loadPosts 호출');
    loadPosts();
  }
})();
