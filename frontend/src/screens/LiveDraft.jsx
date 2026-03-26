import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getMatch, cancelMatch } from "../api";

import { connectDraft } from "../ws";
import Header from "../components/Header";

const ROLES = ["All", "Batter", "Batter/WK", "All-Rounder", "Bowler"];

// Look up cricbuzz scores URL by team names from the IPL schedule
async function lookupCricbuzzUrl(teamA, teamB) {
  try {
    const api = (await import("../api")).default;
    const res = await api.get("/ipl-matches");
    const match = res.data.find(
      (m) =>
        (m.team_a === teamA && m.team_b === teamB) ||
        (m.team_a === teamB && m.team_b === teamA)
    );
    return match?.cricbuzz_scores_url || null;
  } catch {
    return null;
  }
}

function getSavedGroups() {
  try { return JSON.parse(localStorage.getItem("ipl_groups") || "[]"); } catch { return []; }
}

// Collapsible panel showing what you picked in other groups
function MyOtherPicks({ currentGroupId, myRole }) {
  const [picks, setPicks] = useState(null); // null = not loaded
  const [open, setOpen] = useState(false);

  async function load() {
    const saved = getSavedGroups().filter((g) => g.code !== currentGroupId);
    const api = (await import("../api")).default;
    const results = [];
    for (const g of saved) {
      try {
        const res = await api.get(`/groups/${g.code}`);
        const group = res.data;
        const role = localStorage.getItem(`ipl_player_${g.code}`) || g.role;
        const opponent = role === "player1" ? group.player2_name : group.player1_name;
        const playerNames = new Set();
        for (const m of group.matches) {
          if (m.status === "scored" || m.status === "draft_complete") {
            try {
              const mr = await api.get(`/matches/${m.id}`);
              mr.data.picks
                .filter((p) => p.picked_by === role)
                .forEach((p) => playerNames.add(p.player_name));
            } catch {}
          }
        }
        if (playerNames.size > 0) {
          results.push({ code: g.code, opponent: opponent || g.code, players: [...playerNames] });
        }
      } catch {}
    }
    setPicks(results);
  }

  function handleToggle() {
    if (!open && picks === null) load();
    setOpen((v) => !v);
  }

  if (getSavedGroups().filter((g) => g.code !== currentGroupId).length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={handleToggle}
        style={{ width: "100%", textAlign: "left", background: "var(--card-bg,#fff)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between" }}
      >
        <span>My picks from other groups</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "8px 12px", background: "var(--card-bg,#fff)" }}>
          {picks === null
            ? <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Loading...</p>
            : picks.length === 0
              ? <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>No scored matches in other groups yet.</p>
              : picks.map((g) => (
                  <div key={g.code} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>vs {g.opponent}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {g.players.map((name) => (
                        <span key={name} style={{ fontSize: 12, background: "var(--blue-light,#e8f0fe)", color: "var(--blue,#1a73e8)", borderRadius: 6, padding: "2px 7px" }}>{name}</span>
                      ))}
                    </div>
                  </div>
                ))
          }
        </div>
      )}
    </div>
  );
}

