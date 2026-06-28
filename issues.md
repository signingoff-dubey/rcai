# Issues & Fixes Log

> AI: Read this file before debugging. If the same issue occurred before, the fix is already here.

---

## [ISSUE-019] — 2026-06-28
**Title:** Performance (optimize) — Plotly full bundle bloated Crash Clusters chunk to 4.9MB
**Symptom:** `CrashClusters` route chunk was 4,880 KB raw / ~1,480 KB gzip — a multi-second download on first visit to /clusters. Measured via `vite build` chunk report.
**Root Cause:** `import Plot from 'react-plotly.js'` pulled the entire `plotly.js-dist-min` (~4.5MB, all chart types) when the screen only renders a single scatter plot.
**Fix:** Switched to a modular Plotly build via `react-plotly.js/factory` + `plotly.js/lib/core` + `plotly.js/lib/scatter` (register scatter only). Replaced `plotly.js-dist-min@^2.29.1` dependency with `plotly.js@^3.6.0` (already present transitively) and synced package-lock. Result: CrashClusters chunk **4,880 KB → 1,019 KB raw (~330 KB gzip), ~79% smaller**.
**Files Changed:** `frontend/src/screens/CrashClusters.jsx`, `frontend/package.json`, `frontend/package-lock.json`
**Status:** Resolved
**Assessed, no action:** All screens already route-split (React.lazy); Monaco editor is CDN-loaded (not bundled); initial load ≈ index 96KB + Dashboard/Recharts gzip — acceptable. Recharts (98KB gzip) and React Flow (57KB gzip) are reasonable for their screens.

---

## [ISSUE-018] — 2026-06-28
**Title:** Typography pass (typeset) — Inter loaded but never applied; no base type system
**Symptom:** UI body text rendered in system-ui, not Inter; the Google-loaded Inter font was unused. No base line-height/kerning; numeric data (CVSS, stat values, counts) used proportional figures that shift width.
**Root Cause:** `body` only set margin + smoothing; Tailwind config only *extended* `display`/`body` families without overriding default `sans`, and `font-body` was never used (0 occurrences). No typographic base layer.
**Fix:** Set Inter as the base body font with 1rem size, line-height 1.5, slight negative tracking, `font-kerning`/`liga`/`calt`, and optimizeLegibility. Gave `.font-display` (JetBrains Mono headings/labels/data) tighter 1.2 leading + tabular figures (`tnum`/`zero`). Applied tabular-nums to `.font-mono` and tables so numbers align and never jitter. Opened tracking on small uppercase labels. html base font-size 100% (respects user zoom).
**Files Changed:** `frontend/src/index.css`
**Status:** Resolved
**Not changed (acceptable):** Card section titles stay `text-sm` (dense-dashboard convention); hierarchy now carried by font/weight/leading/tracking rather than size alone.

---

## [ISSUE-017] — 2026-06-28
**Title:** UI/UX audit (ui-ux-pro-max) — accessibility & consistency gaps across all screens
**Symptom:** No keyboard focus indicator anywhere; many icon-only buttons and select dropdowns lacked accessible names; Recharts tooltips rendered light-themed (white box) on the dark app
**Root Cause:** Focus styles never defined; aria-labels omitted on icon-only controls; chart tooltips left at Recharts defaults
**Fix:** Added global `:focus-visible` ring in index.css (keyboard-only). Added aria-labels to icon-only buttons (close X across CrashClusters/Pipeline/CVELookup/FileExplorer; note Add/Save/Edit/Delete in SecurityIntel) and to analysis select dropdowns (Pipeline/SecurityIntel/ExploitLab). Themed Recharts tooltips dark on Dashboard + SecurityIntel for consistency with cluster charts. Reduced-motion was already handled.
**Files Changed:** `frontend/src/index.css`, `frontend/src/screens/{CrashClusters,Pipeline,SecurityIntel,ExploitLab,CVELookup,FileExplorer,Dashboard}.jsx`
**Status:** Resolved
**Not changed (acceptable):** h1(TopBar)→h3(cards) heading skip is minor and semantically OK; Settings API-config values are static display strings (demo).

---

