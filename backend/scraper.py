"""
Cricbuzz scorecard scraper for IPL matches.

Parsing strategy:
  - Find innings containers (div.mb-2.wb:mb-4.tb:mb-4), each starts with team short name.
  - First two unique containers = the two innings (Cricbuzz renders each twice for mobile/desktop).
  - Batting rows in container X  → players belong to team X.
  - Bowling rows in container X  → players belong to the OTHER team.

Name matching (team-filtered):
  1. Exact match (case-insensitive)
  2. Last-name match  (e.g. "Hazlewood" → "Josh Hazlewood")
  3. First-initial + last-name  (e.g. "V Kohli" → "Virat Kohli")
  4. Scraped name IS "Firstname Lastname" abbreviated by Cricbuzz → fuzzy within team
  All steps restricted to players from the SAME TEAM, eliminating cross-team false matches.
"""
import re
from typing import Dict, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup
from rapidfuzz import process as fuzz_process, fuzz

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

IPL_TEAMS = {"CSK", "MI", "RCB", "KKR", "SRH", "DC", "LSG", "RR", "GT", "PBKS"}
FUZZY_THRESHOLD = 65


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def _to_scorecard_url(url: str) -> str:
    return url.rstrip("/").replace("/live-cricket-scores/", "/live-cricket-scorecard/")


def _fetch_html(url: str) -> str:
    with httpx.Client(timeout=20, follow_redirects=True, headers=HEADERS) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.text


# ---------------------------------------------------------------------------
# Parse — returns {scraped_name: {runs, wickets, team}}
# ---------------------------------------------------------------------------

def _clean_name(raw: str) -> str:
    """Strip role markers like (wk), (c)."""
    return re.sub(r"\s*\([^)]*\)", "", raw).strip()


def _detect_team(container_text: str) -> Optional[str]:
    """Extract IPL team abbreviation from the start of an innings container."""
    for team in IPL_TEAMS:
        if container_text.startswith(team):
            return team
    return None


def _parse_scorecard(html: str) -> Dict[str, dict]:
    """
    Returns {display_name: {runs, wickets, team}} for every player on the scorecard.
    team is the IPL abbreviation derived from innings context.
    """
    soup = BeautifulSoup(html, "html.parser")
    player_stats: Dict[str, dict] = {}

    # Find innings containers — each starts with the team short name
    all_containers = soup.find_all(
        "div",
        class_=lambda c: c and "mb-2" in c and "wb:mb-4" in c and "tb:mb-4" in c,
    )

    # Deduplicate: Cricbuzz renders each innings twice (mobile + desktop).
    # Keep first occurrence per team.
    seen_teams = set()
    innings_list = []
    for container in all_containers:
        text = container.get_text(strip=True)
        team = _detect_team(text)
        if team and team not in seen_teams:
            seen_teams.add(team)
            innings_list.append((team, container))

    teams_in_match = [t for t, _ in innings_list]
    other_team = {teams_in_match[0]: teams_in_match[1], teams_in_match[1]: teams_in_match[0]} if len(teams_in_match) == 2 else {}

    for batting_team, container in innings_list:
        bowling_team = other_team.get(batting_team)

        # Batting rows → batting_team
        for row in container.find_all("div", class_="scorecard-bat-grid"):
            name_tag = row.find("a", href=re.compile(r"/profiles/"))
            if not name_tag:
                continue
            display_name = _clean_name(name_tag.get_text(strip=True))
            if not display_name:
                continue
            cols = row.find_all("div", recursive=False)
            if len(cols) < 2:
                continue
            try:
                runs = int(cols[1].get_text(strip=True))
            except ValueError:
                runs = 0
            if display_name in player_stats:
                # Already added from bowling — update runs (e.g. bowler who batted)
                player_stats[display_name]["runs"] = max(player_stats[display_name]["runs"], runs)
            else:
                player_stats[display_name] = {"runs": runs, "wickets": 0, "team": batting_team}

        # Bowling rows → bowling_team
        if not bowling_team:
            continue
        for row in container.find_all("div", class_="scorecard-bowl-grid"):
            name_tag = row.find("a", href=re.compile(r"/profiles/"))
            if not name_tag:
                continue
            display_name = _clean_name(name_tag.get_text(strip=True))
            if not display_name:
                continue
            stat_divs = [c for c in row.children if getattr(c, "name", None) == "div"]
            if len(stat_divs) < 4:
                continue
            try:
                wickets = int(stat_divs[3].get_text(strip=True))
            except ValueError:
                wickets = 0

            if display_name in player_stats:
                # Same player (e.g. full name in bowling vs abbreviated in batting)
                player_stats[display_name]["wickets"] = max(
                    player_stats[display_name]["wickets"], wickets
                )
            else:
                player_stats[display_name] = {"runs": 0, "wickets": wickets, "team": bowling_team}

    return player_stats


# ---------------------------------------------------------------------------
# Name matching — team-filtered
# ---------------------------------------------------------------------------

