from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Group, Match
from schemas import MatchCreate, MatchDetail, MatchSummary

router = APIRouter()

IPL_TEAMS = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "LSG", "RR", "GT", "PBKS"]


@router.post("/groups/{code}/matches", response_model=MatchDetail)
def create_match(code: str, body: MatchCreate, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == code.upper()).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not group.player2_name:
        raise HTTPException(status_code=400, detail="Group needs two players before starting a match")
    if body.team_a not in IPL_TEAMS or body.team_b not in IPL_TEAMS:
        raise HTTPException(status_code=400, detail="Invalid IPL team")
    if body.team_a == body.team_b:
        raise HTTPException(status_code=400, detail="Teams must be different")
    if body.draft_size not in (6, 7, 8):
        raise HTTPException(status_code=400, detail="Draft size must be 6, 7, or 8")

    existing = db.query(Match).filter(
        Match.group_id == code.upper(),
        Match.status.in_(["drafting", "draft_complete"]),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A draft is already in progress for this group")

    # Only count non-cancelled matches for alternation
    match_count = db.query(Match).filter(
        Match.group_id == code.upper(),
        Match.status != "cancelled"
    ).count()
    first_picker = "player1" if match_count % 2 == 0 else "player2"

    match = Match(
        group_id=code.upper(),
        team_a=body.team_a,
        team_b=body.team_b,
        draft_size=body.draft_size,
        first_picker=first_picker,
        status="drafting",
        cricbuzz_url=body.cricbuzz_url,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.get("/groups/{code}/matches", response_model=list[MatchSummary])
def list_matches(code: str, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == code.upper()).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group.matches


@router.get("/matches/{match_id}", response_model=MatchDetail)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.delete("/matches/{match_id}")
def cancel_match(match_id: int, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status == "scored":
        raise HTTPException(status_code=400, detail="Cannot cancel a scored match")
    match.status = "cancelled"
    db.commit()
    return {"detail": "Match cancelled"}
