// forms.js - Handle contact form locally (demo)
(function(){
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const submissionsEl = document.getElementById('submissions');
  const STORAGE_KEY = 'gohap_submissions_v1';

  function loadSubmissions(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    }catch(e){return []}
  }

  function saveSubmission(entry){
    const arr = loadSubmissions();
    arr.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function renderSubmissions(){
    const arr = loadSubmissions();
    if(!submissionsEl) return;
    if(arr.length===0){ submissionsEl.innerHTML = '<p>저장된 게시물이 없습니다.</p>'; return }
    submissionsEl.innerHTML = '<ul>' + arr.map(s=>`<li><strong>${escapeHtml(s.name)}</strong> (${escapeHtml(s.email)})<br>${escapeHtml(s.message)}</li>`).join('') + '</ul>';
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>\"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      // honeypot
      const hp = form.querySelector('[name="_hp"]').value;
      if(hp){ status.textContent = '스팸 의심 제출이 차단되었습니다.'; status.style.color='red'; return }
      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim(),
        at: new Date().toISOString()
      };
      if(!data.name || !data.email || !data.message){ status.textContent='모든 필드를 입력하세요.'; status.style.color='red'; return }
      saveSubmission(data);
      renderSubmissions();
      form.reset();
      status.textContent = '메시지가 저장되었습니다 (로컬 저장, 추후 서버 연동 필요).';
      status.style.color = 'green';
    });
  }

  // initial render
  document.addEventListener('DOMContentLoaded', renderSubmissions);
})();
