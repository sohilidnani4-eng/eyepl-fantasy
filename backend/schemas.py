from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


# --- Player ---
class PlayerOut(BaseModel):
    id: int
    name: str
    team: str
    role: str
    country: str

    class Config:
        from_attributes = True


# --- Group ---
class GroupCreate(BaseModel):
    player1_name: str
    wicket_value: int = 25
    runs_to_rupees: float = 30.0


class GroupJoin(BaseModel):
    code: str
    player2_name: str


class StandingOut(BaseModel):
    matches_played: int
    player1_wins: int
    player2_wins: int
    ties: int
    net_money: float

    class Config:
        from_attributes = True


class MatchSummary(BaseModel):
    id: int
    team_a: str
    team_b: str
    draft_size: int
    first_picker: str
    status: str
    winner: Optional[str]
    margin_runs: Optional[int]
    margin_money: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class GroupOut(BaseModel):
    id: str
    player1_name: str
    player2_name: Optional[str]
    wicket_value: int
    runs_to_rupees: float
    is_locked: bool
    created_at: datetime
    standing: Optional[StandingOut]
    matches: List[MatchSummary] = []

    class Config:
        from_attributes = True


# --- Match ---
class MatchCreate(BaseModel):
    team_a: str
    team_b: str
    draft_size: int = 7  # 6, 7, or 8
    cricbuzz_url: Optional[str] = None


class DraftPickOut(BaseModel):
    id: int
    player_name: str
    player_team: str
    player_role: str
    picked_by: str
    pick_order: int
    runs_scored: Optional[int]
    wickets_taken: Optional[int]

    class Config:
        from_attributes = True


class MatchDetail(BaseModel):
    id: int
    group_id: str
    team_a: str
    team_b: str
    draft_size: int
    first_picker: str
    status: str
    cricbuzz_url: Optional[str]
    player1_total: Optional[int]
    player2_total: Optional[int]
    winner: Optional[str]
    margin_runs: Optional[int]
    margin_money: Optional[float]
    created_at: datetime
    scored_at: Optional[datetime]
    picks: List[DraftPickOut] = []

    class Config:
        from_attributes = True


# --- Scoring ---
class ManualStatEntry(BaseModel):
    player_name: str
    runs_scored: int = 0
    wickets_taken: int = 0


class ScoreRequest(BaseModel):
    method: str  # "auto", "url", or "manual"
    url: Optional[str] = None
    stats: Optional[List[ManualStatEntry]] = None


class ScoreResult(BaseModel):
    player1_total: int
    player2_total: int
    winner: str
    margin_runs: int
    margin_money: float
    unmatched_players: List[str] = []
