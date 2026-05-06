// Simple include loader for static pages
(async function(){
  const includes = [
    { id: 'site-header', path: '../includes/header.html' },
    { id: 'site-footer', path: '../includes/footer.html' }
  ];

  for (const inc of includes) {
    const el = document.getElementById(inc.id);
    if (!el) continue;
    try {
      const res = await fetch(inc.path);
      if (res.ok) el.innerHTML = await res.text();
      else console.warn('Include fetch failed:', inc.path, res.status);
    } catch (e) {
      console.error('Include error:', e);
    }
  }
})();
