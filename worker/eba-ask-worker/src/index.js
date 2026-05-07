/**
 * EBA Ask AI — Cloudflare Worker
 *
 * Flow:
 *  1. Receive POST { question } from the Search Modal
 *  2. Fetch the Pagefind search index manifest from GitHub Pages
 *  3. Search for relevant EBA content chunks via Pagefind's fragment files
 *  4. Build a grounded prompt from those chunks
 *  5. Call Gemini API — constrained to answer only from retrieved content
 *  6. Return { answer, sources } to the Search Modal
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dreadnaughtasaurous.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_CONTEXT_CHUNKS = 8;

export default {
  async fetch(request, env) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return jsonResponse(null, 204);
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Parse request body
    let question;
    try {
      const body = await request.json();
      question = (body.question || '').trim();
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400);
    }

    if (!question || question.length < 5) {
      return jsonResponse({ error: 'Question is too short' }, 400);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'AI service not configured — GEMINI_API_KEY secret is missing' }, 503);
    }

    const baseUrl = env.PAGEFIND_BASE_URL.replace(/\/$/, '');

    // ── Step 1: Fetch Pagefind entry manifest ─────────────────────────────────
    let manifest;
    try {
      const manifestRes = await fetch(`${baseUrl}/pagefind/pagefind-entry.json`, {
        headers: { 'User-Agent': 'EBA-Ask-Worker/1.0' },
      });
      if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status}`);
      manifest = await manifestRes.json();
    } catch (err) {
      return jsonResponse({ error: `Could not load search index: ${err.message}` }, 502);
    }

    // ── Step 2: Search Pagefind index for relevant pages ──────────────────────
    let chunks;
    try {
      chunks = await searchPagefind(baseUrl, manifest, question);
    } catch (err) {
      return jsonResponse({ error: `Search failed: ${err.message}` }, 502);
    }

    if (!chunks || chunks.length === 0) {
      return jsonResponse({
        answer: 'I could not find relevant content in the EBA wiki for that question. Try rephrasing with the specific EBA name (e.g. "Nurses and Midwives EBA") or use the Search tab to browse manually.',
        sources: [],
      });
    }

    // ── Step 3: Build grounded prompt ─────────────────────────────────────────
    const contextText = chunks
      .map((c, i) => `[${i + 1}] From "${c.title}" — ${c.url}\n${c.excerpt}`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are an expert HR advisor assistant for Austin Health, a Victorian public health service.
You answer questions about Enterprise Bargaining Agreements (EBAs) using ONLY the source excerpts provided below.

Rules you must follow:
- Base your answer ONLY on the excerpts. Never speculate or invent entitlements, clause numbers, or rates.
- Cite which excerpt(s) you used with [1], [2] etc. inline in your answer.
- Be specific: include exact rates, timeframes, and classifications if they appear in the sources.
- If the excerpts do not contain enough detail to answer confidently, say so clearly.
- Keep answers concise and practical — the reader is an HR administrator responding to an employee enquiry.
- If asked about a specific EBA, focus only on excerpts from that EBA.

SOURCE EXCERPTS:
${contextText}`;

    // ── Step 4: Call Gemini ───────────────────────────────────────────────────
    let aiAnswer;
    try {
      aiAnswer = await callGemini(question, systemPrompt, env.GEMINI_API_KEY);
    } catch (err) {
      return jsonResponse({ error: `Gemini API error: ${err.message}` }, 502);
    }

    // ── Step 5: Return answer + deduplicated source list ──────────────────────
    const seen = new Set();
    const sources = chunks
      .filter(c => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      })
      .map(c => ({ title: c.title, url: c.url }));

    return jsonResponse({ answer: aiAnswer, sources });
  },
};

// ─── Pagefind Search ──────────────────────────────────────────────────────────

/**
 * Searches the Pagefind index by fetching page metadata fragments directly.
 * Pagefind stores per-page data as individual compressed JSON files listed
 * in the entry manifest under the "pages" key.
 */
