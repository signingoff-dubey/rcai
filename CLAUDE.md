\# RCAi — Software Failure Root Cause Analysis Platform  
\#\# Agentic Build Instructions (CLAUDE.md)

\---

\#\# 0\. CONTEXT & PURPOSE

RCAi is a hackathon-grade, research-quality web platform for analysing software crash datasets (fuzzing PoC inputs, ELF binaries, CVE-linked crash corpora). It ingests uploaded crash folders, runs them through an AI-powered analysis pipeline, and surfaces root causes, security risk scores, and reproduction paths — all through a polished, dark-themed dashboard.

This is being built for the \*\*IEEE DataPort Hackathon — Problem Statement \#12: Software Failure Root Cause Analysis\*\*.

The dataset is a real-world fuzzing crash corpus containing:  
\- NASM (assembler) CVEs  
\- mruby (Ruby interpreter) crashes \+ issues  
\- Lua (scripting VM) crashes  
\- libtiff (image library) CVEs  
\- libsixel (image format library) CVEs \+ issues

Each dataset folder contains compiled ELF binaries (with debug symbols) and small PoC trigger files (\`.rb\`, \`.lua\`, plain text inputs).

\---

\#\# 1\. TECH STACK — DO NOT DEVIATE

\#\#\# Frontend  
\- \*\*React 18\*\* with functional components and hooks only  
\- \*\*Tailwind CSS\*\* — utility classes only, no custom CSS files unless absolutely necessary  
\- \*\*Framer Motion\*\* — for page transitions, panel animations, node animations in pipeline view  
\- \*\*React Flow\*\* (\`@xyflow/react\`) — for the Pipeline screen node graph  
\- \*\*Recharts\*\* — for bar charts, donut charts on Dashboard  
\- \*\*Plotly.js\*\* (\`react-plotly.js\`) — for t-SNE scatter plot on Crash Clusters screen  
\- \*\*React Router v6\*\* — for screen navigation  
\- \*\*Lucide React\*\* — for all icons, no other icon libraries  
\- \*\*Axios\*\* — for all HTTP calls to backend  
\- \*\*Monaco Editor\*\* (\`@monaco-editor/react\`) — for PoC code display and editing in Exploit Lab

\#\#\# Backend  
\- \*\*Python 3.11+\*\*  
\- \*\*FastAPI\*\* — all REST endpoints  
\- \*\*Uvicorn\*\* — ASGI server  
\- \*\*Drain3\*\* (\`pip install drain3\`) — log template extraction  
\- \*\*pygdbmi\*\* (\`pip install pygdbmi\`) — structured GDB output parsing  
\- \*\*scikit-learn\*\* — Isolation Forest anomaly detection, classification  
\- \*\*NetworkX\*\* — crash dependency graph building  
\- \*\*httpx\*\* — async HTTP for NVD CVE API calls  
\- \*\*SQLite\*\* via \`aiosqlite\` — local database for storing analysis results  
\- \*\*python-multipart\*\* — file upload handling

\#\#\# Dev tooling  
\- \*\*Vite\*\* — frontend bundler  
\- \*\*concurrently\*\* — run frontend \+ backend together in dev

\---

\#\# 2\. PROJECT STRUCTURE

\`\`\`  
rcai/  
├── CLAUDE.md                  ← this file  
├── README.md  
├── package.json               ← root, runs both frontend \+ backend  
├── frontend/  
│   ├── index.html  
│   ├── vite.config.js  
│   ├── tailwind.config.js  
│   ├── src/  
│   │   ├── main.jsx  
│   │   ├── App.jsx            ← Router \+ layout shell  
│   │   ├── components/  
│   │   │   ├── Layout/  
│   │   │   │   ├── Sidebar.jsx  
│   │   │   │   └── TopBar.jsx  
│   │   │   └── shared/  
│   │   │       ├── SeverityBadge.jsx  
│   │   │       ├── StatCard.jsx  
│   │   │       ├── CrashCard.jsx  
│   │   │       └── LoadingSpinner.jsx  
│   │   ├── screens/  
│   │   │   ├── Dashboard.jsx  
│   │   │   ├── FileExplorer.jsx  
│   │   │   ├── Pipeline.jsx  
│   │   │   ├── SecurityIntel.jsx  
│   │   │   ├── ExploitLab.jsx  
│   │   │   ├── CrashClusters.jsx  
│   │   │   ├── Timeline.jsx  
│   │   │   ├── CVELookup.jsx  
│   │   │   ├── ReportBuilder.jsx  
│   │   │   └── Settings.jsx  
│   │   ├── store/  
│   │   │   └── useAppStore.js  ← Zustand global state  
│   │   ├── api/  
│   │   │   └── client.js       ← all axios calls in one place  
│   │   └── utils/  
│   │       ├── severity.js     ← CVSS → color mapping  
│   │       └── formatters.js  
├── backend/  
│   ├── main.py                ← FastAPI app entry  
│   ├── requirements.txt  
│   ├── routers/  
│   │   ├── upload.py  
│   │   ├── analyse.py  
│   │   ├── pipeline.py  
│   │   ├── security.py  
│   │   ├── exploit.py  
│   │   ├── clusters.py  
│   │   ├── cve.py  
│   │   └── report.py  
│   ├── core/  
│   │   ├── gdb\_runner.py      ← subprocess GDB execution  
│   │   ├── drain\_parser.py    ← Drain3 stack trace parsing  
│   │   ├── classifier.py      ← root cause ML classifier  
│   │   ├── graph\_builder.py   ← NetworkX crash dependency graph  
│   │   ├── cvss\_scorer.py     ← CVSS v3 calculation  
│   │   └── nvd\_client.py      ← NVD API enrichment  
│   ├── db/  
│   │   ├── database.py        ← SQLite connection \+ init  
│   │   └── models.py          ← table schemas  
│   └── uploads/               ← where uploaded files land (gitignored)  
\`\`\`

\---

\#\# 3\. VISUAL DESIGN SYSTEM

\#\#\# Colour Palette — STRICTLY USE THESE  
\`\`\`  
Background primary:   \#0A0E1A   (near-black, deep navy)  
Background card:      \#111827   (slightly lighter surface)  
Background elevated:  \#1A2235   (drawer/modal surfaces)  
Border:               \#1E2D45   (subtle dividers)  
Accent primary:       \#3B82F6   (electric blue — primary actions)  
Accent danger:        \#EF4444   (red — critical severity, Exploit Lab)  
Accent warning:       \#F59E0B   (amber — high severity)  
Accent success:       \#10B981   (green — low/info)  
Accent purple:        \#8B5CF6   (purple — AI/ML indicators)  
Text primary:         \#F1F5F9   (near white)  
Text secondary:       \#94A3B8   (slate-400, labels/captions)  
Text muted:           \#475569   (slate-600, disabled/placeholders)  
\`\`\`

\#\#\# Typography  
\`\`\`  
Display/Headers:  'JetBrains Mono' (Google Fonts) — gives terminal/research feel  
Body text:        'Inter' (Google Fonts) — clean readability  
Code/PoC files:   'JetBrains Mono' (Monaco Editor default)  
\`\`\`  
Load both from Google Fonts in \`index.html\`.

\#\#\# Severity Colour Map  
\`\`\`  
Critical  →  \#EF4444 (red)  
High      →  \#F59E0B (amber)  
Medium    →  \#3B82F6 (blue)  
Low       →  \#10B981 (green)  
Info      →  \#8B5CF6 (purple)  
\`\`\`

\#\#\# Component Rules  
\- All cards: \`rounded-xl bg-\[\#111827\] border border-\[\#1E2D45\]\`  
\- Buttons primary: \`bg-\[\#3B82F6\] hover:bg-blue-500 text-white rounded-lg px-4 py-2\`  
\- Buttons danger: \`bg-\[\#EF4444\] hover:bg-red-500 text-white rounded-lg px-4 py-2\`  
\- Buttons ghost: \`border border-\[\#1E2D45\] hover:bg-\[\#1A2235\] text-\[\#94A3B8\] rounded-lg px-4 py-2\`  
\- No border-radius below \`rounded-lg\` on interactive elements  
\- All transitions: \`transition-all duration-200\`

\---

\#\# 4\. LAYOUT SHELL

\#\#\# Sidebar (Left Nav)  
\- Default width: \`w-64\` (256px)  
\- Collapsed width: \`w-16\` (64px, icon-only)  
\- Toggle via hamburger button at top of sidebar  
\- Collapse/expand animated with Framer Motion \`motion.div\` width transition  
\- Logo at top: "RCAi" in JetBrains Mono, blue accent  
\- Nav items (in order):  
  \`\`\`  
  🏠  Dashboard         /  
  📁  File Explorer     /explorer  
  🔬  Pipeline          /pipeline  
  🛡️  Security Intel    /security  
  💥  Exploit Lab       /exploit       ← red text colour  
  📊  Crash Clusters    /clusters  
  🕐  Timeline          /timeline  
  🧠  CVE Lookup        /cve  
  📄  Report Builder    /report  
  ⚙️  Settings          /settings  
  \`\`\`  
\- Active item: left blue border, slightly lighter background  
\- Collapsed state: show only icons with Tooltip on hover

\#\#\# TopBar  
\- Height: \`h-14\`  
\- Shows: current screen title, breadcrumb if in File Explorer, global search icon, notification bell (placeholder), dark mode toggle (always dark, toggle is cosmetic for demo)

\#\#\# Main content area  
\- \`flex-1 overflow-y-auto p-6\`  
\- Background: \`\#0A0E1A\`

\---

\#\# 5\. SCREEN SPECIFICATIONS

\---

\#\#\# SCREEN 1: Dashboard (\`/\`)

\*\*Purpose:\*\* Command centre overview of all analysed crashes.

\*\*Layout: 3-row grid\*\*

\*\*Row 1 — Stat Cards (4 across)\*\*  
Each card component (\`StatCard.jsx\`) shows:  
\- Icon (Lucide)  
\- Label  
\- Value (large, JetBrains Mono)  
\- Delta indicator (small up/down arrow with colour)

Cards:  
1\. Total Crashes Analysed — \`FileWarning\` icon, blue  
2\. CVEs Identified — \`ShieldAlert\` icon, amber  
3\. Highest CVSS Score — \`Zap\` icon, red (shows score like "9.8 CRITICAL")  
4\. Projects in Workspace — \`FolderOpen\` icon, purple

\*\*Row 2 — Three columns\*\*  
\- Col 1 (40%): Recharts Donut chart — crashes by severity (Critical/High/Medium/Low/Info). Legend below.  
\- Col 2 (35%): Recharts Bar chart — root cause distribution (Stack Overflow, Heap BOF, UAF, Type Confusion, Null Ptr Deref, Integer Overflow)  
\- Col 3 (25%): "Top Vulnerable Components" — ranked list with severity dot and crash count

\*\*Row 3 — Two columns\*\*  
\- Col 1 (65%): Activity feed — scrollable list of recent analyses. Each entry: timestamp, project name, severity badge, root cause label, clickable → navigates to that crash in File Explorer  
\- Col 2 (35%): Quick Actions panel  
  \- "Upload Dataset" button (primary)  
  \- "Run Full Analysis" button (ghost)  
  \- "Export Report" button (ghost)  
  \- "Fetch CVE Updates" button (ghost)

\*\*Data source:\*\* \`GET /api/dashboard/summary\`

\---

\#\#\# SCREEN 2: File Explorer (\`/explorer\`)

\*\*Purpose:\*\* Upload crash datasets, navigate folder structure, preview files.

\*\*Layout: Two-panel horizontal split\*\*

\*\*Left panel (w-72, fixed, scrollable)\*\*  
\- Top: Drag-and-drop upload zone  
  \- Dashed border, \`Upload\` icon, "Drop dataset folder here or click to browse"  
  \- On drop/select: POST to \`/api/upload\` with FormData  
  \- Shows upload progress bar while uploading  
\- Below: File tree  
  \- Root level: uploaded dataset folders (e.g., "dataset 12")  
  \- Expand/collapse folders with chevron  
  \- File entries show:  
    \- File type icon (folder/binary/ruby/lua/text)  
    \- File name  
    \- After analysis: severity colour dot on right  
  \- Selected item highlighted in blue  
  \- Right-click context menu: "Analyse", "Delete", "Copy Path"

\*\*Right panel (flex-1)\*\*  
Renders based on what's selected in left panel:

\- \*\*Nothing selected:\*\* Empty state — "Select a file or folder from the left panel"  
\- \*\*Folder selected:\*\* Grid of child items as cards. Each card shows name, type, analysis status badge ("Analysed / Pending / Running")  
\- \*\*ELF binary selected:\*\*  
  \- Metadata table: Architecture, Class (ELF64), Endianness, Entry Point, Debug Symbols (YES/NO badge), Linked Libraries  
  \- "Analyse This Binary" primary button  
  \- If analysed: "View Results" and "Open in Pipeline" buttons  
\- \*\*\`.rb\` / \`.lua\` / text PoC file selected:\*\*  
  \- Monaco Editor (read-only) with syntax highlighting  
  \- File path \+ size shown above  
  \- "This is a crash trigger file" info banner  
  \- "Pair with Binary" button to link it to a binary for analysis  
\- \*\*Analysis running:\*\* Animated progress bar with stage labels ("Running GDB...", "Parsing stack trace...", "Classifying root cause...")

\*\*Data sources:\*\*  
\- \`POST /api/upload\` — upload files  
\- \`GET /api/files\` — get file tree  
\- \`GET /api/files/{id}/metadata\` — ELF metadata  
\- \`POST /api/analyse/{binary\_id}\` — trigger analysis

\---

\#\#\# SCREEN 3: Pipeline (\`/pipeline\`)

\*\*Purpose:\*\* Show the exact AI analysis steps as an animated, interactive node graph.

\*\*Layout: Full screen React Flow canvas \+ right side drawer\*\*

\*\*Top toolbar:\*\*  
\- Dropdown to select which crash/binary to view pipeline for  
\- "Re-run Analysis" button  
\- "Auto-layout" toggle  
\- Zoom controls

\*\*React Flow canvas (main area):\*\*

Nodes in order (vertical layout, top to bottom, connected by animated edges):

\`\`\`  
\[1. Input File\]  
     ↓ (animated dashed edge)  
\[2. Binary Inspector\]  
     ↓  
\[3. Crash Trigger Engine\]  
     ↓  
\[4. Stack Trace Parser\]  
     ↓  
\[5. Feature Extractor\]  
     ↓  
\[6. Root Cause Classifier\]  
     ↓  
\[7. CVE Matcher\]  
     ↓  
\[8. Risk Scorer\]  
     ↓  
\[9. Output: RCA Report\]  
\`\`\`

\*\*Node appearance:\*\*  
\- Width: 220px, rounded-xl  
\- Header: stage number \+ name, colour-coded by status  
\- Body: 1–2 line summary of what this stage produced  
\- Status indicator dot: grey (pending), blue pulse (running), green (complete), red (failed)  
\- Click any node → right side drawer slides in (Framer Motion \`motion.div\`)

\*\*Side drawer on node click:\*\*  
\- Node name as header  
\- "Input" section: shows exact data fed into this stage (JSON or text)  
\- "Output" section: shows exact data produced (JSON or text)  
\- "Explanation" section: 2–3 sentences in plain English what this stage does  
\- Close button (X)

\*\*Node content details:\*\*  
1\. Input File — filename, size, type  
2\. Binary Inspector — ELF arch, debug symbols present, library dependencies  
3\. Crash Trigger Engine — GDB command run, exit signal (SIGSEGV/SIGABRT etc.), crash address  
4\. Stack Trace Parser — number of frames extracted, top 5 frames shown  
5\. Feature Extractor — signal type, stack depth, memory region (heap/stack), crash module  
6\. Root Cause Classifier — predicted class, confidence percentage, top 3 candidate classes with probabilities  
7\. CVE Matcher — matched CVE ID (if any), similarity score  
8\. Risk Scorer — CVSS v3 score, vector string  
9\. Output — root cause label, severity, recommended fix category

\*\*Edge style:\*\* Animated dashed lines using React Flow's animated edge type. Blue while running, green when complete.

\*\*Data source:\*\* \`GET /api/pipeline/{analysis\_id}\`

\---

\#\#\# SCREEN 4: Security Intel (\`/security\`)

\*\*Purpose:\*\* Deep security risk assessment of a crash/vulnerability.

\*\*Layout: Two-column \+ bottom section\*\*

\*\*Top selector bar:\*\*  
\- Dropdown: "Select analysed crash" — lists all completed analyses  
\- Auto-selects most recent by default

\*\*Left column (55%)\*\*

Card 1 — CVSS Score Visual  
\- Large circular gauge (SVG, hand-coded or use react-gauge-chart)  
\- Score number in centre (e.g., "7.5"), label below ("HIGH")  
\- Colour changes by severity range  
\- Below gauge: CVSS v3 vector string in monospace

Card 2 — Attack Characteristics Table  
| Property | Value |  
|---|---|  
| Attack Vector | Network / Local / Physical |  
| Attack Complexity | Low / High |  
| Privileges Required | None / Low / High |  
| User Interaction | None / Required |  
| Scope | Unchanged / Changed |

Card 3 — Affected Component  
\- Project name, version, vulnerable file, vulnerable function  
\- CWE category with link (e.g., "CWE-121: Stack-Based Buffer Overflow")  
\- Patch available? YES (green) / NO (red) / UNKNOWN

\*\*Right column (45%)\*\*

Card 4 — CIA Impact  
Three horizontal bars (Recharts):  
\- Confidentiality Impact  
\- Integrity Impact    
\- Availability Impact  
Each scored None/Low/High, visualised as filled bar segments.

Card 5 — NVD Description  
\- Auto-fetched from NVD API using matched CVE ID  
\- CVE ID as header, full description text  
\- Published date, Last modified date  
\- Reference links (clickable)

Card 6 — Similar Vulnerabilities in Dataset  
\- List of other crashes in uploaded dataset with same CWE or same project  
\- Clicking one updates the whole screen to that crash

\*\*Bottom section — Full width\*\*  
Two buttons side by side:  
\- \`🔗 View on NVD\` — opens \`https://nvd.nist.gov/vuln/detail/{CVE\_ID}\` in new tab  
\- \`💥 Open in Exploit Lab\` — navigates to \`/exploit\` with current crash context

\*\*Data source:\*\* \`GET /api/security/{analysis\_id}\`

\---

\#\#\# SCREEN 5: Exploit Lab (\`/exploit\`)

\*\*Purpose:\*\* AI-generated explanation of root cause mechanics \+ minimal PoC reproduction builder.

\*\*IMPORTANT:\*\* Frame this as "Vulnerability Research & Reproduction Lab" in the UI. All output is for security research and responsible disclosure purposes. Display a one-time disclaimer banner on first visit.

\*\*Layout: Three-column\*\*

\*\*Left column (25%) — Crash Context\*\*

Panel 1: Original PoC  
\- Monaco Editor, read-only, syntax highlighted  
\- Language auto-detected from extension (.rb → Ruby, .lua → Lua, etc.)  
\- Line numbers shown  
\- Title: "Original Trigger Input"

Panel 2: Stack Trace  
\- Monospace text area showing raw GDB output  
\- Each frame is a line: \`\#0  crash\_func (args) at file.c:42\`  
\- Frames that are the root cause are highlighted in red

\*\*Centre column (50%) — AI Analysis\*\*

This is the hero of the screen.

Header: "Root Cause Analysis" with purple AI indicator dot

Large card with sections:

\*\*What Failed:\*\*  
Plain English title of the vulnerability (e.g., "Null Pointer Dereference in mruby Dir.open()")

\*\*Why It Happened:\*\*  
3–5 paragraph AI-generated explanation. Cover:  
\- What the PoC does step by step  
\- What internal state the program was in  
\- The exact line/function where failure occurs  
\- Why the program couldn't handle this input

\*\*The Vulnerable Code Path:\*\*  
Numbered list of function calls leading to crash (extracted from stack trace):  
\`\`\`  
1\. Script calls Dir.open(v3)  
2\. → mrb\_dir\_s\_open() at dir.c:48  
3\. → mrb\_str\_ptr() returns NULL (uninitialized)  
4\. → Null dereference → SIGSEGV  
\`\`\`

\*\*Root Cause Category:\*\*  
Large badge: "TYPE CONFUSION" (or whichever applies) with confidence %

\*\*Mitigation:\*\*  
Bullet points:  
\- Immediate fix suggestion  
\- Long-term architectural recommendation  
\- Reference to fix in patched version (if CVE has known patch)

\*\*Right column (25%) — Reproduction Builder\*\*

Title: "Minimal Reproduction"

Panel 1: Environment Requirements  
\- OS/distro needed  
\- Compiler/interpreter version  
\- Required build flags (e.g., \`--with-debug\`)  
\- Any special setup steps

Panel 2: PoC Editor  
\- Monaco Editor, editable  
\- Pre-filled with original PoC  
\- "Generate Minimal PoC" button above — sends to AI to strip to smallest crash-triggering form  
\- Shows AI-generated minimal version below original after clicking

Panel 3: Run Controls  
\- "▶ Run Reproduction" button (red, prominent)  
\- Output terminal below: scrollable, monospace, dark background  
\- Shows: GDB output, crash signal, exit code  
\- "Copy Output" button

Panel 4: Export  
\- "Export as Crash Report" → downloads JSON  
\- "Add to Report Builder" → sends to Report Builder screen

\*\*Data source:\*\*  
\- \`GET /api/exploit/{analysis\_id}\` — gets all context  
\- \`POST /api/exploit/{analysis\_id}/minimise\` — AI minimises PoC  
\- \`POST /api/exploit/{analysis\_id}/run\` — runs reproduction

\---

\#\#\# SCREEN 6: Crash Clusters (\`/clusters\`)

\*\*Purpose:\*\* Visual ML clustering of all crashes by similarity — reveals patterns across the corpus.

\*\*Layout: Filter rail top \+ main plot \+ click details\*\*

\*\*Top filter rail:\*\*  
\- Filter chips: All Projects / NASM / mruby / Lua / libtiff / libsixel  
\- Colour by: Root Cause / Severity / Project (toggle)  
\- Reset filters button

\*\*Main area: Plotly 2D Scatter (t-SNE)\*\*  
\- Each crash \= one dot  
\- Size: proportional to CVSS score (higher \= larger dot)  
\- Colour: based on selected "Colour by" mode  
\- On hover: tooltip showing crash ID, project, root cause, CVSS  
\- On click: right side panel slides in

\*\*Right panel on dot click:\*\*  
\- Crash name (e.g., "libtiff cve-2023-6228")  
\- Root cause label  
\- Severity badge  
\- 2-line summary  
\- "View in Pipeline" button  
\- "View Security Intel" button

\*\*Below scatter plot:\*\*  
Insight cards (AI-generated, static for demo):  
\- "All libsixel CVE-2019-\* crashes cluster together → common root cause: heap overflow in sixel decoder"  
\- "mruby type confusion bugs form a distinct cluster, separate from memory corruption"  
\- "NASM stack overflows are isolated — unique recursive parser architecture"

\*\*Cluster selection:\*\*  
\- Draw a rectangle to select multiple dots  
\- "Analyse Cluster" button appears → shows shared features of selected crashes

\*\*Data source:\*\* \`GET /api/clusters\` — returns t-SNE coordinates \+ metadata for all analysed crashes

\---

\#\#\# SCREEN 7: Timeline (\`/timeline\`)

\*\*Purpose:\*\* Chronological view of vulnerabilities, ordered by CVE year. Shows patterns over time.

\*\*Layout: Full width horizontal timeline \+ event cards\*\*

\*\*Top controls:\*\*  
\- Year range slider (2016 → 2024\)  
\- Filter by project (multi-select chips)  
\- Filter by severity (multi-select chips)

\*\*Main area: Horizontal scrollable SVG timeline\*\*  
\- Horizontal line across the middle  
\- Each vulnerability \= vertical tick mark \+ dot on the line  
\- Dot size: proportional to CVSS score  
\- Dot colour: severity colour  
\- Year markers on the line

\*\*On hover over dot:\*\*  
\- Tooltip: CVE ID, project, severity, root cause

\*\*On click over dot:\*\*  
\- Card expands below the timeline for that CVE:  
  \- CVE ID \+ project  
  \- Severity badge  
  \- Root cause category  
  \- 2-line description  
  \- "View Full Analysis" button → navigates to Security Intel

\*\*Insight panel below timeline:\*\*  
\- "libtiff has had 6 vulnerabilities between 2016–2023 — all in TIFF tag parsing routines"  
\- "mruby vulnerability rate increased post-2021 — likely related to network socket feature additions"

\*\*Data source:\*\* \`GET /api/timeline\` — returns all crashes with their CVE year metadata

\---  
