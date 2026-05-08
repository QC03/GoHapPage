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
      const selectCols = 'id,author,created_at,is_secret,reply_content,reply_is_secret';
      const url = `${restBase}?select=${encodeURIComponent(selectCols)}&order=created_at.desc&limit=${limit}&offset=${offset}`;

      // Try primary query; if Supabase returns 400 (likely missing columns), try fallback minimal selects.
      let r = await fetch(url, { headers });
      if(r.status === 400){
        const fallbacks = [
          'id,author,created_at,is_secret',
          'id,author,created_at'
        ];
        for(const cols of fallbacks){
          const tryUrl = `${restBase}?select=${encodeURIComponent(cols)}&order=created_at.desc&limit=${limit}&offset=${offset}`;
          const rr = await fetch(tryUrl, { headers });
          if(rr.ok){
            const data = await rr.json();
            return res.status(200).json(data);
          }
        }
        // If fallbacks also fail, forward original response body for debugging
        const errBody = await r.text();
        return res.status(400).json({ error: 'bad request from supabase', details: errBody });
      }

      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // Verify secret post and fetch content.
    // Supports both POST /api/posts/:id/verify and POST /api/posts?action=verify&id=:id
    if(req.method === 'POST' && (pathname.match(/^\/api\/posts\/\d+\/verify$/) || (pathname === '/api/posts' && ((req.query && req.query.action) === 'verify' || (req.query && req.query.verify === '1'))))){
      const id = pathname.match(/^\/api\/posts\/\d+\/verify$/)
        ? pathname.split('/')[3]
        : String((req.query && req.query.id) || '');
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
      // Check if this is a delete request
      if((req.query && req.query.action) === 'delete' && (req.query && req.query.id)){
        const id = String((req.query && req.query.id) || '');
        const body = req.body || {};
        const pw = body.password || '';
        if(pw !== '0610') return res.status(403).json({ error: 'invalid password' });
        const r = await fetch(`${restBase}?id=eq.${id}`, { method: 'DELETE', headers });
        const data = await r.json();
        return res.status(r.status).json(data);
      }
      
      // Otherwise, handle as normal post creation
      let body = req.body;
      if(typeof body === 'string'){
        try{ body = JSON.parse(body); }catch(e){
          return res.status(400).json({ error: 'invalid json' });
        }
      }
      if(!body || !String(body.content || '').trim()) return res.status(400).json({ error: 'content required' });
      const is_secret = !!body.is_secret;
      const password = body.password || '';
      const password_hash = is_secret ? require('crypto').createHash('sha256').update(password).digest('hex') : null;
      const basePayload = {
        author: body.author || '익명',
        content: String(body.content).trim()
      };
      const payload = is_secret
        ? { ...basePayload, is_secret, password_hash }
        : basePayload;
      const r = await fetch(restBase, { method: 'POST', headers: { ...headers, 'Prefer':'return=representation' }, body: JSON.stringify(payload) });
      const text = await r.text();
      let data;
      try{ data = JSON.parse(text); }catch(e){ data = { raw: text }; }
      if(!r.ok) return res.status(r.status).json({ error: 'supabase error', details: data, status: r.status, statusText: r.statusText, payload });
      return res.status(r.status).json(data);
    }

    // Admin: add reply - PATCH /api/posts/:id/reply
    if(req.method === 'PATCH' && pathname.match(/^\/api\/posts\/\d+\/reply$/)){
      const adminToken = req.headers['x-admin-token'] || req.headers['x-admin-token'.toLowerCase()];
      if(!adminToken || adminToken !== '0610') return res.status(403).json({ error: 'admin required' });
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
      if(!adminToken || adminToken !== '0610') return res.status(403).json({ error: 'admin required' });
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
