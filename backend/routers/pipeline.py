from fastapi import APIRouter, HTTPException
from backend.db.database import get_db

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("/{analysis_id}")
async def get_pipeline(analysis_id: int):
    db = await get_db()

    cursor = await db.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    analysis = await cursor.fetchone()
    if not analysis:
        await db.close()
        raise HTTPException(status_code=404, detail="Analysis not found")

    cursor = await db.execute(
        "SELECT * FROM pipeline_stages WHERE analysis_id = ? ORDER BY stage_number",
        (analysis_id,),
    )
    stages = await cursor.fetchall()
    await db.close()

    return {
        "analysis": dict(analysis),
        "stages": [dict(s) for s in stages],
    }
