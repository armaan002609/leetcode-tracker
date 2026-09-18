# Security Specifications
## LeetCode Scraper & Student Tracker

**Document Owner:** Security Architecture
**Status:** Draft v1.0
**Scope:** Data privacy, scraping defense, input validation, Vercel deployment hardening

---

## 1. Data Privacy Guidelines

### 1.1 Data Classification
Student Roll Numbers and Names are treated as **institutional PII** — not sensitive in the same category as financial/health data, but still personally identifiable and subject to responsible handling, since a Roll Number can typically be reverse-mapped to a real identity within the institution.

| Data Element | Classification | Handling Rule |
|---|---|---|
| Roll Number | PII (institutional identifier) | Never logged in plaintext server logs; never sent to third-party analytics. |
| Name | PII | Same as above. |
| Mentor Name | Low-sensitivity internal data | Standard handling; not restricted. |
| LeetCode Profile URL | Public data (by definition — the user supplies a *public* profile) | Low risk, but still handled with the batch as a unit rather than exposed individually in URLs/query strings. |
| Scraped metrics (rank, badges, solved count) | Public data | No special handling beyond standard transport security. |

### 1.2 Core Privacy Principles
1. **Persistent Storage Added by User Request** — As per the requested architectural shift, the application now stores student data (Roll Number, Name, URLs, and stats) persistently in a database (SQLite locally, adaptable to Postgres/etc. in production) to allow for daily automated tracking.
2. **No third-party egress of student PII** — Roll Numbers and Names must never be transmitted to the LeetCode scrape target (only the profile URL is needed for scraping), and must never be sent to any analytics, logging-as-a-service, or error-tracking provider (e.g., Sentry) in identifiable form. Scrub or omit these fields before any external log/error report leaves the application boundary.
3. **Database Security** — Since the application is now stateful, ensure database access is properly secured. If using a cloud database (like Supabase, Neon, or Vercel Postgres), environment variables containing DB credentials must never be exposed to the client bundle.
4. **Automated Daily Refresh** — A cron job hits a secured `/api/cron/daily-refresh` endpoint to automatically update statistics for all students at 11:59 PM daily. This endpoint MUST be secured with a `CRON_SECRET` environment variable in production to prevent unauthorized bulk scraping triggers.
6. **User-controlled data lifecycle** — the export (CSV download) is the point at which the user takes ownership of the data; the application itself should not become a second, hidden copy of the student roster.
7. **Consent & institutional policy** — because student data (even just names/roll numbers) may fall under institutional data-handling policies (e.g., FERPA-adjacent norms in academic contexts), the PRD/onboarding should include a short notice that the operator (mentor) is responsible for complying with their institution's data policy when using the tool — this is an operator-facing responsibility disclosure, not a technical control, but should be documented.

### 1.3 Logging Policy
- Application logs (e.g., Vercel function logs) must **never** contain raw Roll Number or Name values.
- When logging a scrape failure for debugging, log a hashed or truncated reference (e.g., `row_hash: sha256(...).slice(0,8)`) instead of the student's identity.
- LeetCode usernames extracted from the profile URL are semi-public (the student chose them) but should still be treated conservatively — avoid bulk-logging full lists of usernames together with Roll Numbers, since that combination is a re-identification risk if logs ever leak.

---

## 2. Threat Model Summary

| Threat | Vector | Mitigation Summary |
|---|---|---|
| Scraper triggers IP ban, breaking the tool for all users of the deployment | Aggressive/parallel scraping | Rate limiting, concurrency caps, backoff, header hygiene (§3) |
| Malicious CSV/XLSX upload used to attack the app or downstream tools | CSV/Excel formula injection, zip-bomb XLSX, oversized files | Strict input validation & sanitization (§4) |
| Student PII exposure | Logging, error tracking, third-party requests | Data minimization & logging policy (§1) |
| Server-Side Request Forgery (SSRF) via crafted "LeetCode URL" | User supplies a URL pointing at internal infrastructure instead of leetcode.com | URL allowlisting (§4.4) |
| Credential/secret leakage | Hardcoded scraping headers, API keys, or environment misconfiguration | Vercel environment variable hygiene (§5) |
| Denial of service against the app itself | Extremely large uploads, repeated large batch submissions | Size/row limits, per-IP request throttling (§4.1, §5.3) |

