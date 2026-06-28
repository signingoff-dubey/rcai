import re
from fastapi import APIRouter, HTTPException, Query
from backend.db.database import get_db
from backend.core.nvd_client import fetch_cve_details

router = APIRouter(prefix="/api/cve", tags=["cve"])

_CVE_RE = re.compile(r"^CVE-\d{4}-\d{4,}$", re.IGNORECASE)


def _validate_cve_id(cve_id: str):
    if not _CVE_RE.match(cve_id):
        raise HTTPException(status_code=400, detail="Invalid CVE ID format")


@router.get("/search")
async def search_cves(q: str = Query("")):
    if not q or len(q.strip()) < 2:
        return {"results": []}

    db = await get_db()
    cursor = await db.execute(
        """SELECT a.id, a.cve_id, a.root_cause, a.severity, a.cvss_score, a.summary,
                  f.name as file_name, p.name as project_name
           FROM analyses a
           JOIN files f ON a.file_id = f.id
           JOIN projects p ON f.project_id = p.id
           WHERE (a.cve_id IS NOT NULL AND a.cve_id LIKE ?)
              OR (a.root_cause IS NOT NULL AND a.root_cause LIKE ?)
              OR (a.summary IS NOT NULL AND a.summary LIKE ?)
              OR (f.name IS NOT NULL AND f.name LIKE ?)
           LIMIT 20""",
        (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"),
    )
    local = await cursor.fetchall()
    await db.close()

    nvd_result = None
    try:
        from backend.core.nvd_client import _nvd_keyword_search, fetch_cve_details
        keyword_matches = await _nvd_keyword_search(q)
        if keyword_matches:
            nvd_result = await fetch_cve_details(keyword_matches)
    except Exception:
        pass

    results = []
    for r in local:
        d = dict(r)
        if d.get("cve_id"):
            results.append(d)
    if nvd_result and not any(r.get("cve_id") == nvd_result.get("cve_id") for r in results):
        results.insert(0, {"id": None, **nvd_result})

    return {"results": results}


@router.get("/{cve_id}")
async def lookup_cve(cve_id: str, nvd: bool = Query(False)):
    _validate_cve_id(cve_id)
    if nvd:
        result = await fetch_cve_details(cve_id)
        if result.get("source") == "error":
            result["source"] = "fallback"
            result["description"] = result.get("description", "Could not fetch from NVD.")
        return result

    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM analyses WHERE cve_id = ?", (cve_id,)
    )
    analysis = await cursor.fetchone()
    await db.close()

    if not analysis:
        nvd_result = await fetch_cve_details(cve_id)
        return nvd_result

    result = dict(analysis)
    result["source"] = "local"
    return result


@router.get("")
async def list_cves():
    db = await get_db()
    cursor = await db.execute(
        """SELECT a.id, a.cve_id, a.severity, a.root_cause, a.cvss_score, a.summary,
                  f.name as file_name, p.name as project_name
           FROM analyses a
           JOIN files f ON a.file_id = f.id
           JOIN projects p ON f.project_id = p.id
           WHERE a.cve_id IS NOT NULL
           ORDER BY a.cvss_score DESC"""
    )
    rows = await cursor.fetchall()
    await db.close()
    return [dict(r) for r in rows]
