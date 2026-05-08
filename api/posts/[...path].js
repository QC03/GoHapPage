// Nested post actions for Vercel API routing.
// Handles:
// - POST /api/posts/:id/verify
// - PATCH /api/posts/:id/reply
// - DELETE /api/posts/:id

async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://gbyvejifhlgxsmbfhlte.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXZlamlmaGxneHNtYmZobHRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODEzNzExMCwiZXhwIjoyMDkzNzEzMTEwfQ.Yk_eUdxE8GGQWVPVSyAHGbzNF_HYCLLb-2L9bPvriOk";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  const restBase = `${SUPABASE_URL}/rest/v1/posts`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const urlPath = req.url || req.path || '';
    const pathname = urlPath.split('?')[0];
    
    // Extract ID and action from pathname like /api/posts/5 or /api/posts/5/reply
    const parts = pathname.split('/').filter(Boolean); // ['api', 'posts', '5'] or ['api', 'posts', '5', 'reply']
    const id = parts[2]; // The ID is always at index 2
    const action = parts[3] || ''; // The action (if any) is at index 3

    if (!id || !/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: 'invalid post id' });
    }

    if (req.method === 'POST' && action === 'verify') {
      const body = req.body || {};
      const pw = body.password || '';
      const r = await fetch(`${restBase}?select=id,author,content,is_secret,password_hash,reply_content,reply_is_secret&id=eq.${id}`, { headers });
      const items = await r.json();
      const post = (items && items[0]) || null;
      if (!post) return res.status(404).json({ error: 'not found' });
      if (!post.is_secret) return res.status(200).json(post);

      const hash = require('crypto').createHash('sha256').update(pw).digest('hex');
      if (hash === post.password_hash) return res.status(200).json(post);
      return res.status(403).json({ error: 'invalid password' });
    }

    if (req.method === 'PATCH' && action === 'reply') {
      const body = req.body || {};
      const pw = body.password || '';
      if (pw !== '0610') {
        return res.status(403).json({ error: 'invalid password' });
      }

      const payload = {
        reply_content: body.reply_content || null,
        reply_is_secret: !!body.reply_is_secret
      };

      const r = await fetch(`${restBase}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    res.setHeader('Allow', 'POST,PATCH');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'proxy error' });
  }
}

module.exports = handler;