---

## 3. Defensive Scraping Strategy

Scraping a public profile page for personal tracking purposes is a common and generally low-risk practice, but it must be done carefully to remain a good network citizen and to keep the tool functional over time. This section defines the defensive posture; it does not endorse circumventing LeetCode's Terms of Service, and the product's onboarding/README should note that operators are responsible for using this tool in accordance with LeetCode's terms.

### 3.1 Rate Limiting
- **Global concurrency cap:** No more than N concurrent outbound requests to LeetCode at any time (recommend starting conservative, e.g., 2–3 concurrent requests), regardless of batch size.
- **Per-request pacing:** Enforce a minimum delay between requests (e.g., 500ms–1.5s, with jitter) rather than firing requests back-to-back — jitter (randomized delay) avoids creating a detectable, perfectly periodic request pattern.
- **Batch-level throttle, not just per-row:** The scraping queue for an entire job should be paced as a whole, so a 500-row upload doesn't attempt 500 near-simultaneous requests even if row-level code is technically "rate limited" in isolation.

### 3.2 Reducing Detectability / Being a Good Citizen
- **Realistic, honest headers:** Send a standard browser-like `User-Agent`, but do not fabricate misleading identity claims. The goal is to avoid looking like a broken/malformed bot request, not to impersonate a specific real user's browser fingerprint.
- **No credential use:** The scraper must only ever access public, unauthenticated profile pages. It must never attempt to log in, use stolen/shared session cookies, or bypass authentication walls to reach private data.
- **Respect robots.txt / documented API surfaces:** Before implementation, check whether LeetCode exposes a public GraphQL/API endpoint intended for this kind of read (many competitive-programming trackers use LeetCode's public GraphQL endpoint rather than HTML scraping) — preferring a documented, intended data-access path over HTML scraping is both more robust to markup changes and generally a lower-friction approach than scraping rendered HTML.
- **Caching within a run:** If the same profile URL appears twice in one upload (accidental duplicate), fetch it once and reuse the result rather than hitting the target twice.
- **Backoff on 429/anti-bot responses:** On receiving a rate-limit or bot-challenge response, the *entire batch* should pause and back off exponentially (not just retry that one row), since a 429 is a signal about the shared IP, not just that one request.
- **Circuit breaker:** If a threshold of consecutive requests fail with rate-limit/blocking signals, halt the remainder of the batch, mark remaining rows as `not_attempted`, and surface a clear message to the user rather than continuing to hammer a target that's actively blocking the deployment.

### 3.3 Serverless Timeout Management
Vercel Functions have platform duration ceilings that scraping logic must respect (verify exact current limits against Vercel's published documentation at deploy time, since these can change by plan):
- On the **Hobby** plan, function duration defaults/maximums are on the order of a few minutes (historically 10s without Fluid Compute; up to 300s with Fluid Compute enabled).
- On the **Pro** plan, functions can be configured for longer durations (up to several minutes, e.g., up to ~800s with Fluid Compute).

Because a large batch, rate-limited to a few requests per second, can easily exceed even a generous single-invocation ceiling, the architecture must **chunk the work**:
- **Chunked processing:** Split the roster into small batches (e.g., 10–20 rows per serverless invocation) and process chunks via sequential client-triggered calls, or a queue/worker pattern, rather than one function attempting the entire roster serially.
- **Idempotent, resumable jobs:** Each chunk's results are returned/persisted (ephemerally, per §1.2) before the next chunk starts, so a timeout on chunk 8 doesn't lose the results of chunks 1–7.
- **Client-driven orchestration (recommended for v1 simplicity):** The browser can drive the chunk loop — request chunk 1, display results, request chunk 2, etc. — avoiding the need for a separate persistent queue infrastructure while naturally respecting per-invocation time limits.
- **Explicit `maxDuration` configuration:** Each scraping API route should set an explicit, conservative `maxDuration` in its route config rather than relying on defaults, and the chunk size should be tuned so realistic worst-case latency (including retries) stays safely under that ceiling.

---

## 4. Input Validation & Sanitization (File Upload Security)

### 4.1 File-Level Validation
| Control | Detail |
|---|---|
| File type allowlist | Only accept `.csv`, `.xlsx` (and optionally `.xls`) by **content inspection** (magic bytes / MIME sniffing), not just filename extension — an attacker can rename any file. |
| Max file size | Reject files above a hard limit (e.g., 5 MB) before parsing. |
| Max row count | Reject/truncate beyond a hard limit (e.g., 1,000 data rows) before processing. |
| XLSX bomb protection | Use a streaming/row-limited XLSX parser and enforce the row/size caps *during* parsing, not only after fully loading the file into memory, to avoid a maliciously crafted "zip bomb" style spreadsheet exhausting function memory. |

### 4.2 CSV/Excel Formula Injection Prevention
Spreadsheet formula injection is a well-known risk when user-uploaded, spreadsheet-sourced data is later **re-exported** and opened in Excel/Sheets by someone else (e.g., a malicious Name field like `=HYPERLINK("http://evil","click")` or `=cmd|'/c calc'!A1`).
- **On ingestion:** Treat all cell values as inert text/strings. Never evaluate formulas server-side.
- **On export (critical control):** Any output cell whose value begins with `=`, `+`, `-`, `@`, or a tab/carriage-return-prefixed variant of these must be neutralized before writing to the export CSV — typically by prefixing with a single quote (`'`) or a space, so spreadsheet applications render it as literal text rather than executing it as a formula. This applies to *every* field that ultimately reaches the CSV, including pass-through columns from the original upload (Name, Mentor Name, etc.), not just newly scraped fields.

### 4.3 Field-Level Validation & Sanitization
| Field | Validation Rule |
|---|---|
| Roll Number | Required; length-capped (e.g., ≤50 chars); stripped of control characters; treated as an opaque string (no assumption about numeric-only format, since roll number formats vary by institution). |
| Name | Required; length-capped (e.g., ≤200 chars); HTML/script-tag content stripped or escaped before ever being rendered in the results UI (see §4.5, XSS). |
| Mentor Name | Same as Name. |
| LeetCode Profile URL | Required; must parse as a well-formed URL; must match an **allowlisted host pattern** (§4.4) before any request is made. |

All string fields are also trimmed of leading/trailing whitespace and checked for a maximum length to prevent pathological inputs from bloating memory or downstream processing.

### 4.4 SSRF Prevention (URL Allowlisting)
Because the "LeetCode Profile URL" field is attacker-controllable free text, it must never be used to fetch an arbitrary URL server-side without validation — otherwise a malicious upload could attempt to make the serverless function request internal/cloud-metadata endpoints (a classic SSRF pattern).
- **Strict host allowlist:** Only permit URLs whose hostname is exactly `leetcode.com` or `www.leetcode.com` (or the specific subdomain LeetCode uses for public profiles/API). Reject everything else with an `invalid_url` classification — do not attempt to "be helpful" by following redirects to unknown hosts.
- **No redirect-following to non-allowlisted hosts:** If the HTTP client follows redirects, re-validate the final resolved host against the same allowlist before treating a response as legitimate.
- **Block internal/reserved IP ranges at the network layer where possible:** As defense-in-depth, even for the allowlisted host, ensure the outbound fetch cannot be tricked (via DNS rebinding) into resolving to a private/internal IP range.
- **Path normalization:** Validate the URL path matches the expected public-profile path pattern (e.g., `/u/<username>/` or `/<username>/`) rather than accepting arbitrary paths on the allowlisted host.

### 4.5 Cross-Site Scripting (XSS) Prevention in the Results UI
- Any user-supplied string (Name, Mentor Name, Roll Number, or scraped text fields) rendered into the results table must be rendered via the framework's safe text-rendering path (e.g., React's default JSX text interpolation, which auto-escapes) — never via `dangerouslySetInnerHTML` or raw HTML string concatenation.
- Apply a strict Content-Security-Policy header (see §5) as defense-in-depth against any XSS that slips through.

---

## 5. Vercel-Specific Environment & Security Configuration

### 5.1 Environment Variables & Secrets
- Any configuration value that could aid an attacker if leaked (e.g., a scraping proxy credential, an internal job-store token) is stored exclusively in Vercel's **Environment Variables** (Project Settings → Environment Variables), scoped appropriately to Production/Preview/Development, and never committed to the repository or exposed to the client bundle.
- Only variables explicitly prefixed for client exposure (e.g., `NEXT_PUBLIC_*` in Next.js) are ever bundled client-side; all scraping logic, rate-limit configuration, and any ephemeral-store credentials remain server-only (used inside API routes / server actions, never in client components).
- No API keys are required for scraping public LeetCode pages/public GraphQL endpoint in the base design; if a future version adds a proxy/anti-bot service, its credentials follow this same pattern.

### 5.2 Serverless Function Hardening
- **Explicit `maxDuration`:** Set per-route in `vercel.json` or route config, tuned per §3.3, rather than relying on platform defaults.
- **Region pinning (optional):** Consider pinning functions to a single region close to expected users to reduce latency variance that could otherwise cause spurious timeout-related retries.
- **Least-privilege runtime:** The scraping function should have no filesystem write access requirement and no database credentials at all in the default (non-persistent) architecture — reducing blast radius if the function is ever compromised via a dependency vulnerability.

### 5.3 Platform-Level Abuse Prevention
- **Vercel's built-in DDoS/Attack Challenge Mode** should be enabled (available on the account/project security settings) as a baseline protection for the deployment itself.
- **Per-IP/per-session request throttling** on the upload and scrape-trigger endpoints (e.g., via a lightweight in-memory or edge-config rate limiter) to prevent a single client from repeatedly submitting oversized batches and exhausting the deployment's function-invocation quota.
- **CORS policy:** API routes that trigger scraping should only accept requests from the deployment's own origin, not `*`, to prevent another site from driving scrape jobs against your deployment using a visitor's browser.
- **HTTPS-only:** Enforced by default on Vercel; ensure no mixed-content or HTTP fallback paths exist.
- **Security headers:** Set `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or `frame-ancestors 'none'` via CSP), and `Referrer-Policy: strict-origin-when-cross-origin` at the framework/middleware level.

### 5.4 Dependency Hygiene
- Pin dependency versions and run automated vulnerability scanning (e.g., `npm audit` / Dependabot / equivalent) in CI, particularly for the XLSX/CSV parsing library and any HTML-parsing library used for scraping — parser libraries are common targets for supply-chain and malformed-input vulnerabilities.

---

## 6. Summary Checklist (Pre-Launch Security Gate)

- [ ] No student PII (Roll Number, Name) ever reaches third-party logging/analytics services.
- [x] Student data is persisted securely in the database for daily monitoring.
- [ ] File upload validated by content, not extension; size and row caps enforced before parsing.
- [ ] CSV/Excel formula injection neutralized on **export**, for every text column.
- [ ] LeetCode URL field strictly host-allowlisted before any outbound request (SSRF prevention).
- [ ] Scraping is rate-limited, concurrency-capped, jittered, and has a circuit breaker on repeated blocks.
- [ ] All scraping functions have an explicit, conservative `maxDuration` and chunked processing so no batch risks a hard timeout.
- [ ] Results UI renders all user-supplied strings via safe/auto-escaped text rendering (no raw HTML injection).
- [ ] Security headers (CSP, X-Frame-Options, etc.) configured at the framework/middleware level.
- [ ] Secrets, if any, live only in Vercel environment variables, never in client bundle or source control.
