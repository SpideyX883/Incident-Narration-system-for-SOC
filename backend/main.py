"""
Project Sybil — FastAPI Application Entry Point
"""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.websocket import ws_router
from core.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)

logger = logging.getLogger("sybil")

app = FastAPI(
    title="Project Sybil API",
    version="2.0.0",
    description="Zero-Hallucination SOC Narrative Engine — Multi-LLM Ensemble Forensic Analysis",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api")
app.include_router(ws_router)


@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("  PROJECT SYBIL v2.0.0")
    logger.info("  Zero-Hallucination SOC Narrative Engine")
    logger.info("=" * 60)

    # Log available models
    available = settings.get_available_models()
    all_models = settings.get_all_models()
    logger.info(f"Models configured: {len(available)}/{len(all_models)} available")
    for m in all_models:
        status = "✓ READY" if m.available else "✗ NO KEY"
        logger.info(f"  [{status}] {m.display_name} ({m.provider})")

    # Log available scenarios
    scenarios = settings.get_scenarios()
    logger.info(f"Scenarios loaded: {len(scenarios)}")
    for s in scenarios:
        status = "✓" if s.file_exists else "✗ MISSING"
        logger.info(f"  [{status}] {s.display_name} ({s.event_count_approx} events)")

    logger.info(f"Server: http://{settings.host}:{settings.port}")
    logger.info(f"CORS origins: {settings.cors_origins}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )
