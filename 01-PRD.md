# Product Requirements Document (PRD)
## LeetCode Scraper & Student Tracker

**Document Owner:** Product Management
**Status:** Draft v1.0
**Target Platform:** Vercel (Next.js full-stack)

---

## 1. Executive Summary & Product Goals

### 1.1 Problem Statement
Mentors and competitive-programming (CP) club leads currently track student progress on LeetCode manually — opening dozens of profiles, copying stats into a spreadsheet, and repeating this weekly or daily. This is slow, error-prone, and doesn't scale past a handful of students.

### 1.2 Product Vision
A lightweight internal tool that lets a mentor upload a roster of students (with their public LeetCode profile URLs), automatically pull key progress metrics for each student, and export a consolidated report — turning a manual, hour-long chore into a two-minute workflow.

### 1.3 Goals
| Goal | Success Metric |
|---|---|
| Reduce manual tracking effort | Bulk-process 100+ students in a single run in under 5 minutes |
| Provide accurate, current data | ≥95% successful scrape rate on valid, public profile URLs |
| Make results actionable | One-click CSV export merging roster + scraped metrics |
| Be safe to operate | Zero student PII leaves the user's own session/export; no unbounded scraping load on LeetCode |

### 1.4 Non-Goals (v1)
- Historical trend tracking / time-series database of student progress (v1 is a point-in-time snapshot tool).
- Automated scheduled/cron scraping without a user present (deferred — see §7 Future Considerations).
- Authenticated/private LeetCode profile scraping.
- Multi-tenant accounts, login, or role-based access control (v1 assumes a single trusted operator per deployment, e.g., a club lead running their own instance).
- Leaderboards, gamification, or student-facing views.

### 1.5 Target Users
- **Primary:** College CP club leads / mentors tracking 20–300 students.
- **Secondary:** Coding bootcamp instructors, hackathon/training program coordinators.

---

## 2. User Stories & Core Workflows

### 2.1 Primary Workflow: Upload → Scrape → Export

```
[Mentor] --uploads roster (CSV/XLSX or manual entry)-->
[System] --validates rows, queues scrape jobs-->
[System] --scrapes each LeetCode profile (rate-limited, with retries)-->
[System] --displays live per-row status in a results table-->
[Mentor] --reviews results, re-runs failed rows if needed-->
[Mentor] --exports consolidated CSV-->
```

### 2.2 User Stories

**Epic A — Data Ingestion**
- As a mentor, I want to manually add a single student's Roll Number, Name, Mentor Name, and LeetCode URL, so I can track one student without a spreadsheet.
- As a mentor, I want to bulk-upload an Excel/CSV file of my entire roster, so I don't have to enter 100 students one by one.
- As a mentor, I want the system to validate my upload immediately (correct columns, valid URL format) and tell me exactly which rows have problems, so I can fix my source file before wasting a scrape run.
- As a mentor, I want to download a CSV/XLSX template with the correct headers, so I know exactly what format to prepare.

**Epic B — Scraping**
- As a mentor, I want the system to fetch each student's problems-solved-today count, global rank, and badge count, so I get a current snapshot without visiting each profile.
- As a mentor, I want to see live progress (e.g., "42 of 120 processed") during a bulk run, so I know the tool hasn't stalled.
- As a mentor, I want per-row status indicators (success / failed / private / not found), so I immediately know which students need attention.
- As a mentor, I want failed rows to be retryable individually or as a batch, so a transient network blip doesn't force me to re-run everything.

**Epic C — Export**
- As a mentor, I want to download one CSV containing my original roster columns plus the newly scraped metrics, so I can share or archive it.
- As a mentor, I want failed/unresolved rows clearly marked in the export (not silently dropped), so my records stay complete and auditable.

**Epic D — Error Visibility**
- As a mentor, I want clear, specific error messages (e.g., "profile is private" vs. "URL not found" vs. "rate-limited, retrying") rather than a generic failure, so I know whether the problem is on my end or LeetCode's.

### 2.3 Core Workflow Diagram (conceptual)

1. **Landing / Dashboard** — mentor sees prior session results (if persisted) or an empty state prompting upload.
2. **Ingestion** — manual form *or* drag-and-drop bulk upload; client-side validation before submission.
3. **Processing** — server processes rows in controlled batches; UI shows a live table with per-row spinner → success/error icon.
4. **Review** — sortable/filterable results table; mentor can retry failed rows.
5. **Export** — "Download CSV" button generates the merged file client-side or via a serverless endpoint.

