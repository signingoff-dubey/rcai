# RCAi — Project Pitch

> Built for the IEEE DataPort Hackathon, Problem Statement #12: Software Failure Root Cause Analysis

---

## One-Line Pitch

RCAi turns a folder of raw crash artifacts (ELF binaries + fuzzer trigger files) into an explained, scored, CVE-linked root cause report through a 9-stage AI pipeline, all in a single dark-themed dashboard.

---

## The Problem

When a fuzzer finds a crash, an engineer is left with the hard part: a binary, a tiny input file that triggers it, and a signal like SIGSEGV. Answering "what actually went wrong, how bad is it, and is it a known CVE?" is slow, manual, and needs deep expertise in GDB, memory corruption classes, and CVSS scoring.

A modern fuzzing campaign produces thousands of these. Triage does not scale. Crashes get deduplicated by shallow signals, severity is guessed, and the link to existing CVEs is missed. Real vulnerabilities sit unread in crash corpora.

---

## Our Solution

RCAi ingests a crash dataset and runs every crash through an explainable pipeline that mirrors how a security researcher triages by hand:

1. **Input File** — register the trigger artifact
2. **Binary Inspector** — parse real ELF headers (arch, class, entry point, linked libs, debug symbols)
3. **Crash Trigger Engine** — execute under GDB, capture signal + fault address
4. **Stack Trace Parser** — extract and deduplicate frames with Drain3
5. **Feature Extractor** — signal type, stack depth, memory region, crash module
6. **Root Cause Classifier** — Groq LLM (Llama 3.3 70B) with an evidence-based heuristic fallback
7. **CVE Matcher** — link to the real CVE and enrich from the live NVD API
8. **Risk Scorer** — CVSS v3 base score + vector + severity band
9. **RCA Report** — root cause, severity, fix category, exportable as JSON / Markdown / PDF

Every stage is clickable in the Pipeline view and shows its exact input, output, and a plain-English explanation. Nothing is a black box.

---

## Key Features

- **9-stage explainable pipeline** rendered as an interactive node graph (React Flow) with per-stage I/O drawers
- **AI root cause classification** into 10 vulnerability classes with confidence scores
- **Live CVE enrichment** from the NVD API, using ground-truth CVE ids carried in the dataset
- **CVSS v3 scoring** with attack vector, CIA impact, and CWE mapping per crash
- **Crash Clusters** — crashes grouped by root cause on a 2D scatter, colourable by severity / cause / project
- **Timeline** — vulnerabilities placed on their real CVE year (2016 to 2024), revealing per-project trends
- **Exploit / Research Lab** — plain-English "why it failed", vulnerable code path, mitigations, and a minimal-PoC reducer
- **Report Builder** — one-click JSON, Markdown, and PDF export of any analysis
- **Security Intel** — gauge, attack characteristics, similar-vulnerability lookup across the corpus

---

## Target Audience

- **Security researchers and fuzzing teams** triaging large crash corpora
- **Maintainers** of C / C++ projects (parsers, codecs, interpreters) who receive fuzz reports
- **Hackathon judges and educators** who want crash analysis made legible
- **Incident responders** who need fast severity and CVE context on a crash

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Visualisation | React Flow (pipeline), Recharts (charts), Plotly (clusters), Monaco (code) |
| State / HTTP | Zustand, Axios |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI | Groq (Llama 3.3 70B) + scikit-learn RandomForest fallback |
| Analysis | pygdbmi (GDB), Drain3 (log templating), custom ELF parser, NetworkX |
| Data | SQLite via aiosqlite, NVD REST API v2.0 |
| Reports | fpdf2 (PDF), Markdown, JSON |

---

## Why Us / Why Now

Fuzzing is now standard (OSS-Fuzz, AFL++, libFuzzer), so crash volume has exploded, but triage is still manual. LLMs are finally good enough to explain memory-corruption mechanics in plain language, and Groq makes that fast enough to feel interactive. RCAi pairs that LLM reasoning with deterministic tooling (real ELF parsing, GDB signals, CVSS math, NVD lookups) so the output is both readable and grounded. It is the explainability layer fuzzing has been missing.

---

## Demo Flow (90 seconds)

