"""
IPL 2026 fixtures loaded directly from ipl_2026_fixtures.xlsx.
No external API needed.
"""
from pathlib import Path
from typing import List
from datetime import datetime

import openpyxl
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from cricbuzz_ids import get_scores_url, get_scorecard_url

router = APIRouter()

XLSX_PATH = Path(__file__).parent.parent.parent / "ipl_2026_fixtures.xlsx"

TEAM_NAME_MAP = {
    "Royal Challengers Bengaluru": "RCB",
    "Sunrisers Hyderabad": "SRH",
    "Mumbai Indians": "MI",
    "Kolkata Knight Riders": "KKR",
    "Chennai Super Kings": "CSK",
    "Rajasthan Royals": "RR",
    "Punjab Kings": "PBKS",
    "Gujarat Titans": "GT",
    "Delhi Capitals": "DC",
    "Lucknow Super Giants": "LSG",
}


class IPLMatch(BaseModel):
    match_number: int
    team_a: str
    team_b: str
    team_a_full: str
    team_b_full: str
    date: str           # "2026-03-28"
    date_display: str   # "28 Mar 2026"
    day: str
    time_ist: str
    venue: str
    city: str
    cricbuzz_scores_url: str | None = None
    cricbuzz_scorecard_url: str | None = None


def _load_fixtures() -> List[IPLMatch]:
    if not XLSX_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Fixtures file not found: {XLSX_PATH}")

    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb.active
    matches = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        match_num, date_str, day, time_ist, home, away, venue, city = row[:8]
        if not match_num or not home or not away:
            continue

        team_a = TEAM_NAME_MAP.get(str(home).strip(), str(home).strip())
        team_b = TEAM_NAME_MAP.get(str(away).strip(), str(away).strip())

        # Parse date to ISO format
        try:
            dt = datetime.strptime(str(date_str).strip(), "%d %b %Y")
            date_iso = dt.strftime("%Y-%m-%d")
        except ValueError:
            date_iso = str(date_str)

        mn = int(match_num)
        matches.append(IPLMatch(
            match_number=mn,
            team_a=team_a,
            team_b=team_b,
            team_a_full=str(home).strip(),
            team_b_full=str(away).strip(),
            date=date_iso,
            date_display=str(date_str).strip(),
            day=str(day).strip() if day else "",
            time_ist=str(time_ist).strip() if time_ist else "",
            venue=str(venue).strip() if venue else "",
            city=str(city).strip() if city else "",
            cricbuzz_scores_url=get_scores_url(mn),
            cricbuzz_scorecard_url=get_scorecard_url(mn),
        ))

    return sorted(matches, key=lambda m: (m.date, m.match_number))


@router.get("/ipl-matches", response_model=List[IPLMatch])
def get_ipl_matches():
    return _load_fixtures()
