from fastapi import APIRouter
from backend.db.database import get_db

router = APIRouter(prefix="/api/analyses", tags=["analyses"])


@router.get("")
async def list_analyses():
    db = await get_db()
    cursor = await db.execute("""
        SELECT a.*, f.name as file_name, f.file_type, p.name as project_name
        FROM analyses a
        JOIN files f ON a.file_id = f.id
        JOIN projects p ON f.project_id = p.id
        ORDER BY a.created_at DESC
    """)
    rows = await cursor.fetchall()
    await db.close()
    return [dict(r) for r in rows]
