import json
from fastapi import APIRouter
from backend.db.database import get_db
from backend.core.groq_client import groq_chat

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary():
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) as count FROM files")
    total_files = (await cursor.fetchone())["count"]

    cursor = await db.execute("SELECT COUNT(*) as count FROM analyses WHERE cve_id IS NOT NULL")
    cves_identified = (await cursor.fetchone())["count"]

    cursor = await db.execute("SELECT MAX(cvss_score) as max_score FROM analyses")
    row = await cursor.fetchone()
    max_cvss = row["max_score"] if row and row["max_score"] else None

    cursor = await db.execute("SELECT COUNT(DISTINCT project_id) as count FROM files")
    projects = (await cursor.fetchone())["count"]

    cursor = await db.execute("""
        SELECT severity, COUNT(*) as count FROM analyses
        WHERE severity IS NOT NULL GROUP BY severity
    """)
    severity_rows = await cursor.fetchall()
    severity_dist = {row["severity"]: row["count"] for row in severity_rows}

    cursor = await db.execute("""
        SELECT root_cause, COUNT(*) as count FROM analyses
        WHERE root_cause IS NOT NULL GROUP BY root_cause ORDER BY count DESC
    """)
    cause_rows = await cursor.fetchall()
    root_causes = [{"cause": row["root_cause"], "count": row["count"]} for row in cause_rows]

    cursor = await db.execute("""
        SELECT a.id, a.root_cause, a.severity, a.cvss_score, a.cve_id,
               a.summary, a.created_at, a.status, f.name as file_name, f.is_new
        FROM analyses a JOIN files f ON a.file_id = f.id
        ORDER BY a.created_at DESC LIMIT 10
    """)
    activity = [dict(r) for r in await cursor.fetchall()]

    cursor = await db.execute("SELECT COUNT(*) as count FROM files WHERE is_new = 1")
    new_files = (await cursor.fetchone())["count"]

    cursor = await db.execute("SELECT COUNT(*) as count FROM analyses WHERE status = 'running'")
    running = (await cursor.fetchone())["count"]

    cursor = await db.execute("SELECT COUNT(*) as count FROM files WHERE analysed = 0 AND is_new = 0")
    pending = (await cursor.fetchone())["count"]

    cursor = await db.execute("SELECT COUNT(*) as count FROM analyses WHERE status = 'completed'")
    completed = (await cursor.fetchone())["count"]

    cursor = await db.execute("SELECT COUNT(DISTINCT project_id) as prev FROM files WHERE created_at < datetime('now', '-7 days')")
    prev_projects = (await cursor.fetchone())["prev"]
    cursor = await db.execute("SELECT COUNT(*) as prev FROM analyses WHERE created_at < datetime('now', '-7 days')")
    prev_analyses = (await cursor.fetchone())["prev"]

    await db.close()

    delta_crashes = completed - prev_analyses if prev_analyses > 0 else 0
    delta_cves = cves_identified - prev_analyses if prev_analyses > 0 else 0
    delta_projects = projects - prev_projects if prev_projects > 0 else 0

    return {
        "totalCrashes": total_files,
        "cvesIdentified": cves_identified,
        "highestCvss": max_cvss,
        "projectsInWorkspace": projects,
        "severityDistribution": severity_dist,
        "rootCauseDistribution": root_causes,
        "recentActivity": activity,
        "deltas": {
            "crashes": delta_crashes,
            "cves": delta_cves,
            "projects": delta_projects,
        },
        "statusBreakdown": {
            "new": new_files,
            "pending": pending,
            "running": running,
            "completed": completed,
        },
    }


@router.get("/insights")
async def dashboard_insights():
    db = await get_db()
    cursor = await db.execute("""
        SELECT p.name as project, COUNT(a.id) as analysed,
               SUM(CASE WHEN a.severity IN ('Critical','High') THEN 1 ELSE 0 END) as high_sev,
               GROUP_CONCAT(DISTINCT a.root_cause) as causes
        FROM projects p
        JOIN files f ON f.project_id = p.id
        LEFT JOIN analyses a ON a.file_id = f.id AND a.status = 'completed'
        GROUP BY p.id
    """)
    project_stats = [dict(r) for r in await cursor.fetchall()]
    await db.close()

    try:
        prompt = (
            f"Analyse this project crash data and return 2-3 factual insights as a JSON array of strings:\n\n"
            + json.dumps(project_stats, indent=2)
            + "\n\nEach insight should state a concrete finding. Output only the JSON array."
        )
        result = await groq_chat(
            "You are a data analyst summarizing project-level security analysis results. Output only a JSON array of strings.",
            prompt,
            temperature=0.1,
            max_tokens=256,
        )
        import re
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip(), flags=re.MULTILINE)
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        parsed = json.loads(match.group(0) if match else cleaned)
        return {"insights": parsed if isinstance(parsed, list) else [str(parsed)]}
    except Exception:
        total_analysed = sum(p.get("analysed") or 0 for p in project_stats)
        total_high = sum(p.get("high_sev") or 0 for p in project_stats)
        project_names = [p["project"] for p in project_stats if p.get("analysed")]
        insights = []
        if project_names:
            insights.append(f"{len(project_names)} projects in workspace: {', '.join(project_names)}")
        if total_analysed:
            insights.append(f"{total_analysed} analyses completed, {total_high} high-severity findings")
        if not insights:
            insights = ["Upload data and run analysis to generate insights"]
        return {"insights": insights}