---

## 3. Functional Requirements

### 3.1 Data Ingestion
| ID | Requirement |
|---|---|
| F-1 | System shall provide a manual entry form with fields: Roll Number (string, required, unique within batch), Name (string, required), Mentor Name (string, required), LeetCode Profile URL (string, required, URL format). |
| F-2 | System shall accept bulk upload via `.xlsx` and `.csv` files. |
| F-3 | System shall provide a downloadable template file matching the expected column schema. |
| F-4 | System shall validate uploaded files for: required columns present, non-empty required fields, well-formed URLs, and duplicate Roll Numbers within the same file. |
| F-5 | System shall reject files exceeding a configurable max size (e.g., 5 MB) and max row count (e.g., 1,000 rows) with a clear error message, to keep runs within serverless execution limits. |
| F-6 | System shall show a pre-processing validation summary (e.g., "118 valid rows, 2 invalid — see below") before the user commits to running the scrape. |

### 3.2 Scraping Engine
| ID | Requirement |
|---|---|
| F-7 | System shall extract, per profile: (a) number of questions solved *today* (current calendar day, per the profile's displayed activity/submission data), (b) current global ranking, (c) total badge count. |
| F-8 | System shall process the batch with bounded concurrency (see NFR-2) rather than firing all requests simultaneously. |
| F-9 | System shall classify each row's outcome as one of: `success`, `private_profile`, `invalid_url`, `not_found`, `rate_limited_retrying`, `timeout`, `unknown_error`, and surface that classification to the UI. |
| F-10 | System shall retry transient failures (timeouts, rate-limit responses) with exponential backoff, up to a configurable max attempt count, before marking a row permanently failed. |
| F-11 | System shall allow the user to manually re-trigger scraping for a selected subset of rows (e.g., all failed rows) without re-uploading the whole file. |
| F-12 | System shall display a live progress indicator (processed / total, and a per-row status icon) during the run, updated via polling or streaming (see §3.4 in Architecture doc). |

### 3.3 Data Export
| ID | Requirement |
|---|---|
| F-13 | System shall generate a single CSV combining all original input columns with the scraped columns (`solved_today`, `global_rank`, `badge_count`, `scrape_status`, `last_scraped_at`). |
| F-14 | Rows that failed to scrape shall still appear in the export, with scraped fields blank/null and `scrape_status` populated — never silently dropped. |
| F-15 | Export shall be triggerable at any point after a run completes (including partial runs), not only after 100% success. |
| F-16 | Exported filenames shall include a timestamp (e.g., `leetcode_tracker_export_2026-09-18.csv`) to avoid overwrite confusion across repeated runs. |

### 3.4 Results & Review UI
| ID | Requirement |
|---|---|
| F-17 | Results table shall be sortable by any scraped column and filterable by status. |
| F-18 | Results table shall support search-by-name or roll-number for quick lookup in large rosters. |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | A batch of 100 students should complete processing in well under the platform's function duration ceiling, using chunked/batched execution rather than one long-running function (see Security & Architecture docs for the chunking strategy). |
| NFR-2 | Scraping Etiquette | Requests to LeetCode shall be rate-limited (configurable requests/second) and shall never be parallelized beyond a small, conservative concurrency cap, to avoid IP-level throttling or bans. |
| NFR-3 | Reliability | A single failed row shall never abort the entire batch; failures are isolated per-row. |
| NFR-4 | Usability | A first-time user should be able to complete an upload → scrape → export cycle without documentation, using in-UI guidance (template download, inline validation messages). |
| NFR-5 | Data Retention | Uploaded student data and scrape results shall not be persisted longer than necessary for the session/export (see Security Specification for retention policy) unless the user explicitly opts into saving a run. |
| NFR-6 | Portability | The application shall run entirely on Vercel's serverless/edge primitives with no requirement for a dedicated always-on server. |
| NFR-7 | Accessibility | Core flows (upload, review, export) shall be usable via keyboard navigation and meet WCAG 2.1 AA contrast/labeling basics. |
| NFR-8 | Observability | Failed scrape attempts shall be logged server-side (without storing student PII in logs — see Security Spec) with enough detail to diagnose systemic issues (e.g., LeetCode markup changes). |

---

## 5. Edge Cases & Error Handling

### 5.1 Input Data Edge Cases
| Scenario | Expected Behavior |
|---|---|
| Missing required column in uploaded file | Reject file at validation step; name the missing column(s) explicitly. |
| Empty Roll Number / Name / URL cell | Flag specific row(s) as invalid pre-processing; allow user to fix and re-upload, or optionally proceed while excluding invalid rows (user's explicit choice). |
| Duplicate Roll Numbers in same file | Warn user; do not silently merge — require explicit acknowledgment or auto-suffix, per user choice. |
| Non-LeetCode URL, or malformed URL | Classify as `invalid_url`; never attempt to fetch it. |
| Extremely large file (>row/size limits) | Reject with a clear message and suggest splitting into smaller batches. |
| File with unexpected extra columns | Preserve and pass through to export (don't silently drop user's extra metadata columns) unless they conflict with reserved output column names. |
| Formula-like cell content (e.g., `=HYPERLINK(...)`) | Treated as inert text on ingestion — never executed; see Security Spec §4 (CSV/Excel injection). |

### 5.2 Scraping Edge Cases
| Scenario | Expected Behavior |
|---|---|
| Private LeetCode profile | Classify as `private_profile`; do not treat as a generic error — this is an expected, explainable outcome. |
| Profile URL well-formed but user doesn't exist (404) | Classify as `not_found`. |
| LeetCode returns a CAPTCHA / bot-challenge page | Classify as `rate_limited_retrying` (if within retry budget) then `blocked_by_target` if retries are exhausted; back off the whole batch, not just that row. |
| LeetCode changes profile page structure (scraper breaks) | Classify as `unknown_error` with a structured internal log entry; must not crash the whole batch — a parsing failure on one profile is isolated. |
| Zero problems solved today (legitimately) | Must be distinguished from a scrape failure — "0 solved today" is a valid successful result, not an error. |
| Global rank or badge count not displayed/available for a given profile | Field returned as null/blank with `success` status if the rest of the scrape succeeded (partial success is still success, not failure). |
| Request timeout mid-batch | Retry with backoff per F-10; if exhausted, mark row `timeout` and continue with remaining rows. |
| LeetCode blocks the deployment's outbound IP entirely | Surface a batch-level banner (not just per-row errors) explaining that scraping is currently degraded, with guidance (see Security Spec §3 for mitigation strategy). |

### 5.3 Operational Edge Cases
| Scenario | Expected Behavior |
|---|---|
| User navigates away / closes tab mid-run | In-progress run state should be recoverable or at minimum clearly communicated as "incomplete" on return, not silently lost without explanation. |
| Serverless function approaches platform time limit | Batch is chunked so no single invocation risks hitting the ceiling (see Architecture doc §"Processing Model"); partial results are always available for export, never all-or-nothing. |
| Two users run the tool against overlapping rosters concurrently | Out of scope for v1 (single-operator assumption); documented as a known limitation, not silently mishandled. |

---

## 6. Success Metrics (v1 Launch)

- ≥95% scrape success rate on a test set of 100 known-valid public profiles.
- 0 full-batch failures caused by a single bad row (isolation requirement).
- Full upload→scrape→export cycle for 100 students completes in under 5 minutes wall-clock.
- No student PII persists beyond the active session unless the user opts in.

---

## 7. Future Considerations (Explicitly Out of Scope for v1)

- Scheduled/recurring scrapes (e.g., nightly cron) with historical trend charts.
- Multi-mentor accounts with authentication and per-mentor data isolation.
- Support for additional platforms (Codeforces, CodeChef, HackerRank) alongside LeetCode.
- Email/Slack digest notifications of student progress.
- A persistent database (this PRD assumes ephemeral, session-scoped processing — see Security Spec for rationale).

---

## 8. Open Questions

1. Should "questions solved today" be derived from LeetCode's public submission calendar/heatmap data, and how should timezone be handled (student's local day vs. server UTC day)? Recommend defaulting to UTC day with a documented caveat, pending stakeholder input.
2. Is there an appetite for optional persistence (e.g., opt-in save-to-browser-storage of past runs) in v1, or strictly ephemeral? PRD currently assumes ephemeral-by-default (NFR-5).
3. What is the expected maximum roster size in practice — this determines whether chunked serverless processing is sufficient or whether a queue-based architecture is needed sooner (see Architecture doc).
