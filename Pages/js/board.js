// 게시판 클라이언트 스크립트 (서버리스 프록시 모드)
// 모든 요청은 /api/posts 를 거쳐 안전하게 처리됨

const postsList = document.getElementById('posts-list');
const postForm = document.getElementById('post-form');

async function fetchPosts(){
  try{
    const r = await fetch('/api/posts');
    if(!r.ok){ postsList.innerText = '게시글 로드 실패'; return }
    const data = await r.json();
    renderPosts(data || []);
  }catch(err){
    postsList.innerText = '게시글 로드 실패';
    console.error(err);
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"
  }[c]));
}

function renderPosts(items){
  postsList.innerHTML = '';
  if(items.length === 0){ postsList.innerHTML = '<div>등록된 글이 없습니다.</div>'; return }
  items.forEach(it=>{
    const el = document.createElement('div');
    el.style.padding = '12px';
    el.style.border = '1px solid rgba(16,24,72,0.06)';
    el.style.borderRadius = '8px';
    el.innerHTML = `<strong style="color:var(--brand-blue)">${escapeHtml(it.author||'익명')}</strong><div style="color:var(--muted);font-size:13px;margin-bottom:6px">${new Date(it.created_at).toLocaleString()}</div><div>${escapeHtml(it.content)}</div>`;
    postsList.appendChild(el);
  })
}

postForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const author = document.getElementById('post-author').value.trim();
  const content = document.getElementById('post-content').value.trim();
  if(!content) return alert('내용을 입력하세요');

  try{
    const r = await fetch('/api/posts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ author: author || '익명', content }) });
    if(!r.ok) throw new Error('등록 실패');

    document.getElementById('post-author').value = '';
    document.getElementById('post-content').value = '';
    fetchPosts();
  }catch(err){ console.error(err); alert('등록 실패'); }
});

// 초기 로드
document.addEventListener('DOMContentLoaded', ()=>{
  fetchPosts();
});
