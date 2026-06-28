import os
import shutil
import zipfile
import re
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.db.database import get_db
from backend.core.cache import db_cache

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = "backend/uploads"
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_EXTS = {".rb", ".lua", ".tiff", ".gif", ".cgi", ".bin", ".six", ".py", ".txt", ".json", ".csv", ".md", ".zip"}
EXT_TYPE_MAP = {
    ".rb": "ruby", ".lua": "lua", ".tiff": "tiff", ".gif": "gif",
    ".cgi": "cgi", ".bin": "binary", ".six": "six", ".py": "python",
    ".txt": "text", ".json": "json", ".csv": "csv", ".md": "markdown",
}
MAGIC_BYTES = {
    b"\x7fELF": "binary",
    b"\x89PNG": "image",
    b"\xff\xd8\xff": "image",
    b"GIF8": "image",
}


def _sanitize_filename(name: str) -> str:
    name = Path(name).name
    name = re.sub(r'[^\w\.\-\(\) ]', '_', name)
    name = name.strip()
    return name or "unknown"


def _detect_file_type(fname: str, content: bytes = b"") -> str:
    for magic, ftype in MAGIC_BYTES.items():
        if content[:len(magic)] == magic:
            return ftype if ftype != "image" else "binary"
    _, ext = os.path.splitext(fname)
    return EXT_TYPE_MAP.get(ext.lower(), "binary")


def _check_zip_slip(path: str, extract_dir: str):
    abs_extract = os.path.realpath(extract_dir)
    abs_entry = os.path.realpath(path)
    if not abs_entry.startswith(abs_extract + os.sep) and abs_entry != abs_extract:
        raise HTTPException(status_code=400, detail="Invalid zip entry path")


def _ensure_project(project_name: str, db) -> int:
    cursor = db.execute("SELECT id FROM projects WHERE name = ?", (project_name,))
    row = cursor.fetchone()
    if row:
        return row["id"]
    cursor = db.execute("INSERT INTO projects (name) VALUES (?)", (project_name,))
    db.commit()
    return cursor.lastrowid


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    filename = _sanitize_filename(file.filename or "unknown")

    if not filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    if filename.lower().endswith(".zip"):
        zip_path = os.path.join(UPLOAD_DIR, filename)
        with open(zip_path, "wb") as f:
            f.write(content)

        extract_dir = os.path.join(UPLOAD_DIR, filename.replace(".zip", ""))
        os.makedirs(extract_dir, exist_ok=True)

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                for entry in zf.namelist():
                    _check_zip_slip(os.path.join(extract_dir, entry), extract_dir)
                zf.extractall(extract_dir)
        except zipfile.BadZipFile:
            os.remove(zip_path)
            shutil.rmtree(extract_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail="Invalid or corrupted zip file")

        db = await get_db()
        project_name = filename.replace(".zip", "").replace("_", " ").replace("-", " ").title()
        project_id = _ensure_project(project_name, db)

        total = 0
        for root, dirs, fnames in os.walk(extract_dir):
            folder_name = os.path.basename(root)
            for fname in fnames:
                fpath = os.path.join(root, fname)
                fsize = os.path.getsize(fpath)
                with open(fpath, "rb") as f:
                    header = f.read(16)
                file_type = _detect_file_type(fname, header)
                rel_folder = os.path.relpath(root, extract_dir)
                db.execute(
                    "INSERT INTO files (project_id, folder_name, name, path, file_type, size, is_new) VALUES (?, ?, ?, ?, ?, ?, 1)",
                    (project_id, rel_folder, fname, fpath, file_type, fsize),
                )
                total += 1
        db.commit()
        db.close()
        os.remove(zip_path)
        return {"status": "extracted", "project": project_name, "files": total}

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    file_type = _detect_file_type(filename, content[:16])
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    db = await get_db()
    project_name = "Uploads"
    project_id = _ensure_project(project_name, db)

    cursor = await db.execute(
        "INSERT INTO files (project_id, name, path, file_type, size, is_new) VALUES (?, ?, ?, ?, ?, 1)",
        (project_id, filename, file_path, file_type, len(content)),
    )
    await db.commit()
    file_id = cursor.lastrowid
    await db.close()
    db_cache.clear()

    return {
        "id": file_id,
        "name": filename,
        "type": file_type,
        "size": len(content),
        "project": project_name,
    }