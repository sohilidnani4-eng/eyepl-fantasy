from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Match, DraftPick, Group, TournamentStanding
from schemas import ScoreRequest, ScoreResult
from scraper import scrape_and_match

router = APIRouter()


def _calculate_totals(picks: list[DraftPick], wicket_value: int) -> tuple[int, int]:
    p1_total = sum(
        (p.runs_scored or 0) + (p.wickets_taken or 0) * wicket_value
        for p in picks if p.picked_by == "player1"
    )
    p2_total = sum(
        (p.runs_scored or 0) + (p.wickets_taken or 0) * wicket_value
        for p in picks if p.picked_by == "player2"
    )
    return p1_total, p2_total


def _apply_stats(picks: list[DraftPick], stats: dict) -> None:
    for pick in picks:
        if pick.player_name in stats:
            pick.runs_scored = stats[pick.player_name]["runs"]
            pick.wickets_taken = stats[pick.player_name]["wickets"]
        else:
            pick.runs_scored = 0
            pick.wickets_taken = 0


def _finalize_match(match: Match, group: Group, db: Session) -> dict:
    p1_total, p2_total = _calculate_totals(match.picks, group.wicket_value)
    match.player1_total = p1_total
    match.player2_total = p2_total

    if p1_total > p2_total:
        match.winner = "player1"
        margin = p1_total - p2_total
    elif p2_total > p1_total:
        match.winner = "player2"
        margin = p2_total - p1_total
    else:
        match.winner = "tie"
        margin = 0

    match.margin_runs = margin
    match.margin_money = round(margin * group.runs_to_rupees, 2)
    match.status = "scored"
    match.scored_at = datetime.utcnow()

    # Update tournament standings
    standing = db.query(TournamentStanding).filter(TournamentStanding.group_id == group.id).first()
    if not standing:
        standing = TournamentStanding(group_id=group.id)
        db.add(standing)

    standing.matches_played += 1
    if match.winner == "player1":
        standing.player1_wins += 1
        standing.net_money += match.margin_money
    elif match.winner == "player2":
        standing.player2_wins += 1
        standing.net_money -= match.margin_money
    else:
        standing.ties += 1

    # Lock the group conversion values after first scored match
    group.is_locked = True

    db.commit()
    return {"unmatched_players": []}


@router.post("/matches/{match_id}/score", response_model=ScoreResult)
def score_match(match_id: int, body: ScoreRequest, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status not in ("draft_complete", "scored"):
        raise HTTPException(status_code=400, detail="Draft must be complete before scoring")

    group = db.query(Group).filter(Group.id == match.group_id).first()
    unmatched = []

    if body.method == "manual":
        if not body.stats:
            raise HTTPException(status_code=400, detail="stats required for manual method")
        stats_map = {s.player_name: {"runs": s.runs_scored, "wickets": s.wickets_taken} for s in body.stats}
        _apply_stats(match.picks, stats_map)

    elif body.method in ("url", "auto"):
        url = body.url
        if body.method == "auto":
            if not match.cricbuzz_url:
                raise HTTPException(
                    status_code=400,
                    detail="No Cricbuzz URL stored for this match. Use method='url' and provide the URL.",
                )
            url = match.cricbuzz_url
        if not url:
            raise HTTPException(status_code=400, detail="URL required")

        drafted = [
            {"name": p.player_name, "team": p.player_team, "role": p.player_role, "picked_by": p.picked_by}
            for p in match.picks
        ]
        try:
            stats, unmatched = scrape_and_match(url, drafted)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Scraping failed: {str(e)}")

        match.cricbuzz_url = url
        _apply_stats(match.picks, stats)

    else:
        raise HTTPException(status_code=400, detail="method must be 'auto', 'url', or 'manual'")

    _finalize_match(match, group, db)

    return ScoreResult(
        player1_total=match.player1_total,
        player2_total=match.player2_total,
        winner=match.winner,
        margin_runs=match.margin_runs,
        margin_money=match.margin_money,
        unmatched_players=unmatched,
    )


@router.put("/matches/{match_id}/score", response_model=ScoreResult)
def update_score(match_id: int, body: ScoreRequest, db: Session = Depends(get_db)):
    """Re-score a match with corrected stats (manual method only)."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status != "scored":
        raise HTTPException(status_code=400, detail="Match has not been scored yet")

    # Validate before any mutations
    if body.method != "manual" or not body.stats:
        raise HTTPException(status_code=400, detail="Only manual re-scoring is supported via PUT")

    group = db.query(Group).filter(Group.id == match.group_id).first()

    # Reverse previous standing contribution
    standing = db.query(TournamentStanding).filter(TournamentStanding.group_id == group.id).first()
    standing.matches_played -= 1
    if match.winner == "player1":
        standing.player1_wins -= 1
        standing.net_money -= match.margin_money
    elif match.winner == "player2":
        standing.player2_wins -= 1
        standing.net_money += match.margin_money
    else:
        standing.ties -= 1

    stats_map = {s.player_name: {"runs": s.runs_scored, "wickets": s.wickets_taken} for s in body.stats}
    _apply_stats(match.picks, stats_map)
    _finalize_match(match, group, db)

    return ScoreResult(
        player1_total=match.player1_total,
        player2_total=match.player2_total,
        winner=match.winner,
        margin_runs=match.margin_runs,
        margin_money=match.margin_money,
        unmatched_players=[],
    )
