"""
Project Sybil — WebSocket Progress Handler
Streams real-time progress events to the frontend during analysis.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("sybil.websocket")

ws_router = APIRouter()

# Active WebSocket connections keyed by request_id
_connections: dict[str, list[WebSocket]] = {}


async def register_connection(request_id: str, ws: WebSocket):
    """Register a WebSocket connection for a request."""
    if request_id not in _connections:
        _connections[request_id] = []
    _connections[request_id].append(ws)
    logger.info(f"WebSocket registered for request {request_id}")


async def unregister_connection(request_id: str, ws: WebSocket):
    """Unregister a WebSocket connection."""
    if request_id in _connections:
        if ws in _connections[request_id]:
            _connections[request_id].remove(ws)
        if not _connections[request_id]:
            del _connections[request_id]


async def send_progress(request_id: str, event: dict[str, Any]):
    """
    Send a progress event to all WebSocket connections for a request.
    Non-blocking — silently ignores disconnected clients.
    """
    if request_id not in _connections:
        return

    message = json.dumps(event)
    disconnected = []

    for ws in _connections.get(request_id, []):
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)

    # Clean up disconnected
    for ws in disconnected:
        await unregister_connection(request_id, ws)


async def create_progress_callback(request_id: str):
    """
    Create a progress callback function for the model router.
    Returns an async function that sends events via WebSocket.
    """
    async def callback(event: dict[str, Any]):
        await send_progress(request_id, event)

    return callback


@ws_router.websocket("/ws/progress/{request_id}")
async def websocket_progress(websocket: WebSocket, request_id: str):
    """
    WebSocket endpoint for real-time analysis progress.

    Events sent:
    - model_started: {model, timestamp}
    - model_streaming: {model, tokens_so_far}
    - model_complete: {model, citations_found, compliance}
    - model_failed: {model, reason, fallback_attempted}
    - consensus_started: {}
    - consensus_complete: {confidence}
    - analysis_complete: {request_id}
    """
    await websocket.accept()
    await register_connection(request_id, websocket)

    try:
        # Keep connection alive, waiting for client messages or disconnect
        while True:
            try:
                # Wait for client messages (ping/pong or close)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=120,  # 2 minute timeout
                )
                # Client can send "ping" to keep alive
                if data == "ping":
                    await websocket.send_text(json.dumps({"event": "pong"}))
            except asyncio.TimeoutError:
                # Send a keepalive ping
                try:
                    await websocket.send_text(json.dumps({"event": "keepalive"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for request {request_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {request_id}: {e}")
    finally:
        await unregister_connection(request_id, websocket)
