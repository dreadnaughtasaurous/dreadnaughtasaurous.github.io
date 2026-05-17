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
// =============================================================================

const TTL_90_DAYS = 7_776_000

const CORS_ORIGINS = [
  'https://dreadnaughtasaurous.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

// -----------------------------------------------------------------------------
// ULID — lightweight unique ID generator (no dependencies)
// Used to generate unique KV keys for each event.
// Format: timestamp prefix (10 chars) + random suffix (16 chars) = 26 chars
// Lexicographically sortable by time, which lets us list KV keys in order.
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
// Extracts browser name and device type from the raw UA string.
// The raw UA string is NEVER stored — only the two derived values below.
// Returns: { browser: string, device: 'mobile'|'tablet'|'desktop' }
// -----------------------------------------------------------------------------
function parseUA(ua) {
  if (!ua) return { browser: 'Unknown', device: 'desktop' }

  // Device type — order matters: tablet check before mobile
  let device = 'desktop'
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'tablet'
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'mobile'
  }

  // Browser name — order matters: Edge before Chrome, Chrome before Safari
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
// Keeps internal wiki paths (e.g. /ebas/allied-health/allowances/33-foo)
// Collapses all external referrers to the string "external"
// Never stores full external URLs
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
      // Return path only — strip query strings and hashes
      return url.pathname
    }
    return 'external'
  } catch {
    // If URL parsing fails, treat as internal relative path
    return ref.startsWith('/') ? ref : 'external'
  }
}

// -----------------------------------------------------------------------------
// Date helpers — all dates in YYYY-MM-DD (UTC) for KV key bucketing
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
// Validates Bearer token against the ADMIN_TOKEN Worker secret
// -----------------------------------------------------------------------------
function isAuthorised(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  return token === env.ADMIN_TOKEN
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

// -----------------------------------------------------------------------------
// POST /log — existing search / Ask AI event logger (backward-compatible)
// Payload: { tab, query, eba, topic, resultCount }
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

  await env.EBA_ANALYTICS.put(key, JSON.stringify(entry), { expirationTtl: TTL_90_DAYS })
  return jsonResponse({ ok: true }, 200, origin)
}

// -----------------------------------------------------------------------------
// POST /log/pageview — new page view event logger
// Payload: { path, eba, section, title, sessionId, referrer }
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
    path: path.slice(0, 300),
    eba,
    section,
    title: title.slice(0, 200),
    sessionId,
    referrer: normaliseReferrer(referrer),
    browser,
    device,
    timestamp: new Date().toISOString(),
  }

  await env.EBA_PAGEVIEWS.put(key, JSON.stringify(entry), { expirationTtl: TTL_90_DAYS })
  return jsonResponse({ ok: true }, 200, origin)
}

// -----------------------------------------------------------------------------
// POST /log/session — session upsert
// Payload: { sessionId, pageCount, started, lastSeen }
// Creates a new session record or overwrites the existing one for this sessionId.
// The client sends this on every page navigation with its current page count.
// -----------------------------------------------------------------------------
async function handleLogSession(request, env, origin) {
  let body
  try { body = await request.json() } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin) }

  const { sessionId = '', pageCount = 1, started = '', lastSeen = '' } = body
  if (!sessionId) return jsonResponse({ error: 'sessionId required' }, 400, origin)

  const ua = request.headers.get('User-Agent') || ''
  const { browser, device } = parseUA(ua)

  // Key is the sessionId itself so upserts overwrite the same record
  const key = `sess:${sessionId}`

  const entry = {
    sessionId,
    pageCount: Number(pageCount),
    started,
    lastSeen,
    browser,
    device,
  }

  // Sessions expire 90 days after the last write
  await env.EBA_SESSIONS.put(key, JSON.stringify(entry), { expirationTtl: TTL_90_DAYS })
  return jsonResponse({ ok: true }, 200, origin)
}

