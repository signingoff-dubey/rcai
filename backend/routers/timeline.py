import re
from fastapi import APIRouter
from backend.db.database import get_db

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


def _cve_year(*sources) -> int:
    """Real vulnerability year from a CVE id or folder name (e.g.
    'cve-2017-7595' -> 2017); falls back to the most recent corpus year."""
    for s in sources:
        if not s:
            continue
        m = re.search(r"cve[-_\s]?(\d{4})", str(s), re.IGNORECASE)
        if m:
            y = int(m.group(1))
            if 1999 <= y <= 2026:
                return y
    return 2024


@router.get("")
async def get_timeline():
    db = await get_db()
    cursor = await db.execute("""
        SELECT a.id, a.cve_id, a.severity, a.root_cause, a.cvss_score,
               a.summary, a.created_at, f.name as file_name, f.is_new, p.name as project_name
        FROM analyses a
        JOIN files f ON a.file_id = f.id
        JOIN projects p ON f.project_id = p.id
        WHERE a.cve_id IS NOT NULL OR a.root_cause IS NOT NULL
        ORDER BY a.created_at DESC
    """)
    rows = await cursor.fetchall()
    await db.close()
    return [dict(r) for r in rows]


@router.get("/events")
async def get_timeline_events():
    db = await get_db()
    cursor = await db.execute("""
        SELECT a.id, a.cve_id, a.severity, a.root_cause, a.cvss_score,
               a.summary, a.created_at, f.name as file_name, f.folder_name,
               f.is_new, p.name as project_name
        FROM analyses a
        JOIN files f ON a.file_id = f.id
        JOIN projects p ON f.project_id = p.id
        WHERE a.status = 'completed'
        ORDER BY a.created_at DESC
    """)
    rows = await cursor.fetchall()
    await db.close()

    events = []
    project_cves = {}
    for r in rows:
        row = dict(r)
        year = _cve_year(row.get("cve_id"), row.get("folder_name"))
        row["year"] = year

        project = row.get("project_name", "Unknown")
        if project not in project_cves:
            project_cves[project] = []
        project_cves[project].append(row)

        events.append({
            "year": year,
            "id": row.get("cve_id") or f"ANALYSIS-{row['id']}",
            "analysis_id": row["id"],
            "project": project,
            "severity": row.get("severity", "Info"),
            "cause": row.get("root_cause", "Unknown"),
            "cvss_score": row.get("cvss_score"),
            "desc": row.get("summary", "No description"),
        })

    insights = []
    for proj, cves in project_cves.items():
        severities = [c.get("severity", "Info") for c in cves if c.get("severity")]
        causes = [c.get("root_cause", "Unknown") for c in cves if c.get("root_cause")]
        if severities:
            high_count = sum(1 for s in severities if s in ("Critical", "High"))
            dominant_cause = max(set(causes), key=causes.count) if causes else "Unknown"
            years = [c.get("year") for c in cves if c.get("year")]
            year_range = f"{min(years)}-{max(years)}" if years else "N/A"
            severity_note = f"{high_count}/{len(severities)} high-severity" if high_count else "all moderate/low"
            insights.append(
                f"{proj} — {len(cves)} vulnerabilities ({year_range}), {severity_note}, "
                f"dominant root cause: {dominant_cause}"
            )

    if not insights:
        insights = [
            "Upload crash datasets and run analysis to generate timeline insights",
            "Timeline visualises vulnerabilities ordered by CVE year across projects",
        ]

    return {"events": events, "insights": insights}
