import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

load_dotenv()

from database import Base, engine, SessionLocal
from seed_roster import seed_roster
from routers import groups, matches, scoring, players, ipl_matches
from websocket.draft import router as draft_ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables
    Base.metadata.create_all(bind=engine)
    # Seed roster
    db = SessionLocal()
    try:
        seed_roster(db)
    finally:
        db.close()
    yield


app = FastAPI(title="IPL Fantasy Cricket", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(groups.router, prefix="/api")
app.include_router(matches.router, prefix="/api")
app.include_router(scoring.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(ipl_matches.router, prefix="/api")

# WebSocket
app.include_router(draft_ws_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve React SPA in production
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index = os.path.join(frontend_dist, "index.html")
        return FileResponse(index)