// -----------------------------------------------------------------------------
// GET /analytics — aggregated dashboard data (requires Bearer token)
// Returns a single JSON object consumed by AnalyticsDashboard.vue
// -----------------------------------------------------------------------------
async function handleGetAnalytics(request, env, origin) {
  if (!isAuthorised(request, env)) {
    return jsonResponse({ error: 'Unauthorised' }, 401, origin)
  }

  // ── Fetch all keys from each namespace ──────────────────────────────────────
  // KV list() returns up to 1000 keys per call. For our scale (7-15 users,
  // 90-day window) this will never exceed one page. If it ever does,
  // the dashboard will silently show the most recent 1000 entries per namespace.

  const [searchList, pageviewList, sessionList] = await Promise.all([
    env.EBA_ANALYTICS.list(),
    env.EBA_PAGEVIEWS.list(),
    env.EBA_SESSIONS.list(),
  ])

  // ── Fetch all values in parallel ────────────────────────────────────────────
  const [searchEntries, pageviewEntries, sessionEntries] = await Promise.all([
    Promise.all(searchList.keys.map(k => env.EBA_ANALYTICS.get(k.name, 'json'))),
    Promise.all(pageviewList.keys.map(k => env.EBA_PAGEVIEWS.get(k.name, 'json'))),
    Promise.all(sessionList.keys.map(k => env.EBA_SESSIONS.get(k.name, 'json'))),
  ])

  // Filter nulls (keys that expired between list and get)
  const searches  = searchEntries.filter(Boolean)
  const pageviews = pageviewEntries.filter(Boolean)
  const sessions  = sessionEntries.filter(Boolean)

  // ── Meta KPIs ────────────────────────────────────────────────────────────────
  const totalSearch   = searches.filter(e => e.tab === 'search').length
  const totalAsk      = searches.filter(e => e.tab === 'ask').length
  const totalPageviews = pageviews.length
  const uniqueSessions = sessions.length
  const avgPagesPerSession = uniqueSessions > 0
    ? (sessions.reduce((sum, s) => sum + (s.pageCount || 1), 0) / uniqueSessions).toFixed(1)
    : '0'

  const meta = {
    totalEntries: searches.length,
    totalSearch,
    totalAsk,
    totalPageviews,
    uniqueSessions,
    avgPagesPerSession: Number(avgPagesPerSession),
  }

  // ── Top 20 search queries ────────────────────────────────────────────────────
  const queryMap = {}
  for (const e of searches) {
    const k = `${e.tab}||${e.query.toLowerCase()}`
    if (!queryMap[k]) queryMap[k] = { query: e.query, tab: e.tab, count: 0, zeroResultCount: 0 }
    queryMap[k].count++
    if (e.resultCount === 0) queryMap[k].zeroResultCount++
  }
  const top20 = Object.values(queryMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // ── Zero-result queries ──────────────────────────────────────────────────────
  const zeroResult = Object.values(queryMap)
    .filter(q => q.zeroResultCount > 0)
    .sort((a, b) => b.zeroResultCount - a.zeroResultCount)
    .slice(0, 20)

  // ── Time series — searches + pageviews per day, last 30 days ────────────────
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
    searches: searchByDay[day],
    pageviews: pageviewByDay[day],
  }))

  // ── Top 20 pages ─────────────────────────────────────────────────────────────
  const pageMap = {}
  for (const e of pageviews) {
    const k = e.path
    if (!pageMap[k]) pageMap[k] = { path: e.path, eba: e.eba, section: e.section, title: e.title, count: 0 }
    pageMap[k].count++
  }
  const topPages = Object.values(pageMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // ── EBA breakdown by page views ──────────────────────────────────────────────
  const ebaMap = {}
  for (const e of pageviews) {
    if (!e.eba) continue
    ebaMap[e.eba] = (ebaMap[e.eba] || 0) + 1
  }
  const ebaBreakdown = Object.entries(ebaMap)
    .map(([eba, count]) => ({ eba, count }))
    .sort((a, b) => b.count - a.count)

  // ── Section breakdown by page views ─────────────────────────────────────────
  const sectionMap = {}
  for (const e of pageviews) {
    if (!e.section) continue
    sectionMap[e.section] = (sectionMap[e.section] || 0) + 1
  }
  const sectionBreakdown = Object.entries(sectionMap)
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count)

  // ── Browser breakdown ────────────────────────────────────────────────────────
  // Combines browser data across all three event types for a full picture
  const browserMap = {}
  for (const e of [...searches, ...pageviews]) {
    if (!e.browser) continue
    browserMap[e.browser] = (browserMap[e.browser] || 0) + 1
  }
  const browserBreakdown = Object.entries(browserMap)
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count)

  // ── Device breakdown ─────────────────────────────────────────────────────────
  const deviceMap = {}
  for (const e of [...searches, ...pageviews]) {
    if (!e.device) continue
    deviceMap[e.device] = (deviceMap[e.device] || 0) + 1
  }
  const deviceBreakdown = Object.entries(deviceMap)
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count)

  // ── EBA filter usage (from search events) ───────────────────────────────────
  const ebaFilterMap = {}
  for (const e of searches) {
    if (!e.eba) continue
    ebaFilterMap[e.eba] = (ebaFilterMap[e.eba] || 0) + 1
  }
  const ebaFilterBreakdown = Object.entries(ebaFilterMap)
    .map(([eba, count]) => ({ eba, count }))
    .sort((a, b) => b.count - a.count)

  // ── Topic filter usage (from search events) ──────────────────────────────────
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
}

// =============================================================================
// MAIN FETCH HANDLER
// =============================================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const url    = new URL(request.url)
    const method = request.method.toUpperCase()

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // Route dispatch
    if (method === 'POST' && url.pathname === '/log') {
      return handleLogSearch(request, env, origin)
    }
    if (method === 'POST' && url.pathname === '/log/pageview') {
      return handleLogPageview(request, env, origin)
    }
    if (method === 'POST' && url.pathname === '/log/session') {
      return handleLogSession(request, env, origin)
    }
    if (method === 'GET' && url.pathname === '/analytics') {
      return handleGetAnalytics(request, env, origin)
    }

    return jsonResponse({ error: 'Not found' }, 404, origin)
  },
}