import os
import time
import json
from collections import defaultdict
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from backend.db.database import init_db
from backend.routers import upload, files, dashboard, analyse, pipeline, security, exploit, clusters, cve, report, timeline, analyses_list, seed, notes, explain

RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 100
_rate_store = defaultdict(list)


def _rate_limit(key: str) -> bool:
    now = time.time()
    window = RATE_LIMIT_WINDOW
    _rate_store[key] = [t for t in _rate_store.get(key, []) if now - t < window]
    if len(_rate_store[key]) >= RATE_LIMIT_MAX:
        return False
    _rate_store[key].append(now)
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from backend.routers.seed import seed_dataset
    try:
        await seed_dataset()
    except Exception:
        pass
    yield


app = FastAPI(
    title="RCAi API",
    description="Software Failure Root Cause Analysis Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{request.url.path}"
    if not _rate_limit(key):
        return JSONResponse(status_code=429, content={"error": "Too many requests"})
    return await call_next(request)


app.include_router(upload.router)
app.include_router(files.router)
app.include_router(dashboard.router)
app.include_router(analyse.router)
app.include_router(pipeline.router)
app.include_router(security.router)
app.include_router(exploit.router)
app.include_router(clusters.router)
app.include_router(cve.router)
app.include_router(report.router)
app.include_router(timeline.router)
app.include_router(analyses_list.router)
app.include_router(seed.router)
app.include_router(notes.router)
app.include_router(explain.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}