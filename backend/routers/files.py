import os
import struct
from fastapi import APIRouter, HTTPException
from backend.db.database import get_db
from backend.core.cache import db_cache

router = APIRouter(prefix="/api/files", tags=["files"])


def _parse_elf_metadata(file_path: str) -> dict:
    try:
        with open(file_path, "rb") as f:
            magic = f.read(4)
            if magic != b"\x7fELF":
                return None

            f.seek(4)
            elf_class = f.read(1)
            endianness = f.read(1)

            cls_str = "ELF32" if elf_class == b"\x01" else "ELF64" if elf_class == b"\x02" else "Unknown"
            end_str = "Little Endian" if endianness == b"\x01" else "Big Endian" if endianness == b"\x02" else "Unknown"

            if end_str == "Little Endian":
                endian_char = "<"
            else:
                endian_char = ">"

            if elf_class == b"\x02":
                f.seek(16)
                e_type, e_machine = struct.unpack(endian_char + "HH", f.read(4))
                f.seek(0x12)
                e_entry = struct.unpack(endian_char + "Q", f.read(8))[0]
            else:
                f.seek(16)
                e_type, e_machine = struct.unpack(endian_char + "HH", f.read(4))
                f.seek(0x18)
                e_entry = struct.unpack(endian_char + "I", f.read(4))[0]

            arch_map = {
                0x02: "SPARC", 0x03: "x86", 0x08: "MIPS",
                0x14: "PowerPC", 0x28: "ARM", 0x3E: "x86_64",
                0xB7: "AArch64", 0xF3: "RISC-V",
            }
            arch = arch_map.get(e_machine, f"Unknown (0x{e_machine:x})")

            type_map = {0: "NONE", 1: "REL", 2: "EXEC", 3: "DYN", 4: "CORE"}
            etype_str = type_map.get(e_type, f"Unknown (0x{e_type:x})")

            linked_libs = []
            try:
                f.seek(0)
                ident = f.read(16)
                if ident[4] == 2:
                    f.seek(0xF0)
                    shoff = struct.unpack(endian_char + "Q", f.read(8))[0]
                    shentsize = struct.unpack(endian_char + "H", f.read(2))[0]
                    shnum = struct.unpack(endian_char + "H", f.read(2))[0]
                    shstrndx = struct.unpack(endian_char + "H", f.read(2))[0]
                    strtab_off = shoff + shstrndx * shentsize
                    f.seek(strtab_off + 24)
                    strtab_size = struct.unpack(endian_char + "Q", f.read(8))[0]
                    f.seek(strtab_off + 16)
                    strtab_addr = struct.unpack(endian_char + "Q", f.read(8))[0]
                    for i in range(shnum):
                        shdr_off = shoff + i * shentsize
                        f.seek(shdr_off + 4)
                        shtype = struct.unpack(endian_char + "I", f.read(4))[0]
                        if shtype == 2:
                            f.seek(shdr_off + 8)
                            sh_flags = struct.unpack(endian_char + "Q", f.read(8))[0]
                            f.seek(shdr_off + 32)
                            sh_offset = struct.unpack(endian_char + "Q", f.read(8))[0]
                            sh_size = struct.unpack(endian_char + "Q", f.read(8))[0]
                            if sh_flags & 0x2:
                                f.seek(sh_offset)
                                dyn_data = f.read(min(sh_size, 4096))
                                for j in range(0, len(dyn_data), 16):
                                    if j + 16 > len(dyn_data):
                                        break
                                    d_tag = struct.unpack(endian_char + "Q", dyn_data[j:j+8])[0]
                                    d_val = struct.unpack(endian_char + "Q", dyn_data[j+8:j+16])[0]
                                    if d_tag == 1:
                                        f.seek(strtab_addr + d_val)
                                        lib_name = b""
                                        while True:
                                            c = f.read(1)
                                            if c == b"\x00" or not c:
                                                break
                                            lib_name += c
                                        if lib_name:
                                            linked_libs.append(lib_name.decode("utf-8", errors="replace"))
                else:
                    linked_libs = []
            except Exception:
                linked_libs = []

            debug_symbols = False
            try:
                f.seek(0)
                ident = f.read(16)
                if ident[4] == 2:
                    f.seek(0x3C)
                    e_shoff = struct.unpack(endian_char + "I", f.read(4))[0]
                    f.seek(e_shoff)
                    for i in range(40):
                        f.seek(e_shoff + i * 64 + 4)
                        shtype = struct.unpack(endian_char + "I", f.read(4))[0]
                        f.seek(e_shoff + i * 64 + 8)
                        sh_flags = struct.unpack(endian_char + "Q", f.read(8))[0]
                        f.seek(e_shoff + i * 64)
                        sh_name = struct.unpack(endian_char + "I", f.read(4))[0]
                        if shtype == 11 or (shtype == 2 and (sh_flags & 0x2)):
                            debug_symbols = True
                            break
                else:
                    f.seek(0x20)
                    e_shoff = struct.unpack(endian_char + "I", f.read(4))[0]
                    f.seek(e_shoff)
                    for i in range(20):
                        f.seek(e_shoff + i * 40 + 4)
                        shtype = struct.unpack(endian_char + "I", f.read(4))[0]
                        if shtype == 11:
                            debug_symbols = True
                            break
            except Exception:
                debug_symbols = False

            return {
                "architecture": arch,
                "class": cls_str,
                "endianness": end_str,
                "entry_point": f"0x{e_entry:x}",
                "file_type": etype_str,
                "linked_libraries": linked_libs if linked_libs else None,
                "debug_symbols": debug_symbols,
            }
    except Exception:
        return None