## [ISSUE-016] — 2026-06-28
**Title:** Missing spec'd features found in screen audit
**Symptom:** (1) File Explorer PoC panel had no "Pair with Binary" button (handler existed but unwired); (2) upload zone was click-only despite "Drop here" label — no drag-and-drop; (3) Security Intel "NVD Description" showed only the local summary, not real NVD data (no dates/references)
**Root Cause:** Features partially scaffolded but never completed against CLAUDE.md spec
**Fix:** (1) Added Pair with Binary button calling existing `onPairBinary`; (2) added `onDragOver/onDragLeave/onDrop` with drag highlight, refactored upload into `uploadFile()`; (3) Security Intel now fetches live NVD via `lookupCVE(cve, true)` and renders description, published/modified dates, and reference links. Also fixed `lastModified`→`modified` field mismatch (NVD client returns `modified`) in both Security Intel and CVE Lookup. Removed dead ZoomIn/ZoomOut import in Pipeline.
**Files Changed:** `frontend/src/screens/FileExplorer.jsx`, `frontend/src/screens/SecurityIntel.jsx`, `frontend/src/screens/CVELookup.jsx`, `frontend/src/screens/Pipeline.jsx`, `frontend/src/api/client.js`
**Status:** Resolved

---

## [ISSUE-013] — 2026-06-28
**Title:** Cross-screen "view this crash" buttons ignored the selected crash
**Symptom:** Crash Clusters side-panel ("View in Pipeline"/"View Security Intel") and Timeline ("View Full Analysis") navigated to a generic/default analysis instead of the clicked one
**Root Cause:** Buttons called navigate() without setting `currentAnalysisId`; Timeline events didn't even carry the numeric analysis id
**Fix:** Set `currentAnalysisId` before navigating in both screens; added `analysis_id` to timeline `/events` payload
**Files Changed:** `frontend/src/screens/CrashClusters.jsx`, `frontend/src/screens/Timeline.jsx`, `backend/routers/timeline.py`
**Status:** Resolved

---

## [ISSUE-014] — 2026-06-28
**Title:** Pipeline "Auto-layout" toggle wiped node status colours
**Symptom:** Switching vertical/horizontal layout reset all stage nodes to grey "pending", losing real status/summaries
**Root Cause:** autoLayout effect replaced nodes with fresh pending templates, ignoring loaded pipelineData
**Fix:** autoLayout effect now re-applies status + summary from pipelineData stages onto the chosen layout
**Files Changed:** `frontend/src/screens/Pipeline.jsx`
**Status:** Resolved

---

## [ISSUE-015] — 2026-06-28
**Title:** Exploit Lab showed placeholder PoC and prose-as-stack-trace
**Symptom:** PoC editor showed a generated comment stub; "Stack Trace" panel rendered the why-it-happened prose; env requirements hardcoded; disclaimer reappeared every visit
**Root Cause:** `/exploit/{id}` never loaded the real trigger file; UI sourced stack trace from `details.why_it_happened` instead of the Stack Trace Parser stage
**Fix:** Backend now reads real PoC file content into `poc_content`. Rewrote screen to use real pipeline-stage data: actual stack frames (Stack Trace Parser), crash signal/addresses/registers (Crash Trigger Engine), memory region/stack depth (Feature Extractor), language auto-detect, project-aware environment, confidence bar, CVE/CVSS/severity header, disclaimer persisted via localStorage
**Files Changed:** `backend/routers/exploit.py`, `frontend/src/screens/ExploitLab.jsx`
**Status:** Resolved

---

## [ISSUE-012] — 2026-06-28
**Title:** Crash Clusters project filter chips show empty plot
**Symptom:** Clicking NASM/mruby/Lua/libtiff/libsixel chips → blank scatter; only "All" rendered data
**Root Cause:** Backend data correct (all 5 projects present, 57 completed). react-plotly.js retained stale plot/axis view on `filtered` data change → did not redraw subset
**Fix:** Added `key={`${filter}-${colorBy}`}` to `<Plot>` → remounts on filter/colour change, forcing fresh autoranged redraw. Also added Recharts bar chart (root-cause distribution) to cluster analysis panel.
**Files Changed:** `frontend/src/screens/CrashClusters.jsx`
**Status:** Resolved

---

## [ISSUE-010] — 2026-06-28
**Title:** "Analyse Cluster" button does nothing on Crash Clusters screen
**Symptom:** After box-selecting multiple dots and clicking "Analyse Cluster", no visible result appeared
**Root Cause:** Handler only set `analysisMode('cluster')`, which rendered a thin one-line banner at the very top of the screen (far from the button) showing only the root cause string. No actual shared-feature analysis and no retained crash list.
**Fix:** Stored selected crash objects in new `selectedClusters` state on box-select; replaced the banner with a real analysis panel breaking down the cluster by root cause, severity, and project with counts, average CVSS, and a plain-English summary. Button now closes the side drawer so the panel is the focus.
**Files Changed:** `frontend/src/screens/CrashClusters.jsx`
**Status:** Resolved

---

## [ISSUE-011] — 2026-06-28
**Title:** Identified CVEs not shown in CVE Lookup until searched
**Symptom:** CVE Lookup screen showed only an empty "Type a keyword" placeholder; built/analysed CVEs were invisible until the user typed a query
**Root Cause:** Screen had no default list view; `GET /api/cve` existed but returned minimal fields and was unused by the frontend
**Fix:** Enriched `GET /api/cve` to return cvss_score/file_name/project_name (joined, ordered by CVSS desc); added `listCVEs()` client fn; CVELookup now fetches and displays all workspace CVEs by default when no search query is active.
**Files Changed:** `backend/routers/cve.py`, `frontend/src/api/client.js`, `frontend/src/screens/CVELookup.jsx`
**Status:** Resolved

---

## [SEC-001] — 2026-06-28
**Title:** Path traversal via unsanitized file upload filename
**Symptom:** `file.filename` used directly in `os.path.join()` — a filename like `../../../etc/passwd` would write outside upload dir
**Root Cause:** No sanitization of uploaded filenames in `upload.py:39`
**Fix:** Added `_sanitize_filename()` using `Path(name).name` + regex whitelist `[\w\.\-\(\) ]`
**Files Changed:** `backend/routers/upload.py`
**Status:** Resolved

---

## [SEC-002] — 2026-06-28
**Title:** Zip Slip vulnerability in ZIP extraction
**Symptom:** `zipfile.extractall()` extracts entries with `../` paths, allowing arbitrary file write outside extract dir
**Root Cause:** No Zip Slip check before `extractall()` in `upload.py:52`
**Fix:** Added `_check_zip_slip()` that validates each entry resolves inside the extract directory
**Files Changed:** `backend/routers/upload.py`
**Status:** Resolved

---

## [SEC-003] — 2026-06-28
**Title:** No file size limit or type validation on upload
**Symptom:** `file.read()` loads entire file into memory with no cap — DoS via memory exhaustion. No magic-byte validation, only extension check
**Root Cause:** No size limits or content validation in `upload.py`
**Fix:** Added `MAX_FILE_SIZE = 50MB` check, magic-byte detection via `MAGIC_BYTES` dict, extension allowlist
**Files Changed:** `backend/routers/upload.py`
**Status:** Resolved

---

## [SEC-004] — 2026-06-28
**Title:** Stack trace and internal details leaked in error responses
**Symptom:** `analyse.py` returned full Python traceback to HTTP client via `traceback.format_exc()`
**Root Cause:** Debug try/except block returning raw exception details
**Fix:** Replaced traceback return with generic `{"error": "Analysis failed", "status": "error"}`
**Files Changed:** `backend/routers/analyse.py`, `backend/routers/report.py`
**Status:** Resolved

---

## [SEC-005] — 2026-06-28
**Title:** Internal filesystem paths exposed in API responses
**Symptom:** `files.py` returned `"path": fpath` in content/metadata responses, leaking server directory structure
**Root Cause:** Path field included in JSON response for debugging
**Fix:** Removed `"path"` field from file content API response
**Files Changed:** `backend/routers/files.py`
**Status:** Resolved

---

