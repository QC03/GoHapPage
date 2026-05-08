// Serverless proxy for Supabase REST API
// Requires environment variables at deployment:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// ADMIN_PASSWORD

const crypto = require('crypto');

const RATE_LIMIT_STORE = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkRateLimit(req, scope, limit, windowMs) {
  const key = `${scope}:${clientIp(req)}`;
  const now = Date.now();
  const current = RATE_LIMIT_STORE.get(key);
  if (!current || now > current.resetAt) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }
  if (current.count >= limit) {
    return { limited: true, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  RATE_LIMIT_STORE.set(key, current);
  return { limited: false };
}

function sanitizePost(post) {
  if (!post) return null;
  const { password_hash, ...safe } = post;
  return safe;
}

function parsePostId(raw) {
  const id = String(raw || '').trim();
  return /^\d+$/.test(id) ? id : null;
}

function hashSecretPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifySecretPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHex = parts[2];
    const candidateHex = crypto.scryptSync(password, salt, 64).toString('hex');
    const expected = Buffer.from(expectedHex, 'hex');
    const candidate = Buffer.from(candidateHex, 'hex');
    if (expected.length !== candidate.length) return false;
    return crypto.timingSafeEqual(expected, candidate);
  }

  // Backward compatibility for legacy SHA-256 rows
  const legacy = crypto.createHash('sha256').update(password).digest('hex');
  return legacy === storedHash;
}

async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'server not configured' });
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

    if (req.method === 'GET' && (pathname === '/api/posts' || pathname === '/posts' || pathname === '/')) {
      const page = parseInt((req.query && req.query.page) || (req.query && req.query.p) || 1, 10) || 1;
      const limit = 5;
      const offset = (page - 1) * limit;
      const selectCols = 'id,author,content,created_at,is_secret,reply_content,reply_is_secret';
      const url = `${restBase}?select=${encodeURIComponent(selectCols)}&order=created_at.desc&limit=${limit}&offset=${offset}`;

      let r = await fetch(url, { headers });
      if (r.status === 400) {
        const fallbacks = [
          'id,author,content,created_at,is_secret',
          'id,author,content,created_at'
        ];
        for (const cols of fallbacks) {
          const tryUrl = `${restBase}?select=${encodeURIComponent(cols)}&order=created_at.desc&limit=${limit}&offset=${offset}`;
          const rr = await fetch(tryUrl, { headers });
          if (rr.ok) {
            const data = await rr.json();
            return res.status(200).json(data);
          }
        }
        return res.status(500).json({ error: 'failed to load posts' });
      }

      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // Verify secret post and fetch content.
    // Supports both POST /api/posts/:id/verify and POST /api/posts?action=verify&id=:id
    if (req.method === 'POST' && (pathname.match(/^\/api\/posts\/\d+\/verify$/) || (pathname === '/api/posts' && ((req.query && req.query.action) === 'verify' || (req.query && req.query.verify === '1'))))) {
      const limiter = checkRateLimit(req, 'verify', 20, 60 * 1000);
      if (limiter.limited) {
        return res.status(429).json({ error: 'too many requests', retry_after: limiter.retryAfterSec });
      }

      const id = pathname.match(/^\/api\/posts\/\d+\/verify$/)
        ? pathname.split('/')[3]
        : String((req.query && req.query.id) || '');
      const safeId = parsePostId(id);
      if (!safeId) return res.status(400).json({ error: 'invalid post id' });
      const body = req.body || {};
      const pw = String(body.password || '');

      const r = await fetch(`${restBase}?select=id,author,content,is_secret,password_hash,reply_content,reply_is_secret&id=eq.${safeId}`, { headers });
      const items = await r.json();
      const post = (items && items[0]) || null;
      if (!post) return res.status(404).json({ error: 'not found' });
      if (!post.is_secret) return res.status(200).json(sanitizePost(post));

      const isAdminPw = ADMIN_PASSWORD && pw === ADMIN_PASSWORD;
      if (verifySecretPassword(pw, post.password_hash) || isAdminPw) {
        return res.status(200).json(sanitizePost(post));
      }
      return res.status(403).json({ error: 'invalid password' });
    }

    if (req.method === 'POST' && pathname === '/api/posts') {
      if ((req.query && req.query.action) === 'delete' && (req.query && req.query.id)) {
        const limiter = checkRateLimit(req, 'admin-delete', 10, 60 * 1000);
        if (limiter.limited) {
          return res.status(429).json({ error: 'too many requests', retry_after: limiter.retryAfterSec });
        }
        if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'server not configured' });

        const id = String((req.query && req.query.id) || '');
        const safeId = parsePostId(id);
        if (!safeId) return res.status(400).json({ error: 'invalid post id' });
        const body = req.body || {};
        const pw = String(body.password || '');
        if (pw !== ADMIN_PASSWORD) return res.status(403).json({ error: 'invalid password' });

        const r = await fetch(`${restBase}?id=eq.${safeId}`, { method: 'DELETE', headers });
        if (!r.ok) return res.status(r.status).json({ error: 'delete failed' });
        return res.status(200).json({ success: true });
      }

      if ((req.query && req.query.action) === 'reply' && (req.query && req.query.id)) {
        const limiter = checkRateLimit(req, 'admin-reply', 10, 60 * 1000);
        if (limiter.limited) {
          return res.status(429).json({ error: 'too many requests', retry_after: limiter.retryAfterSec });
        }
        if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'server not configured' });

        const id = String((req.query && req.query.id) || '');
        const safeId = parsePostId(id);
        if (!safeId) return res.status(400).json({ error: 'invalid post id' });
        const body = req.body || {};
        const pw = String(body.password || '');
        if (pw !== ADMIN_PASSWORD) return res.status(403).json({ error: 'invalid password' });

        const fetchPostR = await fetch(`${restBase}?id=eq.${safeId}&select=is_secret`, { headers });
        const postItems = await fetchPostR.json();
        const post = (postItems && postItems[0]) || null;
        if (!post) return res.status(404).json({ error: 'post not found' });

        const reply_content = String(body.reply_content || '').trim() || null;
        const reply_is_secret = !!post.is_secret;
        const payload = { reply_content, reply_is_secret };

        const r = await fetch(`${restBase}?id=eq.${safeId}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        });
        const data = await r.json();
        return res.status(r.status).json(data);
      }

      const createLimiter = checkRateLimit(req, 'create-post', 30, 60 * 1000);
      if (createLimiter.limited) {
        return res.status(429).json({ error: 'too many requests', retry_after: createLimiter.retryAfterSec });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: 'invalid json' });
        }
      }
      if (!body || !String(body.content || '').trim()) return res.status(400).json({ error: 'content required' });

      const is_secret = !!body.is_secret;
      const password = String(body.password || '');
      if (is_secret && password.length < 4) {
        return res.status(400).json({ error: 'password must be at least 4 characters' });
      }

      const password_hash = is_secret ? hashSecretPassword(password) : null;
      const basePayload = {
        author: body.author || '익명',
        content: String(body.content).trim()
      };
      const payload = is_secret
        ? { ...basePayload, is_secret, password_hash }
        : basePayload;

      const r = await fetch(restBase, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });

      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }

      if (!r.ok) return res.status(r.status).json({ error: 'failed to create post' });
      if (Array.isArray(data)) {
        return res.status(r.status).json(data.map(sanitizePost));
      }
      return res.status(r.status).json(sanitizePost(data));
    }

    res.setHeader('Allow', 'GET,POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'proxy error' });
  }
}

module.exports = handler;
