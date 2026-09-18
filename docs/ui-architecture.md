# UI Design & Architecture File
## LeetCode Scraper & Student Tracker

**Document Owner:** System Design / Front-End Architecture
**Status:** Draft v1.0
**Stack Assumption:** Next.js (App Router), React, deployed on Vercel

---

## 1. Information Architecture

### 1.1 Site Map (v1 — single-operator, no auth)

```
/                      → Dashboard / Home
  ├── /upload          → Ingestion (manual entry + bulk upload)
  ├── /run/[jobId]      → Live processing / results view for an active or completed batch
  └── /template         → (action, not a page) Downloads the CSV/XLSX template
```

Given the single-operator, no-persistence v1 scope, this can realistically live as a **single-page application flow** (Dashboard → Upload → Processing → Results, all client-state-driven) rather than requiring hard page navigations — recommended for a snappier feel, with the `/run/[jobId]` route existing mainly so a job's results are refresh-safe and shareable within the session.

### 1.2 Conceptual Page Layouts

#### A. Dashboard (`/`)
- **Empty state (first visit / no active job):**
  - Headline + one-line product explanation.
  - Two primary entry points: **"Bulk Upload"** (prominent, primary CTA) and **"Add a Single Student"** (secondary CTA).
  - A muted "Download template" link for first-time users.
- **Returning state (job exists in current session):**
  - Summary card of the last run: roster size, success/fail counts, "View Results" / "Start New Batch" actions.

#### B. Upload / Ingestion (`/upload`)
Two tabs or a toggle within one screen:
1. **Bulk Upload tab**
   - Large dropzone (drag-and-drop + click-to-browse), accepting `.csv` / `.xlsx`.
   - Inline helper text: expected columns, max rows/size, link to template download.
   - On file select: immediate client-side parse + validation preview (see §2.1) before any server call.
2. **Manual Entry tab**
   - Simple form: Roll Number, Name, Mentor Name, LeetCode URL.
   - "Add another" pattern — submitted entries accumulate into a mini-table below the form, which can then be "run" together (so a mentor adding 5 students one at a time still gets a single batch run).

#### C. Processing / Results (`/run/[jobId]`)
- **Header bar:** batch summary — total rows, processed count, success/fail/pending breakdown as compact stat chips, plus a progress bar.
- **Results table** (primary content area): one row per student —
  - Status icon (spinner while pending, check/warn/error icon on completion)
  - Roll Number, Name, Mentor Name
  - Solved Today, Global Rank, Badges (populated as they resolve)
  - Row-level action: "Retry" (visible only on failed/error rows)
- **Toolbar above table:** search box, status filter (All / Success / Failed / Pending), "Retry All Failed" button, "Export CSV" button (enabled as soon as at least one row has resolved — see PRD F-15).
- **Empty/error banner slot:** reserved space above the table for batch-level messages (e.g., "Scraping is currently rate-limited by LeetCode; retrying automatically" or "This batch was stopped after repeated blocks — partial results are available below.")

---

## 2. User Flow: Bulk Upload & Processing States

### 2.1 Upload → Validation Flow

```
User drops file
      │
      ▼
Client-side parse (papaparse for CSV / SheetJS for XLSX)
      │
      ▼
Client-side validation:
  - required columns present?
  - required fields non-empty?
  - URL well-formed?
  - duplicate roll numbers?
      │
      ├── Invalid file (bad columns) ──► Reject immediately, show what's wrong, do not proceed
      │
      └── Parsed successfully ──► Show validation summary screen:
                                     "124 rows found — 121 valid, 3 need attention"
                                     [expandable list of the 3 problem rows with reasons]
                                     [Proceed with 121 valid rows]  [Cancel / Fix file]
```

**Why client-side first:** validating file structure and per-field format in the browser (before any network call) gives instant feedback and avoids burning a serverless invocation on a file that's obviously malformed — server-side validation is still performed again on submission as a security backstop (never trust client-side validation alone), but the UX-facing first pass happens locally.

### 2.2 Processing State Flow (per PRD §3.2 chunking strategy)

```
User confirms "Run scrape on 121 students"
      │
      ▼
Navigate to /run/[jobId] (jobId generated client-side, e.g., uuid)
      │
      ▼
Client orchestrator loop:
  for each chunk of ~15 rows:
      │
      ├─ Show chunk rows as "pending" (spinner icon) immediately
      │
      ├─ POST /api/scrape-chunk  { rows: [...] }
      │        │
      │        ▼
      │   Server: rate-limited, concurrency-capped fetch per row (§3 of Security Spec)
      │        │
      │        ▼
      │   Returns per-row result: { status, solved_today, global_rank, badges }
      │
      ├─ Update table rows from pending → success/error icon, values populate
      │
      └─ Update progress bar / stat chips
      │
      ▼
All chunks complete → banner switches from "Processing..." to "Batch complete"
      │
      ▼
Export button fully enabled (was already enabled in partial state, per F-15)
```

### 2.3 Per-Row Visual States

