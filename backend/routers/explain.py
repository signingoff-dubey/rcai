import os
from fastapi import APIRouter, HTTPException
from backend.db.database import get_db
from backend.core.groq_client import groq_chat

router = APIRouter(prefix="/api/explain", tags=["explain"])


@router.post("/{file_id}")
async def explain_file(file_id: int):
    db = await get_db()
    cursor = await db.execute(
        "SELECT f.*, p.name as project_name FROM files f JOIN projects p ON f.project_id = p.id WHERE f.id = ?",
        (file_id,),
    )
    row = await cursor.fetchone()
    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="File not found")

    file_path = row["path"]
    content = ""
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()[:4000]
        except Exception:
            pass

    name = row["name"]
    file_type = row["file_type"]
    project = row["project_name"]
    size = row["size"]

    prompt = (
        f"File: {name}\nType: {file_type}\nProject: {project}\nSize: {size} bytes\n\n"
        f"Content:\n{content or '(binary or empty file)'}\n\n"
        f"Explain what this file does in 2-3 plain English sentences. "
        f"If it's a crash PoC (proof of concept), describe what vulnerability it triggers "
        f"and how. If it's a binary, describe what the tool does. "
        f"Be specific and technical but readable. Output ONLY the explanation text."
    )

    try:
        explanation = await groq_chat(
            "You are a software analyst that explains files in plain English. "
            "Output only the explanation text, no JSON, no preamble.",
            prompt,
            temperature=0.1,
            max_tokens=512,
        )
    except Exception:
        explanation = f"This is a {file_type} file from the {project} project ({size} bytes). Run analysis for detailed breakdown."

    await db.close()
    return {"file_id": file_id, "explanation": explanation.strip()}
