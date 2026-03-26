from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Player
from schemas import PlayerOut

router = APIRouter()


@router.get("/players", response_model=list[PlayerOut])
def get_players(team: str = Query(None), db: Session = Depends(get_db)):
    q = db.query(Player)
    if team:
        q = q.filter(Player.team == team.upper())
    return q.order_by(Player.team, Player.role, Player.name).all()
