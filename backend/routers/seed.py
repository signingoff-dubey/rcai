import os
from fastapi import APIRouter
from backend.db.database import get_db

router = APIRouter(prefix="/api/seed", tags=["seed"])

DATASET_DIR = "dataset"

PROJECT_TYPES = {
    "nasm": "NASM", "mruby": "mruby", "lua": "Lua",
    "libtiff": "libtiff", "libsixel": "libsixel",
}

EXT_TYPE_MAP = {
    ".rb": "ruby", ".lua": "lua", ".tiff": "tiff", ".gif": "gif",
    ".cgi": "cgi", ".bin": "binary", ".six": "six",
    ".txt": "text", ".json": "json", ".csv": "csv", ".xlsx": "xlsx",
    ".docx": "docx", ".md": "markdown",
}


def _detect_project_type(folder_name: str) -> str:
    lower = folder_name.lower()
    for key, name in PROJECT_TYPES.items():
        if key in lower:
            return name
    return "Unknown"


def _detect_file_type(fname: str) -> str:
    _, ext = os.path.splitext(fname)
    if not ext and "." not in fname:
        return "binary"
    return EXT_TYPE_MAP.get(ext.lower(), "binary")


@router.post("")
async def seed_dataset():
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) as c FROM files")
    row = await cursor.fetchone()
    if row and row["c"] > 0:
        await db.close()
        return {"status": "already_seeded", "count": row["c"]}

    if not os.path.isdir(DATASET_DIR):
        await db.close()
        return {"status": "error", "message": f"Dataset directory '{DATASET_DIR}' not found"}

    entries = sorted(os.listdir(DATASET_DIR))
    type_projects = {}

    for entry in entries:
        full_path = os.path.join(DATASET_DIR, entry)
        if not os.path.isdir(full_path):
            continue

        project_type = _detect_project_type(entry)
        if project_type not in type_projects:
            cursor = await db.execute(
                "INSERT INTO projects (name) VALUES (?)", (project_type,)
            )
            await db.commit()
            type_projects[project_type] = cursor.lastrowid

        project_id = type_projects[project_type]

        for fname in os.listdir(full_path):
            fpath = os.path.join(full_path, fname)
            if not os.path.isfile(fpath):
                continue

            file_type = _detect_file_type(fname)
            fsize = os.path.getsize(fpath)

            await db.execute(
                "INSERT INTO files (project_id, folder_name, name, path, file_type, size) VALUES (?, ?, ?, ?, ?, ?)",
                (project_id, entry, fname, fpath, file_type, fsize),
            )
        await db.commit()

    await db.close()

    project_count = len(type_projects)
    cursor = await db.execute("SELECT COUNT(*) as c FROM files")
    total_files = (await cursor.fetchone())["c"]

    return {
        "status": "seeded",
        "projects": project_count,
        "files": total_files,
    }
