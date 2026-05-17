const CORS_ORIGINS = [
  'https://dreadnaughtasaurous.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

const MAX_ENTRIES    = 5000  // rolling cap; oldest pruned on GET aggregation

function corsHeaders(origin) {
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const url    = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // ── POST /log — called by SearchModal.vue after each search or Ask AI query ──
    if (request.method === 'POST' && url.pathname === '/log') {
      let body
      try { body = await request.json() } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        })
      }

      const entry = {
        tab:         ['search', 'ask'].includes(body.tab) ? body.tab : 'search',
        query:       String(body.query     || '').slice(0, 200).trim(),
        eba:         String(body.eba       || '').slice(0, 100),
        topic:       String(body.topic     || '').slice(0, 100),
        resultCount: typeof body.resultCount === 'number' ? Math.max(0, Math.floor(body.resultCount)) : null,
        timestamp:   new Date().toISOString(),
      }

      if (!entry.query) {
        return new Response(JSON.stringify({ ok: false, reason: 'empty query' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        })
      }

      // key = timestamp + 6-char random suffix to avoid collisions
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      await env.EBA_ANALYTICS.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 90 }) // 90-day TTL

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      })
    }

    // ── GET /analytics — called by the admin dashboard page ──
    if (request.method === 'GET' && url.pathname === '/analytics') {
      const auth = request.headers.get('Authorization') || ''
      if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        })
      }

      // List all keys (KV list returns up to 1000 per call; paginate if needed)
      const entries = []
      let cursor    = undefined
      do {
        const page = await env.EBA_ANALYTICS.list({ cursor, limit: 1000 })
        for (const key of page.keys) {
          const raw = await env.EBA_ANALYTICS.get(key.name)
          if (raw) {
            try { entries.push(JSON.parse(raw)) } catch { /* skip malformed */ }
          }
        }
        cursor = page.cursor
      } while (cursor)

      // ── Aggregation ──────────────────────────────────────────────────────────
      const queryMap    = {}   // query string → { count, tab, zeroResult }
      const pageClicks  = {}   // not tracked at log level yet — reserved for future click logging
      const zeroResults = {}

      for (const e of entries) {
        const q = e.query.toLowerCase()
        if (!queryMap[q]) queryMap[q] = { query: e.query, count: 0, tab: e.tab, zeroResultCount: 0 }
        queryMap[q].count++
        if (e.resultCount === 0) queryMap[q].zeroResultCount++
      }

      const allQueries = Object.values(queryMap)
        .sort((a, b) => b.count - a.count)

      const top20       = allQueries.slice(0, 20)
      const zeroResult  = allQueries
        .filter(q => q.zeroResultCount > 0)
        .sort((a, b) => b.zeroResultCount - a.zeroResultCount)
        .slice(0, 20)

      const totalEntries = entries.length
      const totalSearch  = entries.filter(e => e.tab === 'search').length
      const totalAsk     = entries.filter(e => e.tab === 'ask').length

      return new Response(JSON.stringify({
        meta: { totalEntries, totalSearch, totalAsk },
        top20,
        zeroResult,
      }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(origin) })
  }
}