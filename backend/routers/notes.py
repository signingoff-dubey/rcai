from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.db.database import get_db

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    note: str


@router.get("/{analysis_id}")
async def get_notes(analysis_id: int):
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM analysis_notes WHERE analysis_id = ? ORDER BY created_at DESC",
        (analysis_id,),
    )
    rows = await cursor.fetchall()
    await db.close()
    return [dict(r) for r in rows]


@router.post("/{analysis_id}")
async def create_note(analysis_id: int, body: NoteCreate):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO analysis_notes (analysis_id, note) VALUES (?, ?)",
        (analysis_id, body.note),
    )
    note_id = cursor.lastrowid
    await db.commit()
    cursor = await db.execute("SELECT * FROM analysis_notes WHERE id = ?", (note_id,))
    note = await cursor.fetchone()
    await db.close()
    return dict(note)


@router.put("/{note_id}")
async def update_note(note_id: int, body: NoteCreate):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM analysis_notes WHERE id = ?", (note_id,))
    existing = await cursor.fetchone()
    if not existing:
        await db.close()
        raise HTTPException(status_code=404, detail="Note not found")
    await db.execute(
        "UPDATE analysis_notes SET note = ?, updated_at = datetime('now') WHERE id = ?",
        (body.note, note_id),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM analysis_notes WHERE id = ?", (note_id,))
    note = await cursor.fetchone()
    await db.close()
    return dict(note)


@router.delete("/{note_id}")
async def delete_note(note_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM analysis_notes WHERE id = ?", (note_id,))
    existing = await cursor.fetchone()
    if not existing:
        await db.close()
        raise HTTPException(status_code=404, detail="Note not found")
    await db.execute("DELETE FROM analysis_notes WHERE id = ?", (note_id,))
    await db.commit()
    await db.close()
    return {"status": "deleted", "id": note_id}