@router.get("")
async def list_files():
    cached = db_cache.get("list_files")
    if cached:
        return cached
    db = await get_db()
    cursor = await db.execute("""
        SELECT f.*, p.name as project_name
        FROM files f
        JOIN projects p ON f.project_id = p.id
        ORDER BY p.name, f.folder_name, f.name
    """)
    rows = await cursor.fetchall()
    await db.close()
    result = [dict(row) for row in rows]
    db_cache.set("list_files", result)
    return result


@router.get("/projects")
async def list_projects():
    cached = db_cache.get("list_projects")
    if cached:
        return cached
    db = await get_db()
    cursor = await db.execute("""
        SELECT p.id, p.name, p.created_at,
               COUNT(f.id) as file_count,
               SUM(CASE WHEN f.is_new = 1 THEN 1 ELSE 0 END) as new_count,
               SUM(f.analysed) as analysed_count
        FROM projects p
        LEFT JOIN files f ON f.project_id = p.id
        GROUP BY p.id
        ORDER BY p.name
    """)
    rows = await cursor.fetchall()
    await db.close()
    result = [dict(row) for row in rows]
    db_cache.set("list_projects", result)
    return result


@router.get("/{file_id}/metadata")
async def file_metadata(file_id: int):
    cache_key = f"file_metadata_{file_id}"
    cached = db_cache.get(cache_key)
    if cached:
        return cached

    db = await get_db()
    cursor = await db.execute("""
        SELECT f.*, p.name as project_name
        FROM files f
        JOIN projects p ON f.project_id = p.id
        WHERE f.id = ?
    """, (file_id,))
    row = await cursor.fetchone()
    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="File not found")

    result = dict(row)

    file_path = row["path"]
    if os.path.exists(file_path):
        elf_meta = _parse_elf_metadata(file_path)
        if elf_meta:
            result["elf_metadata"] = elf_meta

    cursor = await db.execute(
        "SELECT * FROM analyses WHERE file_id = ? ORDER BY created_at DESC LIMIT 1",
        (file_id,),
    )
    analysis = await cursor.fetchone()
    if analysis:
        result["analysis"] = dict(analysis)

    await db.close()
    db_cache.set(cache_key, result)
    return result


@router.get("/{file_id}/content")
async def file_content(file_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    row = await cursor.fetchone()
    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="File not found")

    fpath = row["path"]
    if not os.path.exists(fpath):
        await db.close()
        raise HTTPException(status_code=404, detail="File not found on disk")

    binary_exts = {".tiff", ".gif", ".bin", ".six"}
    _, ext = os.path.splitext(fpath)
    if ext.lower() in binary_exts or row["file_type"] == "binary":
        await db.close()
        return {"content": None, "binary": True}

    try:
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        await db.close()
        return {"content": content, "binary": False}
    except Exception:
        await db.close()
        return {"content": None, "binary": True}


@router.get("/{file_id}/children")
async def file_children(file_id: int):
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM files WHERE project_id = ? ORDER BY folder_name, name",
        (file_id,),
    )
    rows = await cursor.fetchall()
    await db.close()
    return [dict(row) for row in rows]


@router.get("/{file_id}/folder-children")
async def folder_children(file_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    file_row = await cursor.fetchone()
    if not file_row:
        await db.close()
        raise HTTPException(status_code=404, detail="File not found")

    cursor = await db.execute(
        "SELECT f.*, p.name as project_name FROM files f JOIN projects p ON f.project_id = p.id WHERE f.project_id = ? AND f.folder_name = ? ORDER BY f.name",
        (file_row["project_id"], file_row["folder_name"]),
    )
    rows = await cursor.fetchall()
    await db.close()
    return [dict(row) for row in rows]


@router.delete("/{file_id}")
async def delete_file(file_id: int):
    db_cache.clear()
    db = await get_db()
    cursor = await db.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    row = await cursor.fetchone()
    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="File not found")

    await db.execute("DELETE FROM analyses WHERE file_id = ?", (file_id,))
    await db.execute("DELETE FROM files WHERE id = ?", (file_id,))
    await db.commit()
    await db.close()
    return {"status": "deleted", "id": file_id}
