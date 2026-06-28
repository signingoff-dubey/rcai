import hashlib
import json
import math
from fastapi import APIRouter
from backend.db.database import get_db
from backend.core.groq_client import groq_chat

router = APIRouter(prefix="/api/clusters", tags=["clusters"])


def _compute_layout(analyses: list[dict]) -> list[list[float]]:
    """Place each crash so crashes sharing a root cause form a visible cluster.

    t-SNE on the 3 low-cardinality features available here (severity, CVSS,
    cause index) produced noisy, misleading blobs and the previous length-keyed
    cache silently reused stale coordinates after re-analysis. Instead we lay out
    one cluster centre per distinct root cause around a circle and scatter each
    crash deterministically (by id) within its cluster — the position now
    truthfully encodes the real classification and is stable across requests.
    """
    if not analyses:
        return []

    causes = sorted({(a.get("root_cause") or "Unknown") for a in analyses})
    n = len(causes)
    radius = 10.0
    centres = {}
    for i, cause in enumerate(causes):
        angle = 2 * math.pi * i / n if n else 0.0
        # A single cluster sits at the origin; multiple spread around a circle.
        cx = radius * math.cos(angle) if n > 1 else 0.0
        cy = radius * math.sin(angle) if n > 1 else 0.0
        centres[cause] = (cx, cy)

    coords = []
    for a in analyses:
        cx, cy = centres.get(a.get("root_cause") or "Unknown", (0.0, 0.0))
        h = int(hashlib.md5(str(a.get("id")).encode()).hexdigest(), 16)
        # Even disc fill: sqrt for uniform density, separate hash slice for angle.
        r = 2.6 * math.sqrt((h % 1000) / 1000.0)
        theta = 2 * math.pi * ((h // 1000 % 1000) / 1000.0)
        coords.append([round(cx + r * math.cos(theta), 4),
                       round(cy + r * math.sin(theta), 4)])
    return coords


@router.get("")
async def get_clusters():
    db = await get_db()
    cursor = await db.execute("""
        SELECT a.id, a.root_cause, a.severity, a.cvss_score, a.cve_id,
               a.summary, f.name as file_name, f.folder_name,
               p.name as project
        FROM analyses a
        JOIN files f ON a.file_id = f.id
        LEFT JOIN projects p ON f.project_id = p.id
        WHERE a.status = 'completed' AND a.root_cause IS NOT NULL
    """)
    rows = await cursor.fetchall()
    await db.close()

    analyses = [dict(r) for r in rows]
    coords = _compute_layout(analyses)

    clusters = []
    for i, a in enumerate(analyses):
        coord = coords[i] if i < len(coords) else [0.0, 0.0]
        clusters.append({
            "id": a.get("id"),
            "file_name": a.get("file_name"),
            "folder_name": a.get("folder_name"),
            "project": a.get("project") or "Unknown",
            "root_cause": a.get("root_cause"),
            "severity": a.get("severity"),
            "cvss_score": a.get("cvss_score"),
            "cve_id": a.get("cve_id"),
            "summary": a.get("summary", ""),
            "tsne_x": coord[0],
            "tsne_y": coord[1],
        })

    insights = []
    if analyses:
        try:
            summary_data = [
                {"id": c["id"], "file": c["file_name"], "cause": c["root_cause"],
                 "severity": c["severity"], "cvss": c["cvss_score"], "cve": c["cve_id"]}
                for c in clusters[:15]
            ]
            prompt = (
                f"Analyse these {len(clusters)} crash clusters:\n"
                + json.dumps(summary_data, indent=2)
                + "\n\nReturn a JSON array of 2-3 insight strings. Each insight should identify a pattern: "
                  "common root cause across files, project-level trend, or severity concentration. "
                  "Be specific about project names and counts. Output only the JSON array."
            )
            result = await groq_chat(
                "You are a crash data analyst. Identify cluster patterns by comparing root causes, projects, and severity. Output only JSON array of strings.",
                prompt,
                temperature=0.1,
                max_tokens=512,
            )
            import re
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip(), flags=re.MULTILINE)
            match = re.search(r"\[.*\]", cleaned, re.DOTALL)
            parsed = json.loads(match.group(0) if match else cleaned)
            if isinstance(parsed, list):
                insights = [str(s) for s in parsed[:3]]
        except Exception:
            pass

    if not insights:
        cause_counts = {}
        for c in clusters:
            cause = c.get("root_cause") or "Unknown"
            cause_counts[cause] = cause_counts.get(cause, 0) + 1
        top_causes = sorted(cause_counts.items(), key=lambda x: -x[1])[:3]
        insights = [
            f"{count} crashes classified as {cause}" for cause, count in top_causes
        ] if top_causes else ["No cluster patterns identified yet"]

    return {
        "clusters": clusters,
        "insights": insights,
    }
