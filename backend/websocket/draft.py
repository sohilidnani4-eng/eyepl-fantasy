"""
WebSocket handler for the live draft.

Connect: WS /ws/draft/{match_id}?player=player1  (or player2)
Each match supports exactly two connections (player1, player2).
A new connection from the same player replaces the old one (handles tab refresh).
"""
import json
from typing import Dict, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Match, DraftPick, Player

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # match_id -> {"player1": WebSocket | None, "player2": WebSocket | None}
        self._connections: Dict[int, Dict[str, Optional[WebSocket]]] = {}

    def _ensure(self, match_id: int):
        if match_id not in self._connections:
            self._connections[match_id] = {"player1": None, "player2": None}

    async def connect(self, match_id: int, player: str, ws: WebSocket):
        await ws.accept()
        self._ensure(match_id)
        old = self._connections[match_id].get(player)
        if old:
            try:
                await old.close(code=1001)
            except Exception:
                pass
        self._connections[match_id][player] = ws

    def disconnect(self, match_id: int, player: str):
        self._ensure(match_id)
        self._connections[match_id][player] = None

    async def broadcast(self, match_id: int, message: dict):
        self._ensure(match_id)
        data = json.dumps(message)
        for player, ws in self._connections[match_id].items():
            if ws:
                try:
                    await ws.send_text(data)
                except Exception:
                    self._connections[match_id][player] = None


manager = ConnectionManager()


def _get_draft_state(match: Match, db: Session) -> dict:
    # All players from the two teams
    all_players = (
        db.query(Player)
        .filter(Player.team.in_([match.team_a, match.team_b]))
        .all()
    )

    picked_names = {p.player_name for p in match.picks}

    available = [
        {"name": p.name, "team": p.team, "role": p.role}
        for p in all_players
        if p.name not in picked_names
    ]

    p1_picks = [
        {"name": p.player_name, "team": p.player_team, "role": p.player_role, "pick_order": p.pick_order}
        for p in match.picks if p.picked_by == "player1"
    ]
    p2_picks = [
        {"name": p.player_name, "team": p.player_team, "role": p.player_role, "pick_order": p.pick_order}
        for p in match.picks if p.picked_by == "player2"
    ]

    pick_number = len(match.picks) + 1
    # Determine current turn from pick sequence
    # first_picker alternates: pick 1 → first_picker, pick 2 → other, etc.
    second_picker = "player2" if match.first_picker == "player1" else "player1"
    current_turn = match.first_picker if pick_number % 2 == 1 else second_picker

    status = match.status  # "drafting", "draft_complete", etc.

    # Undo is available if the last pick was made by a player and draft is not complete
    last_pick = match.picks[-1] if match.picks else None
    can_undo_player = last_pick.picked_by if (last_pick and status == "drafting") else None

    return {
        "type": "draft_state",
        "current_turn": current_turn,
        "pick_number": pick_number,
        "draft_size": match.draft_size,
        "available_players": available,
        "player1_picks": p1_picks,
        "player2_picks": p2_picks,
        "status": status,
        "can_undo": can_undo_player,  # which player can undo right now (or null)
    }


@router.websocket("/ws/draft/{match_id}")
async def draft_ws(
    websocket: WebSocket,
    match_id: int,
    player: str = Query(...),
):
    if player not in ("player1", "player2"):
        await websocket.close(code=1008)
        return

    await manager.connect(match_id, player, websocket)

    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or match.status not in ("drafting", "draft_complete"):
            await websocket.send_text(json.dumps({"type": "error", "detail": "Match not available for drafting"}))
            await websocket.close()
            return

        # Send current state on connect
        await websocket.send_text(json.dumps(_get_draft_state(match, db)))

        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Invalid JSON"}))
                continue

            action = msg.get("action")

            if action == "undo":
                db.expire_all()
                match = db.query(Match).filter(Match.id == match_id).first()
                if not match.picks:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "Nothing to undo"}))
                    continue
                last_pick = match.picks[-1]
                if last_pick.picked_by != player:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "You can only undo your own last pick"}))
                    continue
                if match.status == "draft_complete":
                    await websocket.send_text(json.dumps({"type": "error", "detail": "Draft is complete, cannot undo"}))
                    continue
                db.delete(last_pick)
                db.commit()
                db.expire_all()
                match = db.query(Match).filter(Match.id == match_id).first()
                await manager.broadcast(match_id, _get_draft_state(match, db))
                continue

            if action != "pick":
                await websocket.send_text(json.dumps({"type": "error", "detail": "Unknown action"}))
                continue

            # Refresh match state
            db.expire_all()
            match = db.query(Match).filter(Match.id == match_id).first()

            if match.status != "drafting":
                await websocket.send_text(json.dumps({"type": "error", "detail": "Draft is not active"}))
                continue

            # Validate it's this player's turn
            pick_number = len(match.picks) + 1
            second_picker = "player2" if match.first_picker == "player1" else "player1"
            current_turn = match.first_picker if pick_number % 2 == 1 else second_picker

            if player != current_turn:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Not your turn"}))
                continue

            # Validate player name
            player_name = msg.get("player_name", "").strip()
            picked_names = {p.player_name for p in match.picks}
            if player_name in picked_names:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Player already picked"}))
                continue

            # Look up player in DB
            roster_player = (
                db.query(Player)
                .filter(
                    Player.name == player_name,
                    Player.team.in_([match.team_a, match.team_b]),
                )
                .first()
            )
            if not roster_player:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Player not found in match roster"}))
                continue

            # Record pick
            draft_pick = DraftPick(
                match_id=match_id,
                player_name=roster_player.name,
                player_team=roster_player.team,
                player_role=roster_player.role,
                picked_by=player,
                pick_order=pick_number,
            )
            db.add(draft_pick)

            # Check if draft is complete
            p1_count = sum(1 for p in match.picks if p.picked_by == "player1") + (1 if player == "player1" else 0)
            p2_count = sum(1 for p in match.picks if p.picked_by == "player2") + (1 if player == "player2" else 0)

            if p1_count == match.draft_size and p2_count == match.draft_size:
                match.status = "draft_complete"

            db.commit()
            db.expire_all()
            match = db.query(Match).filter(Match.id == match_id).first()

            # Broadcast updated state to both players
            await manager.broadcast(match_id, _get_draft_state(match, db))

    finally:
        manager.disconnect(match_id, player)
        db.close()
