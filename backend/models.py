from datetime import datetime
from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    team = Column(String, nullable=False)  # e.g. "RCB"
    role = Column(String, nullable=False)  # Batter, Batter/WK, All-Rounder, Bowler
    country = Column(String, nullable=False)


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True)  # room code e.g. "7X2K"
    player1_name = Column(String, nullable=False)
    player2_name = Column(String, nullable=True)
    wicket_value = Column(Integer, default=25, nullable=False)
    runs_to_rupees = Column(Float, default=30.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_locked = Column(Boolean, default=False, nullable=False)

    matches = relationship("Match", back_populates="group", order_by="Match.id")
    standing = relationship("TournamentStanding", back_populates="group", uselist=False)


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    team_a = Column(String, nullable=False)
    team_b = Column(String, nullable=False)
    draft_size = Column(Integer, nullable=False)  # 6, 7, or 8
    first_picker = Column(String, nullable=False)  # "player1" or "player2"
    status = Column(
        Enum("drafting", "draft_complete", "scored", "cancelled", name="match_status"),
        default="drafting",
        nullable=False,
    )
    cricbuzz_url = Column(String, nullable=True)
    player1_total = Column(Integer, nullable=True)
    player2_total = Column(Integer, nullable=True)
    winner = Column(String, nullable=True)  # "player1", "player2", or "tie"
    margin_runs = Column(Integer, nullable=True)
    margin_money = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    scored_at = Column(DateTime, nullable=True)

    group = relationship("Group", back_populates="matches")
    picks = relationship("DraftPick", back_populates="match", order_by="DraftPick.pick_order")


class DraftPick(Base):
    __tablename__ = "draft_picks"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player_name = Column(String, nullable=False)
    player_team = Column(String, nullable=False)
    player_role = Column(String, nullable=False)
    picked_by = Column(String, nullable=False)  # "player1" or "player2"
    pick_order = Column(Integer, nullable=False)
    runs_scored = Column(Integer, nullable=True)
    wickets_taken = Column(Integer, nullable=True)

    match = relationship("Match", back_populates="picks")


class TournamentStanding(Base):
    __tablename__ = "tournament_standings"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False, unique=True)
    matches_played = Column(Integer, default=0)
    player1_wins = Column(Integer, default=0)
    player2_wins = Column(Integer, default=0)
    ties = Column(Integer, default=0)
    net_money = Column(Float, default=0.0)  # positive = player1 is owed, negative = player2 is owed

    group = relationship("Group", back_populates="standing")
