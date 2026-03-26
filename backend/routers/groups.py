import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Group, TournamentStanding
from schemas import GroupCreate, GroupJoin, GroupOut

router = APIRouter()

ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(random.choices(ROOM_CODE_CHARS, k=4))
        if not db.query(Group).filter(Group.id == code).first():
            return code
    raise RuntimeError("Could not generate unique room code")


@router.post("/groups", response_model=GroupOut)
def create_group(body: GroupCreate, db: Session = Depends(get_db)):
    code = _generate_code(db)
    group = Group(
        id=code,
        player1_name=body.player1_name.strip(),
        wicket_value=body.wicket_value,
        runs_to_rupees=body.runs_to_rupees,
    )
    db.add(group)
    standing = TournamentStanding(group_id=code)
    db.add(standing)
    db.commit()
    db.refresh(group)
    return group


@router.post("/groups/join", response_model=GroupOut)
def join_group(body: GroupJoin, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == body.code.upper().strip()).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.player2_name:
        raise HTTPException(status_code=400, detail="Group already has two players")
    group.player2_name = body.player2_name.strip()
    db.commit()
    db.refresh(group)
    return group


@router.get("/groups/{code}", response_model=GroupOut)
def get_group(code: str, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == code.upper().strip()).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group
