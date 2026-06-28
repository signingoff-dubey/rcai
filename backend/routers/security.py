from fastapi import APIRouter, HTTPException
from backend.db.database import get_db

router = APIRouter(prefix="/api/security", tags=["security"])

ATTACK_VECTORS = {
    "Stack Overflow": ("Local", "Low", "None", "None", "Unchanged"),
    "Heap Buffer Overflow": ("Network", "Low", "None", "None", "Changed"),
    "Use-After-Free": ("Network", "Low", "None", "Required", "Unchanged"),
    "Type Confusion": ("Network", "High", "None", "Required", "Unchanged"),
    "Null Pointer Dereference": ("Local", "Low", "None", "None", "Unchanged"),
    "Integer Overflow": ("Network", "Low", "None", "Required", "Changed"),
    "Out-of-Bounds Read": ("Network", "Low", "None", "None", "Unchanged"),
    "Double Free": ("Network", "Low", "None", "Required", "Unchanged"),
    "Memory Leak": ("Local", "Low", "Low", "None", "Unchanged"),
    "Format String Bug": ("Network", "High", "None", "None", "Changed"),
}

CIA_MAP = {
    "Stack Overflow": (1, 1, 2),
    "Heap Buffer Overflow": (2, 2, 2),
    "Use-After-Free": (2, 2, 1),
    "Type Confusion": (2, 1, 1),
    "Null Pointer Dereference": (0, 0, 2),
    "Integer Overflow": (1, 1, 1),
    "Out-of-Bounds Read": (2, 0, 0),
    "Double Free": (2, 1, 2),
    "Memory Leak": (0, 0, 1),
    "Format String Bug": (2, 2, 2),
}

CIA_LABELS = ["None", "Low", "High"]

CWE_MAP = {
    "Stack Overflow": ("CWE-121", "Stack-based Buffer Overflow"),
    "Heap Buffer Overflow": ("CWE-122", "Heap-based Buffer Overflow"),
    "Use-After-Free": ("CWE-416", "Use After Free"),
    "Type Confusion": ("CWE-843", "Type Confusion"),
    "Null Pointer Dereference": ("CWE-476", "NULL Pointer Dereference"),
    "Integer Overflow": ("CWE-190", "Integer Overflow or Wraparound"),
    "Out-of-Bounds Read": ("CWE-125", "Out-of-bounds Read"),
    "Double Free": ("CWE-415", "Double Free"),
    "Memory Leak": ("CWE-401", "Missing Release of Memory"),
    "Format String Bug": ("CWE-134", "Use of Externally-Controlled Format String"),
}


@router.get("/{analysis_id}")
async def get_security_intel(analysis_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    analysis = await cursor.fetchone()
    if not analysis:
        await db.close()
        raise HTTPException(status_code=404, detail="Analysis not found")

    root_cause = analysis["root_cause"] or "Unknown"
    attack_vec = ATTACK_VECTORS.get(root_cause, ("Local", "Low", "None", "None", "Unchanged"))
    cia = CIA_MAP.get(root_cause, (0, 0, 1))
    cwe = CWE_MAP.get(root_cause, (None, None))

    cursor = await db.execute("""
        SELECT a.id, a.root_cause, a.severity, a.cvss_score, a.cve_id, a.summary,
               f.name as file_name
        FROM analyses a JOIN files f ON a.file_id = f.id
        WHERE a.id != ? AND (a.root_cause = ? OR a.cve_id IS NOT NULL)
        LIMIT 5
    """, (analysis_id, root_cause))
    similar = await cursor.fetchall()

    await db.close()

    result = dict(analysis)
    result["attack_vector"] = attack_vec[0]
    result["attack_complexity"] = attack_vec[1]
    result["privileges_required"] = attack_vec[2]
    result["user_interaction"] = attack_vec[3]
    result["scope"] = attack_vec[4]
    result["cia"] = {
        "confidentiality": CIA_LABELS[cia[0]],
        "integrity": CIA_LABELS[cia[1]],
        "availability": CIA_LABELS[cia[2]],
    }
    result["cwe_id"] = cwe[0]
    result["cwe_description"] = cwe[1]
    result["similar_vulnerabilities"] = [dict(s) for s in similar]

    return result
