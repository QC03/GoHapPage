// Supabase 게시판 클라이언트 스크립트
// 사용법:
// 1) Supabase 프로젝트 생성
// 2) 테이블 `posts` 생성 (columns: id (serial), author text, content text, created_at timestamptz)
// 3) 아래 SUPABASE_URL, SUPABASE_ANON_KEY에 값 입력

// If you have a public SUPABASE_URL/ANON_KEY, set them here (client mode).
const SUPABASE_URL = 'https://irqagypqztspjbkhezdp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycWFneXBxenRzcGpia2hlemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzY0OTQsImV4cCI6MjA5MzcxMjQ5NH0.0UTRwfCoZqEwgCeJwsuYAw3wOB4T3H4xP0FBi8Ft1Bg';

// Support both UMD builds that expose `supabase` or `supabaseJs` when using client mode
const _createClient = (typeof window !== 'undefined' && window.supabase && window.supabase.createClient)
  ? window.supabase.createClient
  : (typeof window !== 'undefined' && window.supabaseJs && window.supabaseJs.createClient)
  ? window.supabaseJs.createClient
  : null;

const supabase = (_createClient && SUPABASE_URL && !SUPABASE_URL.includes('REPLACE')) ? _createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const postsList = document.getElementById('posts-list');
const postForm = document.getElementById('post-form');

async function fetchPosts(){
  // If client supabase configured, use it. Otherwise call local proxy /api/posts
  try{
    if(supabase){
      const { data, error } = await supabase.from('posts').select('id,author,content,created_at').order('created_at', { ascending: false });
      if(error){ throw error }
      return renderPosts(data || []);
    }

    // proxy mode
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
    if(supabase){
      const { error } = await supabase.from('posts').insert([{ author: author || '익명', content, created_at: new Date().toISOString() }]);
      if(error){ throw error }
    }else{
      const r = await fetch('/api/posts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ author: author || '익명', content }) });
      if(!r.ok) throw new Error('등록 실패');
    }

    document.getElementById('post-author').value = '';
    document.getElementById('post-content').value = '';
    fetchPosts();
  }catch(err){ console.error(err); alert('등록 실패'); }
});

// 초기 로드
document.addEventListener('DOMContentLoaded', ()=>{
  fetchPosts();
});
