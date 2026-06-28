import aiosqlite

DB_PATH = "backend/rcai.db"


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA synchronous=NORMAL")
    await db.execute("PRAGMA cache_size=-8000")
    return db


async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER REFERENCES projects(id),
            folder_name TEXT DEFAULT '',
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            size INTEGER DEFAULT 0,
            analysed INTEGER DEFAULT 0,
            is_new INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER REFERENCES files(id),
            status TEXT DEFAULT 'pending',
            root_cause TEXT,
            severity TEXT,
            cvss_score REAL,
            cvss_vector TEXT,
            cve_id TEXT,
            confidence REAL,
            summary TEXT,
            details TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS pipeline_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER REFERENCES analyses(id),
            stage_number INTEGER NOT NULL,
            stage_name TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            input_data TEXT,
            output_data TEXT,
            explanation TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
        CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);
        CREATE INDEX IF NOT EXISTS idx_files_analysed ON files(analysed);
        CREATE INDEX IF NOT EXISTS idx_analyses_file ON analyses(file_id);
        CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
        CREATE INDEX IF NOT EXISTS idx_analyses_severity ON analyses(severity);
        CREATE INDEX IF NOT EXISTS idx_pipeline_analysis ON pipeline_stages(analysis_id);
    """)
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS analysis_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER REFERENCES analyses(id),
            note TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
    """)
    try:
        await db.execute("ALTER TABLE files ADD COLUMN folder_name TEXT DEFAULT ''")
        await db.execute("ALTER TABLE files ADD COLUMN is_new INTEGER DEFAULT 1")
        await db.commit()
    except Exception:
        pass
    await db.close()
