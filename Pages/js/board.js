// 고합상사 게시판 - 서버리스 프록시 모드
// 모든 요청은 /api/posts를 거쳐 Supabase와 통신

(function() {
  const boardContainer = document.getElementById('posts-list');
  const formElement = document.getElementById('post-form');

  // 게시글 목록 조회
  async function loadPosts() {
    if (!boardContainer) return;
    
    try {
      const response = await fetch('/api/posts', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        boardContainer.innerText = '게시글 로드 실패';
        console.error('API error:', response.status);
        return;
      }

      const posts = await response.json();
      displayPosts(posts || []);
    } catch (error) {
      boardContainer.innerText = '게시글 로드 실패';
      console.error('Fetch error:', error);
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

    const authorInput = document.getElementById('post-author');
    const contentInput = document.getElementById('post-content');

    if (!authorInput || !contentInput) return;

    const author = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) {
      alert('내용을 입력하세요');
      return;
    }

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author || '익명',
          content: content
        })
      });

      if (!response.ok) {
        console.error('API error:', response.status);
        alert('등록 실패. 다시 시도해주세요.');
        return;
      }

      // 성공 - 폼 초기화 및 목록 갱신
      authorInput.value = '';
      contentInput.value = '';
      loadPosts();
    } catch (error) {
      console.error('Submit error:', error);
      alert('네트워크 오류가 발생했습니다.');
    }
  }

  // 이벤트 바인딩
  if (formElement) {
    formElement.addEventListener('submit', submitPost);
  }

  // 페이지 로드 완료 후 초기 게시글 로드
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPosts);
  } else {
    loadPosts();
  }
})();
