// =============================================================================
// EBA Analytics Worker v2
// =============================================================================
// Routes:
//   POST /log              — search / Ask AI event (existing, backward-compat)
//   POST /log/pageview     — page view event (new)
//   POST /log/session      — session upsert (new)
//   GET  /analytics        — aggregated dashboard data (admin-only, Bearer token)
//
// KV Namespaces:
//   EBA_ANALYTICS  — search + Ask AI events
//   EBA_PAGEVIEWS  — page view events
//   EBA_SESSIONS   — session records
//
// Privacy model:
//   - No IP addresses stored
//   - No country/region stored
//   - User-Agent parsed to { browser, device } only; raw UA discarded
//   - Session IDs are client-generated random ULIDs (not cookies)
//   - Referrers normalised: internal path stored as-is; external → "external"
//   - All KV writes use expirationTtl of 90 days (7,776,000 seconds)
//
// Subrequest strategy:
//   Event data is stored as KV *metadata* as well as the value body.
//   handleGetAnalytics reads metadata from list() only — zero get() calls.
//   This keeps subrequests at 3 per invocation (one list per namespace)
//   regardless of how many entries exist, avoiding the 1000-subrequest cap.
// =============================================================================

const TTL_90_DAYS = 7_776_000

const CORS_ORIGINS = [
  'https://dreadnaughtasaurous.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

// -----------------------------------------------------------------------------
// ULID — lightweight unique ID generator (no dependencies)
// -----------------------------------------------------------------------------
function ulid() {
  const CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const t = Date.now()
  let id = ''
  let time = t
  for (let i = 9; i >= 0; i--) {
    id = CHARS[time % 32] + id
    time = Math.floor(time / 32)
  }
  for (let i = 0; i < 16; i++) {
    id += CHARS[Math.floor(Math.random() * 32)]
  }
  return id
}

// -----------------------------------------------------------------------------
// User-Agent parser
// -----------------------------------------------------------------------------
function parseUA(ua) {
  if (!ua) return { browser: 'Unknown', device: 'desktop' }

  let device = 'desktop'
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'tablet'
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'mobile'
  }

  let browser = 'Other'
  if (/edg\//i.test(ua))            browser = 'Edge'
  else if (/opr\//i.test(ua))       browser = 'Opera'
  else if (/firefox\//i.test(ua))   browser = 'Firefox'
  else if (/chrome\//i.test(ua))    browser = 'Chrome'
  else if (/safari\//i.test(ua))    browser = 'Safari'
  else if (/msie|trident/i.test(ua)) browser = 'IE'

  return { browser, device }
}

// -----------------------------------------------------------------------------
// Referrer normaliser
// -----------------------------------------------------------------------------
function normaliseReferrer(ref) {
  if (!ref) return ''
  try {
    const url = new URL(ref)
    const internalHosts = [
      'dreadnaughtasaurous.github.io',
      'localhost',
    ]
    if (internalHosts.some(h => url.hostname.includes(h))) {
      return url.pathname
    }
    return 'external'
  } catch {
    return ref.startsWith('/') ? ref : 'external'
  }
}

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------
function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

// -----------------------------------------------------------------------------
// CORS helpers
// -----------------------------------------------------------------------------
function corsHeaders(origin) {
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  })
}

// -----------------------------------------------------------------------------
// Auth check for GET /analytics
// -----------------------------------------------------------------------------
function isAuthorised(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  return token === env.ADMIN_TOKEN
}

// -----------------------------------------------------------------------------
// ← NEW: listAllMetadata — reads all entries from a KV namespace using only
// list() calls (no get() calls). Each page costs 1 subrequest; a namespace
// with 5000 entries uses 5 subrequests instead of 5000.
// Only entries written after this deploy will have metadata; older entries
// are silently skipped (their metadata field will be null).
// -----------------------------------------------------------------------------
async function listAllMetadata(namespace) {
  const items = []
  let cursor
  do {
    const opts = { limit: 1000 }
    if (cursor) opts.cursor = cursor
    const result = await namespace.list(opts)
    for (const key of result.keys) {
      if (key.metadata) items.push(key.metadata)
    }
    cursor = result.list_complete ? undefined : result.cursor
  } while (cursor)
  return items
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

// -----------------------------------------------------------------------------
// POST /log — search / Ask AI event logger
// ← CHANGED: put() now includes metadata so handleGetAnalytics can use
//   listAllMetadata() instead of individual get() calls.
// -----------------------------------------------------------------------------
async function handleLogSearch(request, env, origin) {
  let body
  try { body = await request.json() } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin) }

  const { tab = '', query = '', eba = '', topic = '', resultCount = 0 } = body
  if (!query) return jsonResponse({ error: 'query required' }, 400, origin)

  const ua = request.headers.get('User-Agent') || ''
  const { browser, device } = parseUA(ua)
  const date = todayUTC()
  const key = `search:${date}:${ulid()}`

  const entry = {
    tab,
    query: query.slice(0, 200),
    eba,
    topic,
    resultCount: Number(resultCount),
    browser,
    device,
    timestamp: new Date().toISOString(),
  }

  // ← CHANGED: metadata added — keeps payload under 1024-byte KV metadata limit
  await env.EBA_ANALYTICS.put(key, JSON.stringify(entry), {
    expirationTtl: TTL_90_DAYS,
    metadata: {
      tab:         entry.tab,
      query:       entry.query.slice(0, 200),
      eba:         entry.eba,
      topic:       entry.topic,
      resultCount: entry.resultCount,
      browser:     entry.browser,
      device:      entry.device,
      timestamp:   entry.timestamp,
    },
  })
  return jsonResponse({ ok: true }, 200, origin)
}

// -----------------------------------------------------------------------------
// POST /log/pageview — page view event logger
// ← CHANGED: put() now includes metadata
// -----------------------------------------------------------------------------
async function handleLogPageview(request, env, origin) {
  let body
  try { body = await request.json() } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin) }

  const { path = '', eba = '', section = '', title = '', sessionId = '', referrer = '' } = body
  if (!path) return jsonResponse({ error: 'path required' }, 400, origin)

  const ua = request.headers.get('User-Agent') || ''
  const { browser, device } = parseUA(ua)
  const date = todayUTC()
  const key = `pv:${date}:${ulid()}`

  const entry = {
    path:      path.slice(0, 300),
    eba,
    section,
    title:     title.slice(0, 200),
    sessionId,
    referrer:  normaliseReferrer(referrer),
    browser,
    device,
    timestamp: new Date().toISOString(),
  }

  // ← CHANGED: metadata added — path/title capped shorter to stay under 1024 bytes
  await env.EBA_PAGEVIEWS.put(key, JSON.stringify(entry), {
    expirationTtl: TTL_90_DAYS,
    metadata: {
      path:      entry.path.slice(0, 150),
      eba:       entry.eba,
      section:   entry.section.slice(0, 80),
      title:     entry.title.slice(0, 150),
      sessionId: entry.sessionId,
      referrer:  entry.referrer,
      browser:   entry.browser,
      device:    entry.device,
      timestamp: entry.timestamp,
    },
  })
  return jsonResponse({ ok: true }, 200, origin)
}