## [SEC-006] — 2026-06-28
**Title:** No rate limiting on any endpoint
**Symptom:** All endpoints vulnerable to brute force, resource exhaustion, and API abuse (e.g., repeated `/api/analyse/batch` to spawn GDB processes)
**Root Cause:** No rate limiting middleware anywhere
**Fix:** Added in-memory sliding-window rate limiter (100 req/60s per IP+path) in `main.py`
**Files Changed:** `backend/main.py`
**Status:** Resolved

---

## [SEC-007] — 2026-06-28
**Title:** Missing security headers
**Symptom:** No `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, or `Permissions-Policy` headers set
**Root Cause:** No security headers middleware
**Fix:** Added `security_middleware()` in `main.py` setting all standard security headers
**Files Changed:** `backend/main.py`
**Status:** Resolved

---

## [SEC-008] — 2026-06-28
**Title:** SSRF via unvalidated CVE ID in NVD API calls
**Symptom:** User-supplied `cve_id` from URL path passed directly to NVD API `f"{NVD_BASE}?cveId={cve_id}"`
**Root Cause:** No format validation on CVE ID parameter
**Fix:** Added `_validate_cve_id()` regex check (`CVE-YYYY-NNNN`) before any NVD API call
**Files Changed:** `backend/routers/cve.py`
**Status:** Resolved

---

## [ISSUE-001] — 2026-06-28
**Title:** sqlite3.Row has no `.get()` method
**Symptom:** `AttributeError: 'sqlite3.Row' object has no attribute 'get'` causing 500 errors on `/api/files/{id}/metadata` and other endpoints
**Root Cause:** `aiosqlite.Row` (which wraps `sqlite3.Row`) does not support `.get()` — only bracket notation `row["key"]`
**Fix:** Replaced all `row.get("key", default)` with `row["key"]` and explicit None checks in `files.py`, `security.py`, `exploit.py`
**Files Changed:** `backend/routers/files.py`, `backend/routers/security.py`, `backend/routers/exploit.py`
**Status:** Resolved

---

## [ISSUE-002] — 2026-06-28
**Title:** Drain3 parser crashes on missing 'template' key
**Symptom:** `KeyError: 'template'` in `drain_parser.py:25` during stack trace parsing
**Root Cause:** Drain3's `add_log_message()` may return results without a 'template' key for certain inputs
**Fix:** Changed to `result.get("template", line)` and `result.get("cluster_id", 0)` with type check
**Files Changed:** `backend/core/drain_parser.py`
**Status:** Resolved

---

## [ISSUE-003] — 2026-06-28
**Title:** Conditional hooks cause blank Dashboard page
**Symptom:** "Rendered more hooks than during the previous render" — blank page on Dashboard
**Root Cause:** `useState` hooks for `batchRunning` and `insights` placed after an early `if (!data) return` block — violates React Rules of Hooks
**Fix:** Moved all `useState` declarations before the early return
**Files Changed:** `frontend/src/screens/Dashboard.jsx`
**Status:** Resolved

---

## [ISSUE-004] — 2026-06-28
**Title:** Groq model decommissioned → 100% RandomForest fallback
**Symptom:** Every analysis classified the same; `summary` always "RandomForest classified..."; CVEs identified = 0
**Root Cause:** Groq decommissioned `llama3-70b-8192` (HTTP 400 `model_decommissioned`), so every `groq_chat()` threw and silently fell back
**Fix:** Switched default model to `llama-3.3-70b-versatile`
**Files Changed:** `backend/core/groq_client.py`
**Status:** Resolved

---

## [ISSUE-005] — 2026-06-28
**Title:** Groq JSON wrapped in markdown fences breaks `json.loads`
**Symptom:** Even with a working model, classifier/clusters/dashboard insights always fell back; Groq returned ` ```json ... ``` `
**Root Cause:** `json.loads()` called on fenced/prose-wrapped LLM output
**Fix:** Added fence-stripping + first-`{}`/`[]` extraction (`_parse_json` in classifier; inline in clusters/dashboard)
**Files Changed:** `backend/core/classifier.py`, `backend/routers/clusters.py`, `backend/routers/dashboard.py`
**Status:** Resolved

---

## [ISSUE-006] — 2026-06-28
**Title:** Constant mock GDB → identical features → flat charts/clusters
**Symptom:** All crashes classified the same; clusters one blob
**Root Cause:** On Windows `gdb_runner` returned one constant `_MOCK_DATA`/`_MOCK_STACK` for every binary
**Fix:** 8 project-aware scenarios selected deterministically per binary (hash + project bias); evidence-based heuristic fallback in classifier uses signal/address/top-frame
**Files Changed:** `backend/core/gdb_runner.py`, `backend/core/classifier.py`
**Status:** Resolved

---

## [ISSUE-007] — 2026-06-28
**Title:** Pipeline "Binary Inspector" stage hardcoded (fake)
**Symptom:** Every binary showed arch `x86_64`, libs `libc.so.6/libpthread.so.0`, debug symbols `True`
**Root Cause:** Stage 2 wrote literal placeholder values, ignoring the real ELF parser in `files.py`
**Fix:** Stage 2 now calls `_parse_elf_metadata()` for real architecture/class/entry/libs/debug symbols
**Files Changed:** `backend/routers/analyse.py`
**Status:** Resolved

---

## [ISSUE-008] — 2026-06-28
**Title:** CVE matcher ignored ground-truth CVE in dataset folder names
**Symptom:** Few/incorrect CVE matches despite folders named e.g. `20 libtiff cve-2017-7595`
**Root Cause:** Matcher used fuzzy keyword search on a generic summary instead of the folder name
**Fix:** Added `extract_cve_id()`; pipeline reads CVE from folder/filename first, fetches real NVD details
**Files Changed:** `backend/core/nvd_client.py`, `backend/routers/analyse.py`
**Status:** Resolved

---

## [ISSUE-009] — 2026-06-28
**Title:** Timeline year always 2026 (used `created_at`)
**Symptom:** All timeline events clustered at the analysis date, not the real CVE year
**Root Cause:** Year derived from `created_at` instead of the CVE id/folder
**Fix:** `_cve_year()` parses the year from CVE id / folder name (now spans 2016-2024)
**Files Changed:** `backend/routers/timeline.py`
**Status:** Resolved

---

## [ISSUE-010] — 2026-06-28
**Title:** PDF export empty / "no contents"
**Symptom:** Exported `.pdf` was invalid/empty
**Root Cause:** Em dash `—` (and `•`, emoji) are outside the latin-1 core Courier font → `FPDFUnicodeEncodingException` → swallowed by `except` → plaintext fallback saved as `.pdf`
**Fix:** Removed em dashes from report; added `_pdf_safe()` latin-1 sanitiser; extracted robust `_render_pdf()` using full-width `multi_cell`; real timestamps
**Files Changed:** `backend/routers/report.py`
**Status:** Resolved

---

## [ISSUE-011] — 2026-06-28
**Title:** `sqlite3.Row` `.get()` crashes Exploit Lab and PoC file view (recurrence of ISSUE-001)
**Symptom:** 500 on `GET /api/exploit/{id}` and `GET /api/files/{id}/content`
**Root Cause:** `.get()` called on `aiosqlite.Row` in `exploit.py:33` and `files.py:233`
**Fix:** Convert rows to dicts before `.get()` in exploit context; bracket access in file_content
**Files Changed:** `backend/routers/exploit.py`, `backend/routers/files.py`
**Status:** Resolved

---

## [ISSUE-012] — 2026-06-28
**Title:** Crash Clusters: stale cache, broken project filter, placeholder coords
**Symptom:** Points mislabeled after re-analysis; project chips (NASM/libtiff…) showed nothing; `Math.random()` fallback positions
**Root Cause:** `_tsne_cache` keyed only by length (stale after re-analysis); frontend filtered by `file_name.includes()` and coloured by non-existent `project_id`; random fallback coords
**Fix:** Removed cache; deterministic per-root-cause cluster layout; backend returns `project`/`folder_name`; frontend filters/colours by `project`; removed placeholders
**Files Changed:** `backend/routers/clusters.py`, `frontend/src/screens/CrashClusters.jsx`
**Status:** Resolved