1. **File Explorer** — the loaded corpus: NASM, mruby, Lua, libtiff, libsixel crashes
2. Click a binary, hit **Analyse** — watch the 9-stage pipeline animate to completion
3. **Pipeline** — open a node drawer to show real ELF metadata and the classifier's confidence
4. **Security Intel** — CVSS gauge, CWE, and the matched CVE pulled live from NVD
5. **Crash Clusters** — same root causes group together; recolour by project
6. **Timeline** — the corpus spread across real CVE years 2016 to 2024
7. **Report Builder** — export a PDF report and open it

---

## Honest Engineering Notes (we believe in disclosure)

- On Windows demo machines without GDB, the Crash Trigger Engine uses **project-accurate synthetic crash scenarios** (per-binary, deterministic). On Linux with GDB present it runs the real debugger. The rest of the pipeline (ELF parsing, CVE lookup, CVSS, NVD) is fully live either way.
- The Exploit Lab reproduction output is **AI-simulated** GDB output, framed explicitly as a research aid, not a live exploit runner.
- When the Groq free tier rate-limits during bulk runs, classification falls back to a transparent evidence-based heuristic (signal + fault address + top stack frame), so results stay varied and meaningful.

---

## Anticipated Judge Questions (Q&A)

**Q: Is the AI just guessing, or is it grounded?**
A: Grounded. The LLM only classifies; everything around it is deterministic, real ELF header parsing, real GDB signals, real CVSS v3 math, and CVE data fetched live from the NVD API. If the LLM is unavailable we fall back to an explainable rule-based triage, never a random guess.

**Q: How do you match a crash to a CVE accurately?**
A: The dataset folders carry the ground-truth CVE id (for example `libtiff cve-2017-7595`). We extract it and enrich from NVD for the real description, score, and references. For crashes without a labelled CVE we attempt an NVD keyword match and otherwise report "no match" rather than inventing one.

**Q: What stops this from being a black box?**
A: The Pipeline screen exposes all 9 stages. Click any node and you see its exact input JSON, output JSON, and a plain-English explanation. Judges can audit how a verdict was reached.

**Q: How is severity scored?**
A: Each root cause maps to a CVSS v3 base vector (attack vector, complexity, privileges, CIA impact), adjusted by classifier confidence, then bucketed into Critical / High / Medium / Low / Info. We also surface the CWE id (for example CWE-121 for stack overflow).

**Q: Does it actually run the binaries?**
A: Yes, where GDB is available (Linux). On a Windows demo box without GDB we use deterministic, project-accurate synthetic scenarios so the pipeline still demonstrates correctly. We disclose this rather than hide it.

**Q: How does it scale to thousands of crashes?**
A: The pipeline is per-crash and idempotent, results persist in SQLite, and we cache DB queries, NVD responses, and LLM calls. A batch endpoint analyses new uploads. The architecture is async (FastAPI + aiosqlite + httpx).

**Q: What about security of the tool itself?**
A: We hardened uploads against path traversal and Zip Slip, enforce size and magic-byte validation, validate CVE id format before any outbound API call (SSRF guard), strip internal paths and tracebacks from responses, rate-limit endpoints, and set standard security headers.

**Q: Why these five projects (NASM, mruby, Lua, libtiff, libsixel)?**
A: They span the common vulnerability surface: an assembler, two language VMs, and two image libraries, covering stack overflows, heap corruption, use-after-free, type confusion, integer overflow, and out-of-bounds reads. It proves the classifier generalises across very different codebases.

**Q: What is the clustering actually showing?**
A: Crashes are laid out so those sharing a root cause form a visible group, with marker size scaled to CVSS. It reveals patterns such as "all libsixel decoder crashes share a heap-overflow signature," which is exactly the deduplication insight a triage team wants.

**Q: What would you build next?**
A: Real sandboxed GDB execution in a Linux container for every analysis, automated minimal-PoC reduction verified by re-running the crash, patch suggestion via diff against upstream fixes, and multi-user workspaces.

**Q: How much is off-the-shelf vs. built by you?**
A: Libraries do the plumbing (FastAPI, React, Plotly). We built the 9-stage orchestration, the custom dependency-free ELF parser, the classifier prompt + heuristic fallback, the CVSS/CWE/CIA modelling, the CVE extraction and NVD enrichment, the clustering layout, and the entire dashboard.

---

## Team

Add team member names, roles, and contact here before presenting.
