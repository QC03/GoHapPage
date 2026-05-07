// Serverless proxy for Supabase REST API
// Requires environment variables at deployment:
// SUPABASE_URL (e.g. https://xxxx.supabase.co)
// SUPABASE_SERVICE_ROLE_KEY (Service Role key - keep secret)

async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://gbyvejifhlgxsmbfhlte.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXZlamlmaGxneHNtYmZobHRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODEzNzExMCwiZXhwIjoyMDkzNzEzMTEwfQ.Yk_eUdxE8GGQWVPVSyAHGbzNF_HYCLLb-2L9bPvriOk";

  if(!SUPABASE_URL || !SERVICE_KEY){
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  const restBase = `${SUPABASE_URL}/rest/v1/posts`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try{
    // Routing: support list with pagination, single post verify, admin reply and delete
    const urlPath = req.url || req.path || '';
    // Normalize: remove query
    const pathname = urlPath.split('?')[0];

    // GET list with pagination: /api/posts?page=1
    if(req.method === 'GET' && (pathname === '/api/posts' || pathname === '/posts' || pathname === '/')){
      const page = parseInt((req.query && req.query.page) || (req.query && req.query.p) || 1, 10) || 1;
      const limit = 5;
      const offset = (page - 1) * limit;
      const url = `${restBase}?select=id,author,created_at,is_secret,reply_content,reply_is_secret&order=created_at.desc&limit=${limit}&offset=${offset}`;
      const r = await fetch(url, { headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // Verify secret post and fetch content: POST /api/posts/:id/verify  { password }
    if(req.method === 'POST' && pathname.match(/^\/api\/posts\/\d+\/verify$/)){
      const id = pathname.split('/')[3];
      const body = req.body || {};
      const pw = body.password || '';
      // fetch post
      const r = await fetch(`${restBase}?select=id,author,content,is_secret,password_hash,reply_content,reply_is_secret&id=eq.${id}`, { headers });
      const items = await r.json();
      const post = (items && items[0]) || null;
      if(!post) return res.status(404).json({ error: 'not found' });
      if(!post.is_secret) return res.status(200).json(post);
      const hash = require('crypto').createHash('sha256').update(pw).digest('hex');
      if(hash === post.password_hash) return res.status(200).json(post);
      return res.status(403).json({ error: 'invalid password' });
    }

    if(req.method === 'POST' && pathname === '/api/posts'){
      const body = req.body;
      if(!body || !body.content) return res.status(400).json({ error: 'content required' });
      const is_secret = !!body.is_secret;
      const password = body.password || '';
      const password_hash = is_secret ? require('crypto').createHash('sha256').update(password).digest('hex') : null;
      const payload = { author: body.author||'익명', content: body.content, created_at: new Date().toISOString(), is_secret, password_hash, reply_content: null, reply_is_secret: false };
      const r = await fetch(restBase, { method: 'POST', headers: { ...headers, 'Prefer':'return=representation' }, body: JSON.stringify(payload) });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // Admin: add reply - PATCH /api/posts/:id/reply
    if(req.method === 'PATCH' && pathname.match(/^\/api\/posts\/\d+\/reply$/)){
      const adminToken = req.headers['x-admin-token'] || req.headers['x-admin-token'.toLowerCase()];
      if(!adminToken || adminToken !== process.env.SUPABASE_ADMIN_TOKEN) return res.status(403).json({ error: 'admin required' });
      const id = pathname.split('/')[3];
      const body = req.body || {};
      const reply_content = body.reply_content || null;
      const reply_is_secret = !!body.reply_is_secret;
      const payload = { reply_content, reply_is_secret };
      const r = await fetch(`${restBase}?id=eq.${id}`, { method: 'PATCH', headers: { ...headers, 'Prefer':'return=representation' }, body: JSON.stringify(payload) });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // Admin: delete post - DELETE /api/posts/:id
    if(req.method === 'DELETE' && pathname.match(/^\/api\/posts\/\d+$/)){
      const adminToken = req.headers['x-admin-token'] || req.headers['x-admin-token'.toLowerCase()];
      if(!adminToken || adminToken !== process.env.SUPABASE_ADMIN_TOKEN) return res.status(403).json({ error: 'admin required' });
      const id = pathname.split('/')[3];
      const r = await fetch(`${restBase}?id=eq.${id}`, { method: 'DELETE', headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    res.setHeader('Allow', 'GET,POST');
    return res.status(405).end('Method Not Allowed');
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'proxy error' });
  }
}

module.exports = handler;