// -----------------------------------------------------------------------------
// POST /log/session — session upsert
// ← CHANGED: put() now includes metadata
// -----------------------------------------------------------------------------
async function handleLogSession(request, env, origin) {
  let body
  try { body = await request.json() } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin) }

  const { sessionId = '', pageCount = 1, started = '', lastSeen = '' } = body
  if (!sessionId) return jsonResponse({ error: 'sessionId required' }, 400, origin)

  const ua = request.headers.get('User-Agent') || ''
  const { browser, device } = parseUA(ua)
  const key = `sess:${sessionId}`

  const entry = {
    sessionId,
    pageCount: Number(pageCount),
    started,
    lastSeen,
    browser,
    device,
  }

  // ← CHANGED: metadata added
  await env.EBA_SESSIONS.put(key, JSON.stringify(entry), {
    expirationTtl: TTL_90_DAYS,
    metadata: {
      sessionId: entry.sessionId,
      pageCount: entry.pageCount,
      started:   entry.started,
      lastSeen:  entry.lastSeen,
      browser:   entry.browser,
      device:    entry.device,
    },
  })
  return jsonResponse({ ok: true }, 200, origin)
}

// -----------------------------------------------------------------------------
// GET /analytics — aggregated dashboard data (requires Bearer token)
// ← CHANGED: uses listAllMetadata() — zero get() calls, subrequests = 3
// -----------------------------------------------------------------------------
async function handleGetAnalytics(request, env, origin) {
  if (!isAuthorised(request, env)) {
    return jsonResponse({ error: 'Unauthorised' }, 401, origin)
  }

  try {
    // ← CHANGED: listAllMetadata replaces list() + Promise.all(get())
    // Subrequest cost: 1 per 1000 entries per namespace (typically 1 each = 3 total)
    const [searches, pageviews, sessions] = await Promise.all([
      listAllMetadata(env.EBA_ANALYTICS),
      listAllMetadata(env.EBA_PAGEVIEWS),
      listAllMetadata(env.EBA_SESSIONS),
    ])

    // ── Meta KPIs ──────────────────────────────────────────────────────────────
    const totalSearch       = searches.filter(e => e.tab === 'search').length
    const totalAsk          = searches.filter(e => e.tab === 'ask').length
    const totalSearchErrors = searches.filter(e => e.tab === 'search_error').length
    const totalPageviews    = pageviews.length
    const uniqueSessions    = sessions.length
    const avgPagesPerSession = uniqueSessions > 0
      ? (sessions.reduce((sum, s) => sum + (s.pageCount || 1), 0) / uniqueSessions).toFixed(1)
      : '0'

    const meta = {
      totalEntries: searches.length,
      totalSearch,
      totalAsk,
      totalSearchErrors,
      totalPageviews,
      uniqueSessions,
      avgPagesPerSession: Number(avgPagesPerSession),
    }

    // ── Top 20 search queries ──────────────────────────────────────────────────
    const queryMap = {}
    for (const e of searches) {
      if (e.tab === 'search_error') continue
      const k = `${e.tab}||${e.query.toLowerCase()}`
      if (!queryMap[k]) queryMap[k] = { query: e.query, tab: e.tab, count: 0, zeroResultCount: 0 }
      queryMap[k].count++
      if (e.resultCount === 0) queryMap[k].zeroResultCount++
    }
    const top20 = Object.values(queryMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // ── Zero-result queries ────────────────────────────────────────────────────
    const zeroResult = Object.values(queryMap)
      .filter(q => q.zeroResultCount > 0)
      .sort((a, b) => b.zeroResultCount - a.zeroResultCount)
      .slice(0, 20)

    // ── Time series — searches + pageviews per day, last 30 days ──────────────
    const last30 = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      last30.push(d.toISOString().slice(0, 10))
    }

    const searchByDay   = {}
    const pageviewByDay = {}
    last30.forEach(d => { searchByDay[d] = 0; pageviewByDay[d] = 0 })

    for (const e of searches) {
      const day = (e.timestamp || '').slice(0, 10)
      if (searchByDay[day] !== undefined) searchByDay[day]++
    }
    for (const e of pageviews) {
      const day = (e.timestamp || '').slice(0, 10)
      if (pageviewByDay[day] !== undefined) pageviewByDay[day]++
    }

    const timeSeries = last30.map(day => ({
      day,
      searches:  searchByDay[day],
      pageviews: pageviewByDay[day],
    }))

    // ── Top 20 pages ───────────────────────────────────────────────────────────
    const pageMap = {}
    for (const e of pageviews) {
      const k = e.path
      if (!pageMap[k]) pageMap[k] = { path: e.path, eba: e.eba, section: e.section, title: e.title, count: 0 }
      pageMap[k].count++
    }
    const topPages = Object.values(pageMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // ── EBA breakdown by page views ────────────────────────────────────────────
    const ebaMap = {}
    for (const e of pageviews) {
      if (!e.eba) continue
      ebaMap[e.eba] = (ebaMap[e.eba] || 0) + 1
    }
    const ebaBreakdown = Object.entries(ebaMap)
      .map(([eba, count]) => ({ eba, count }))
      .sort((a, b) => b.count - a.count)

    // ── Section breakdown by page views ───────────────────────────────────────
    const sectionMap = {}
    for (const e of pageviews) {
      if (!e.section) continue
      sectionMap[e.section] = (sectionMap[e.section] || 0) + 1
    }
    const sectionBreakdown = Object.entries(sectionMap)
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count)

    // ── Browser breakdown ──────────────────────────────────────────────────────
    const browserMap = {}
    for (const e of [...searches, ...pageviews]) {
      if (!e.browser) continue
      browserMap[e.browser] = (browserMap[e.browser] || 0) + 1
    }
    const browserBreakdown = Object.entries(browserMap)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)

    // ── Device breakdown ───────────────────────────────────────────────────────
    const deviceMap = {}
    for (const e of [...searches, ...pageviews]) {
      if (!e.device) continue
      deviceMap[e.device] = (deviceMap[e.device] || 0) + 1
    }
    const deviceBreakdown = Object.entries(deviceMap)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count)

    // ── EBA filter usage ───────────────────────────────────────────────────────
    const ebaFilterMap = {}
    for (const e of searches) {
      if (!e.eba) continue
      ebaFilterMap[e.eba] = (ebaFilterMap[e.eba] || 0) + 1
    }
    const ebaFilterBreakdown = Object.entries(ebaFilterMap)
      .map(([eba, count]) => ({ eba, count }))
      .sort((a, b) => b.count - a.count)

    // ── Topic filter usage ─────────────────────────────────────────────────────
    const topicMap = {}
    for (const e of searches) {
      if (!e.topic) continue
      topicMap[e.topic] = (topicMap[e.topic] || 0) + 1
    }
    const topicBreakdown = Object.entries(topicMap)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)

    return jsonResponse({
      meta,
      top20,
      zeroResult,
      timeSeries,
      topPages,
      ebaBreakdown,
      sectionBreakdown,
      browserBreakdown,
      deviceBreakdown,
      ebaFilterBreakdown,
      topicBreakdown,
    }, 200, origin)

  } catch (err) {
    return jsonResponse({ error: `Analytics error: ${err.message}` }, 500, origin)
  }
}

