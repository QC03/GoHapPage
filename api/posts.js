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
    if(req.method === 'GET'){
      const url = `${restBase}?select=id,author,content,created_at&order=created_at.desc`;
      const r = await fetch(url, { headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if(req.method === 'POST'){
      const body = req.body;
      if(!body || !body.content) return res.status(400).json({ error: 'content required' });
      const r = await fetch(restBase, { method: 'POST', headers: { ...headers, 'Prefer':'return=representation' }, body: JSON.stringify({ author: body.author||'익명', content: body.content, created_at: new Date().toISOString() }) });
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