def _first_initial_last(full_name: str) -> str:
    """'Virat Kohli' → 'V Kohli'"""
    parts = full_name.split()
    if len(parts) >= 2:
        return f"{parts[0][0]} {parts[-1]}"
    return full_name


def _match_to_roster(
    scraped_name: str,
    scraped_team: Optional[str],
    roster_by_team: Dict[str, List[str]],
) -> Tuple[Optional[str], float]:
    """
    Match a scraped display name to a roster player name.
    Tries the scraped player's team first, then the other team as fallback.
    """
    if scraped_team and scraped_team in roster_by_team:
        candidate_pools = [roster_by_team[scraped_team]]
    else:
        candidate_pools = list(roster_by_team.values())

    # Always add a combined fallback pool
    all_candidates = [name for pool in roster_by_team.values() for name in pool]

    for candidates in candidate_pools:
        result = _try_match(scraped_name, candidates)
        if result[0]:
            return result

    # Fallback: try all candidates across both teams
    return _try_match(scraped_name, all_candidates)


def _try_match(scraped: str, candidates: List[str]) -> Tuple[Optional[str], float]:
    if not candidates:
        return None, 0.0

    scraped_lower = scraped.lower()
    scraped_last = scraped.split()[-1].lower()

    # 1. Exact
    for c in candidates:
        if c.lower() == scraped_lower:
            return c, 100.0

    # 2. Last name
    scraped_parts = scraped.split()
    last_matches = [c for c in candidates if c.split()[-1].lower() == scraped_last]
    if len(last_matches) == 1:
        c = last_matches[0]
        c_parts = c.split()
        # If scraped is a full name (not just a surname), require first initials to match
        # e.g. "Jitesh Sharma" must NOT match "Suyash Sharma"
        if len(scraped_parts) >= 2 and len(c_parts) >= 2:
            if scraped_parts[0][0].upper() != c_parts[0][0].upper():
                last_matches = []  # first initials differ — don't use this match
            else:
                return c, 92.0
        else:
            return c, 92.0  # scraped is just a surname — safe to accept
    if len(last_matches) > 1:
        # Disambiguate with fuzzy
        res = fuzz_process.extractOne(scraped, last_matches, scorer=fuzz.token_sort_ratio)
        if res and res[1] >= FUZZY_THRESHOLD:
            return res[0], float(res[1])

    # 3. First initial + last name: check if scraped looks like "V Kohli"
    #    and roster has "Virat Kohli"
    if len(scraped.split()) == 2 and len(scraped.split()[0]) == 1:
        initial, last = scraped.split()[0].upper(), scraped.split()[1].lower()
        for c in candidates:
            parts = c.split()
            if len(parts) >= 2 and parts[0][0].upper() == initial and parts[-1].lower() == last:
                return c, 88.0

    # 4. Check if a roster name's first-initial+last matches the scraped name
    for c in candidates:
        if _first_initial_last(c).lower() == scraped_lower:
            return c, 88.0

    # 5. Fuzzy
    res = fuzz_process.extractOne(scraped, candidates, scorer=fuzz.token_sort_ratio)
    if res and res[1] >= FUZZY_THRESHOLD:
        return res[0], float(res[1])

    return None, 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scrape_and_match(
    url: str,
    drafted_players: List[dict],  # [{name, team, role, picked_by}]
) -> Tuple[Dict[str, dict], List[str]]:
    """
    Fetch scorecard, parse stats, match to drafted players (team-filtered).

    Returns:
        stats:     {roster_name: {runs, wickets, scraped_name, match_score}}
        unmatched: scraped names that couldn't be matched to any drafted player
    """
    scorecard_url = _to_scorecard_url(url)
    html = _fetch_html(scorecard_url)
    player_stats = _parse_scorecard(html)

    # Build per-team roster lookup (only teams involved in this draft)
    roster_by_team: Dict[str, List[str]] = {}
    for p in drafted_players:
        roster_by_team.setdefault(p["team"], []).append(p["name"])

    stats: Dict[str, dict] = {}
    unmatched: List[str] = []

    for scraped_name, scraped_data in player_stats.items():
        matched, score = _match_to_roster(
            scraped_name, scraped_data["team"], roster_by_team
        )
        if matched:
            if matched in stats:
                # Merge if same roster player appeared under two scraped names
                stats[matched]["runs"] = max(stats[matched]["runs"], scraped_data["runs"])
                stats[matched]["wickets"] = max(stats[matched]["wickets"], scraped_data["wickets"])
            else:
                stats[matched] = {
                    "runs": scraped_data["runs"],
                    "wickets": scraped_data["wickets"],
                    "scraped_name": scraped_name,
                    "match_score": score,
                }
        else:
            unmatched.append(scraped_name)

    # Fill zeros for drafted players not found on scorecard (DNP)
    for p in drafted_players:
        if p["name"] not in stats:
            stats[p["name"]] = {"runs": 0, "wickets": 0, "scraped_name": None, "match_score": 0}

    return stats, unmatched