| State | Icon / Treatment | Meaning |
|---|---|---|
| `pending` | Spinner (animated), row slightly dimmed | Not yet processed in this run |
| `success` | Green check | All three metrics retrieved |
| `partial_success` | Amber check with tooltip | Row succeeded but one field (e.g., badges) was unavailable on the profile — still counted as success (PRD §5.2) |
| `private_profile` | Grey lock icon | Explainable non-error outcome |
| `not_found` | Grey "?" icon | Profile URL doesn't resolve |
| `rate_limited_retrying` | Amber clock icon, pulsing | Backoff in progress, will auto-retry |
| `timeout` / `unknown_error` | Red warning icon | Actionable failure; shows "Retry" button |

### 2.4 Failure & Retry Flow

```
Row shows red/grey error state
      │
      ▼
User clicks row-level "Retry" (or toolbar "Retry All Failed")
      │
      ▼
Selected rows reset to "pending", re-enter the chunked processing loop
      │
      ▼
Updated in place in the same table — no full-page reset, no loss of already-successful rows
```

### 2.5 Export Flow

```
User clicks "Export CSV"
      │
      ▼
Client-side CSV generation (merge original + scraped fields, per-cell formula-injection
neutralization applied — Security Spec §4.2) from current table state — no extra server
round-trip needed, since results already live in browser memory
      │
      ▼
Browser triggers file download: leetcode_tracker_export_<timestamp>.csv
```

---

## 3. Front-End Component Breakdown

```
app/
├── page.tsx                        — Dashboard (empty/returning state)
├── upload/
│   └── page.tsx                    — Ingestion screen (tabs: Bulk / Manual)
├── run/[jobId]/
│   └── page.tsx                    — Processing/results screen
└── api/
    ├── scrape-chunk/route.ts       — Server endpoint: accepts a small row batch, returns results
    └── template/route.ts           — Serves the downloadable CSV/XLSX template

components/
├── upload/
│   ├── Dropzone.tsx                 — Drag-and-drop file input, accepts csv/xlsx
│   ├── ManualEntryForm.tsx          — Single-student form (Roll No, Name, Mentor, URL)
│   ├── PendingEntriesTable.tsx      — Accumulated manual entries before running
│   ├── ValidationSummary.tsx        — "121 valid, 3 need attention" screen + row-level reasons
│   └── TemplateDownloadLink.tsx
│
├── results/
│   ├── ResultsTable.tsx             — Main sortable/filterable table (virtualized if >200 rows)
│   ├── ResultsTableRow.tsx          — Single row, status-aware rendering
│   ├── StatusIcon.tsx               — Maps status enum → icon + color + tooltip (§2.3)
│   ├── ProgressHeader.tsx           — Stat chips (total/success/fail/pending) + progress bar
│   ├── BatchBanner.tsx              — Batch-level messages (rate-limited, partially blocked, etc.)
│   ├── FilterToolbar.tsx            — Search box + status filter dropdown + bulk-retry button
│   └── ExportButton.tsx             — Triggers client-side CSV generation/download
│
├── shared/
│   ├── Button.tsx / Badge.tsx / Spinner.tsx / EmptyState.tsx
│   └── Tooltip.tsx
│
lib/
├── validation/
│   ├── parseCsv.ts                  — papaparse wrapper + schema check
│   ├── parseXlsx.ts                 — SheetJS wrapper + schema check
│   └── rowSchema.ts                 — Shared client+server validation rules (single source of truth)
├── scraping/
│   ├── scrapeProfile.ts             — Core scrape logic (server-only)
│   ├── rateLimiter.ts               — Concurrency cap + jittered pacing + circuit breaker
│   └── urlAllowlist.ts              — SSRF-safe URL validation (Security Spec §4.4)
├── export/
│   └── generateCsv.ts               — Merge + formula-injection-safe CSV serialization
└── orchestration/
    └── useChunkedRun.ts             — Client hook driving the chunk-by-chunk processing loop (§2.2)
```

### 3.1 Key Component Notes
- **`ResultsTable`** is the highest-complexity component; it should be virtualized (e.g., windowed rendering) once roster size grows past ~150–200 rows to keep the UI responsive during live updates.
- **`useChunkedRun`** is the architectural heart of the front end — it owns the chunk loop, per-row state transitions, retry logic, and progress calculation, keeping `page.tsx` for `/run/[jobId]` thin and declarative.
- **`rowSchema.ts`** being shared between client-side pre-validation and the server route's re-validation avoids the two ever silently drifting out of sync (a common source of confusing "it passed validation but the server rejected it" bugs).
- All components consuming student-supplied strings (Name, Mentor Name, Roll Number) rely on React's default text interpolation for rendering — no component in this tree should use `dangerouslySetInnerHTML` (Security Spec §4.5).

---

## 4. Visual/Interaction Design Notes

- **Status color language** should be consistent and colorblind-safe: pair every color with an icon shape (check/clock/lock/warning), never rely on color alone to convey status (also satisfies NFR-7 accessibility).
- **Progress communication during long batches** is a primary UX risk — the combination of a top-level progress bar *and* live per-row spinners gives the user confidence the tool hasn't frozen, even during intentional rate-limit pauses; the `BatchBanner` component should explicitly explain pauses ("Pausing briefly to avoid rate limits — this is expected") rather than leaving the user guessing.
- **Destructive-feeling actions are avoided:** there is no "cancel batch and lose everything" pattern — partial results are always preserved and exportable, reinforcing the PRD's "never lose data" principle (F-14, F-15).