async function searchPagefind(baseUrl, manifest, question) {
  const terms = extractTerms(question);

  // Pagefind's manifest lists all pages with their URL hashes
  // Each page's full data lives at /pagefind/fragment/{hash}.pf_fragment
  const pageEntries = Object.entries(manifest.pages || {});

  if (pageEntries.length === 0) return [];

  // Fetch page metadata for all pages (titles + excerpt anchors)
  // We score pages by how many search terms appear in their title/url
  const scored = [];

  for (const [hash, meta] of pageEntries) {
    const title = (meta.title || '').toLowerCase();
    const url = (meta.url || '').toLowerCase();
    const filters = JSON.stringify(meta.filters || {}).toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 3;
      if (url.includes(term)) score += 2;
      if (filters.includes(term)) score += 1;
    }

    if (score > 0) {
      scored.push({ hash, meta, score });
    }
  }

  // Sort by score descending, take top candidates
  scored.sort((a, b) => b.score - a.score);
  const topPages = scored.slice(0, MAX_CONTEXT_CHUNKS);

  if (topPages.length === 0) return [];

  // Fetch the full fragment for each top page to get the excerpt content
  const results = await Promise.allSettled(
    topPages.map(({ hash, meta, score }) =>
      fetchFragment(baseUrl, hash, meta, score)
    )
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}

/**
 * Fetches a Pagefind page fragment file and extracts the best excerpt.
 */
async function fetchFragment(baseUrl, hash, meta, score) {
  const fragmentUrl = `${baseUrl}/pagefind/fragment/${hash}.pf_fragment`;

  try {
    const res = await fetch(fragmentUrl, {
      headers: { 'User-Agent': 'EBA-Ask-Worker/1.0' },
    });

    if (!res.ok) {
      // Fragment fetch failed — fall back to meta only
      return {
        title: meta.title || 'EBA Page',
        url: `${baseUrl}${meta.url}`,
        excerpt: `See: ${meta.title || meta.url}`,
        score,
      };
    }

    // Pagefind fragments are gzip-compressed JSON
    // Cloudflare Workers auto-decompress gzip responses
    const fragment = await res.json();

    // Extract the most relevant excerpt from the fragment's content
    const excerpt = extractBestExcerpt(fragment);

    return {
      title: meta.title || fragment.meta?.title || 'EBA Page',
      url: `${baseUrl}${meta.url}`,
      excerpt,
      score,
    };
  } catch {
    return {
      title: meta.title || 'EBA Page',
      url: `${baseUrl}${meta.url}`,
      excerpt: `See: ${meta.title || meta.url}`,
      score,
    };
  }
}

/**
 * Pulls the best text excerpt from a Pagefind fragment object.
 * Fragment structure: { content: string, word_count: number, anchors: [...] }
 */
function extractBestExcerpt(fragment) {
  // Use the main content field if present
  if (fragment.content && fragment.content.length > 20) {
    // Return up to ~600 characters of content
    return fragment.content.slice(0, 600).trim();
  }

  // Fall back to first anchor text
  if (fragment.anchors && fragment.anchors.length > 0) {
    const first = fragment.anchors[0];
    return (first.text || first.id || '').slice(0, 600).trim();
  }

  return '';
}

/**
 * Extracts meaningful search terms from the question.
 * Removes common stop words and short tokens.
 */
function extractTerms(question) {
  const stopWords = new Set([
    'is', 'a', 'an', 'the', 'to', 'of', 'in', 'for', 'on', 'at', 'by',
    'am', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'do', 'does',
    'will', 'would', 'could', 'should', 'may', 'what', 'how', 'when',
    'where', 'which', 'who', 'that', 'this', 'my', 'their', 'under',
    'with', 'after', 'before', 'and', 'or', 'not', 'i', 'me', 'we',
    'entitled', 'required', 'employee', 'employees', 'do',
  ]);

  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 8);
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

async function callGemini(question, systemPrompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: question }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      topP: 0.8,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_NONE' },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Gemini returned an empty response');

  return text;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return new Response(
    body === null ? null : JSON.stringify(body),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        ...(body !== null && { 'Content-Type': 'application/json' }),
      },
    }
  );
}