export default function LiveDraft() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [match, setMatch] = useState(null);
  const [draftState, setDraftState] = useState(null);
  const [roleFilter, setRoleFilter] = useState("All");
  const [wsError, setWsError] = useState("");
  const [confirmPick, setConfirmPick] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [cricbuzzUrl, setCricbuzzUrl] = useState(null);
  const wsRef = useRef(null);

  // Determine which player we are
  useEffect(() => {
    async function init() {
      const res = await getMatch(matchId);
      const m = res.data;
      setMatch(m);
      const stored = localStorage.getItem(`ipl_player_${m.group_id}`);
      const role = searchParams.get("player") || stored || "player1";
      setMyPlayer(role);
      // Use stored URL or look up from schedule
      if (m.cricbuzz_url) {
        setCricbuzzUrl(m.cricbuzz_url.replace("live-cricket-scorecard", "live-cricket-scores"));
      } else {
        lookupCricbuzzUrl(m.team_a, m.team_b).then(setCricbuzzUrl);
      }
    }
    init();
  }, [matchId]);

  // Connect WebSocket once we know the player
  useEffect(() => {
    if (!myPlayer) return;
    const ws = connectDraft({
      matchId,
      player: myPlayer,
      onMessage: (data) => {
        if (data.type === "draft_state") setDraftState(data);
        if (data.type === "error") setWsError(data.detail);
      },
      onError: (msg) => setWsError(msg),
    });
    wsRef.current = ws;
    return () => ws.close();
  }, [myPlayer, matchId]);

  const handlePickClick = useCallback((playerName) => {
    if (!draftState || draftState.current_turn !== myPlayer) return;
    setConfirmPick(playerName);
  }, [draftState, myPlayer]);

  const confirmAndPick = useCallback(() => {
    if (!confirmPick || !wsRef.current) return;
    wsRef.current.send({ action: "pick", player_name: confirmPick });
    setConfirmPick(null);
  }, [confirmPick]);

  if (!match || !draftState) {
    return <div className="screen"><p className="muted">Connecting to draft...</p></div>;
  }

  const isMyTurn = draftState.current_turn === myPlayer;
  const isDone = draftState.status === "draft_complete";
  const opponentRole = myPlayer === "player1" ? "player2" : "player1";

  const myPicks = myPlayer === "player1" ? draftState.player1_picks : draftState.player2_picks;
  const theirPicks = myPlayer === "player1" ? draftState.player2_picks : draftState.player1_picks;

  const allPicked = new Set([...draftState.player1_picks, ...draftState.player2_picks].map((p) => p.name));

  const filtered = draftState.available_players.filter(
    (p) => roleFilter === "All" || p.role === roleFilter
  );

  // Group available players by team
  const byTeam = {};
  for (const p of filtered) {
    if (!byTeam[p.team]) byTeam[p.team] = [];
    byTeam[p.team].push(p);
  }

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <Header
        title={`${match.team_a} vs ${match.team_b}`}
        onBack={() => navigate(`/group/${match.group_id}`)}
        onCancel={!isDone ? async () => {
          if (!window.confirm("Mark this match as cancelled / did not play? Pick order will not be affected.")) return;
          await cancelMatch(matchId);
          navigate(`/group/${match.group_id}`);
        } : null}
      />
      <div className="draft-header">
        <div className="subtitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {isDone
              ? "Draft complete!"
              : `Pick ${draftState.pick_number} of ${draftState.draft_size * 2} · ${draftState.draft_size} each`}
          </span>
          {cricbuzzUrl && (
            <a
              href={cricbuzzUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--blue)", textDecoration: "none", border: "1px solid var(--blue)", borderRadius: 6, padding: "3px 9px", whiteSpace: "nowrap", marginLeft: 8 }}
            >
              Lineups ↗
            </a>
          )}
        </div>
      </div>

      {wsError && <div className="error-msg">{wsError} <button onClick={() => setWsError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>✕</button></div>}

      {/* Turn indicator + undo */}
      {!isDone && (
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 12 }}>
          <div className={`turn-indicator ${isMyTurn ? "turn-mine" : "turn-theirs"}`} style={{ flex: 1, margin: 0 }}>
            {isMyTurn ? "✅ Your turn to pick" : "⏳ Opponent is picking..."}
          </div>
          {draftState.can_undo === myPlayer && (
            <button
              style={{ padding: "0 14px", borderRadius: 8, border: "1.5px solid var(--border)", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--red)", whiteSpace: "nowrap" }}
              onClick={() => wsRef.current?.send({ action: "undo" })}
            >
              ↩ Undo
            </button>
          )}
        </div>
      )}

      {/* Picks panels */}
      <div className="picks-panels">
        <div className="picks-panel">
          <h4>You ({myPlayer === "player1" ? match.group_id && "P1" : "P2"}) · {myPicks.length}/{draftState.draft_size}</h4>
          {myPicks.length === 0
            ? <p style={{ fontSize: 12, color: "var(--muted)" }}>No picks yet</p>
            : myPicks.map((p) => (
                <div key={p.name} className="pick-chip">
                  <div>{p.name}</div>
                  <div className="pick-role">{p.team} · {p.role}</div>
                </div>
              ))}
        </div>
        <div className="picks-panel">
          <h4>Opponent · {theirPicks.length}/{draftState.draft_size}</h4>
          {theirPicks.length === 0
            ? <p style={{ fontSize: 12, color: "var(--muted)" }}>No picks yet</p>
            : theirPicks.map((p) => (
                <div key={p.name} className="pick-chip">
                  <div>{p.name}</div>
                  <div className="pick-role">{p.team} · {p.role}</div>
                </div>
              ))}
        </div>
      </div>

      {/* Done state */}
      {isDone && (
        <div className="success-msg" style={{ textAlign: "center" }}>
          Draft complete! Ready to score after the match.
          <br />
          <button
            className="btn btn-primary btn-sm mt8"
            onClick={() => navigate(`/match/${matchId}/score`)}
          >
            Go to Scoring →
          </button>
        </div>
      )}

      {/* My picks from other groups */}
      {!isDone && match && (
        <MyOtherPicks currentGroupId={match.group_id} myRole={myPlayer} />
      )}

      {/* Available players */}
      {!isDone && (
        <div className="player-list">
          <div className="player-list-header">
            {ROLES.map((r) => (
              <button
                key={r}
                className={`filter-btn ${roleFilter === r ? "active" : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>

          {Object.entries(byTeam).map(([team, players]) => (
            <div key={team}>
              <div style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
                {team}
              </div>
              {players.map((p) => {
                const isPicked = allPicked.has(p.name);
                const pickedByP1 = draftState.player1_picks.find((x) => x.name === p.name);
                const pickedByP2 = draftState.player2_picks.find((x) => x.name === p.name);
                return (
                  <div
                    key={p.name}
                    className={`player-row ${isPicked ? "picked" : ""}`}
                    onClick={() => !isPicked && handlePickClick(p.name)}
                  >
                    <div className="player-info">
                      <div className="name">{p.name}</div>
                      <div className="meta">{p.role}</div>
                    </div>
                    {isPicked && (
                      <span className="picked-by-label">
                        {pickedByP1 ? (myPlayer === "player1" ? "You" : "Opponent") : (myPlayer === "player2" ? "You" : "Opponent")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirmPick && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", zIndex: 100,
        }}>
          <div style={{ background: "#fff", width: "100%", borderRadius: "16px 16px 0 0", padding: "24px 20px 36px" }}>
            <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Pick {confirmPick}?</p>
            <p className="muted" style={{ marginBottom: 20 }}>This can't be undone.</p>
            <div className="row">
              <button className="btn btn-secondary" onClick={() => setConfirmPick(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAndPick}>Confirm Pick</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