// -----------------------------------------------------------------------------
// GET /top-pages — public, no auth required
// ← CHANGED: uses listAllMetadata() — zero get() calls
// -----------------------------------------------------------------------------
async function handleGetTopPages(request, env, origin) {
  try {
    const allPageviews = await listAllMetadata(env.EBA_PAGEVIEWS)

    const pageMap = {}
    for (const entry of allPageviews) {
      if (!entry || !entry.path) continue
      if (!entry.path.startsWith('/ebas/')) continue
      const k = entry.path
      if (!pageMap[k]) {
        pageMap[k] = { path: entry.path, title: entry.title || '', eba: entry.eba || '', count: 0 }
      }
      pageMap[k].count++
      if (entry.title) pageMap[k].title = entry.title.replace(/\s*\|.*$/, '').trim()
    }

    const top5 = Object.values(pageMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    return new Response(JSON.stringify(top5), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, origin)
  }
}

// -----------------------------------------------------------------------------
// GET /trending-topics — public, no auth required
// ← CHANGED: uses listAllMetadata() — zero get() calls
// -----------------------------------------------------------------------------
async function handleGetTrendingTopics(request, env, origin) {
  try {
    const allSearches = await listAllMetadata(env.EBA_ANALYTICS)

    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - 7)
    const cutoffISO = cutoff.toISOString()

    const topicMap = {}
    for (const entry of allSearches) {
      if (!entry || !entry.topic) continue
      if (entry.tab === 'search_error') continue
      if (entry.timestamp && entry.timestamp < cutoffISO) continue
      const t = entry.topic.trim()
      if (!t) continue
      topicMap[t] = (topicMap[t] || 0) + 1
    }

    const top3 = Object.entries(topicMap)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    return new Response(JSON.stringify(top3), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, origin)
  }
}

// -----------------------------------------------------------------------------
// GET /trending — public, no auth required
// This handler uses date-scoped KV key prefixes and already handles pagination,
// so it keeps its existing list()+get() pattern but batches gets in 50s.
// It is NOT converted to the metadata pattern because it already correctly
// limits its key set to a bounded date window.
// -----------------------------------------------------------------------------
async function handleGetTrending(request, env, origin) {
  try {
    const url   = new URL(request.url)
    const days  = Math.min(parseInt(url.searchParams.get('days')  || '7',  10), 30)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 50)

    const prefixes = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      prefixes.push('pv:' + d.toISOString().slice(0, 10) + ':')
    }

    const allKeys = []
    for (const prefix of prefixes) {
      let cursor = undefined
      do {
        const opts = { prefix, limit: 1000 }
        if (cursor) opts.cursor = cursor
        const result = await env.EBA_PAGEVIEWS.list(opts)
        allKeys.push(...result.keys.map(k => k.name))
        cursor = result.list_complete ? undefined : result.cursor
      } while (cursor)
    }

    const pathCounts = {}
    const pathMeta   = {}
    const BATCH      = 50

    for (let i = 0; i < allKeys.length; i += BATCH) {
      const batch  = allKeys.slice(i, i + BATCH)
      const values = await Promise.all(
        batch.map(k => env.EBA_PAGEVIEWS.get(k, { type: 'json' }).catch(() => null))
      )
      for (const v of values) {
        if (!v || !v.path) continue
        const parts = v.path.split('/').filter(Boolean)
        if (parts[0] !== 'ebas' || parts.length < 3) continue

        pathCounts[v.path] = (pathCounts[v.path] || 0) + 1
        if (!pathMeta[v.path]) {
          pathMeta[v.path] = {
            title: (v.title || '').replace(/\s*\|.*$/, '').trim(),
            eba:   v.eba || '',
          }
        }
      }
    }

    const trending = Object.entries(pathCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, count]) => ({
        path,
        count,
        title: pathMeta[path]?.title || '',
        eba:   pathMeta[path]?.eba   || '',
      }))

    return new Response(JSON.stringify({
      trending,
      days,
      generatedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(origin),
      },
    })

  } catch (err) {
    return jsonResponse({ error: err.message }, 500, origin)
  }
}

// =============================================================================
// MAIN FETCH HANDLER
// =============================================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const url    = new URL(request.url)
    const method = request.method.toUpperCase()

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (method === 'POST' && url.pathname === '/log')           return handleLogSearch(request, env, origin)
    if (method === 'POST' && url.pathname === '/log/pageview')  return handleLogPageview(request, env, origin)
    if (method === 'POST' && url.pathname === '/log/session')   return handleLogSession(request, env, origin)
    if (method === 'GET'  && url.pathname === '/top-pages')     return handleGetTopPages(request, env, origin)
    if (method === 'GET'  && url.pathname === '/trending-topics') return handleGetTrendingTopics(request, env, origin)
    if (method === 'GET'  && url.pathname === '/trending')      return handleGetTrending(request, env, origin)
    if (method === 'GET'  && url.pathname === '/analytics')     return handleGetAnalytics(request, env, origin)

    return jsonResponse({ error: 'Not found' }, 404, origin)
  },
}