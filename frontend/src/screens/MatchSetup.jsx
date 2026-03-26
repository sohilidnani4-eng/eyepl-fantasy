import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createMatch } from "../api";
import api from "../api";
import Header from "../components/Header";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "LSG", "RR", "GT", "PBKS"];

export default function MatchSetup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState("scheduled"); // "scheduled" | "manual"
  const [scheduledMatches, setScheduledMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [listOpen, setListOpen] = useState(true);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [draftSize, setDraftSize] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/ipl-matches")
      .then((r) => setScheduledMatches(r.data))
      .catch(() => setMode("manual")); // fallback if API fails
  }, []);

  async function handleStart() {
    let ta = teamA, tb = teamB, cricbuzzUrl = null;
    if (mode === "scheduled" && selectedMatch) {
      ta = selectedMatch.team_a;
      tb = selectedMatch.team_b;
      cricbuzzUrl = selectedMatch.cricbuzz_scorecard_url || null;
    }
    if (!ta || !tb) return setError("Select both teams");
    if (ta === tb) return setError("Teams must be different");
    setLoading(true);
    setError("");
    try {
      const res = await createMatch(code, { team_a: ta, team_b: tb, draft_size: draftSize, cricbuzz_url: cricbuzzUrl });
      navigate(`/match/${res.data.id}/draft`);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create match");
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = scheduledMatches.filter((m) => m.date >= today);
  const canStart = mode === "manual" ? (teamA && teamB && teamA !== teamB) : !!selectedMatch;

  return (
    <div className="screen">
      <Header title="New Match" onBack={() => navigate(`/group/${code}`)} />

      {error && <div className="error-msg">{error}</div>}

      {/* Mode toggle */}
      {scheduledMatches.length > 0 && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${mode === "scheduled" ? "active" : ""}`} onClick={() => setMode("scheduled")}>
            IPL Schedule
          </button>
          <button className={`tab ${mode === "manual" ? "active" : ""}`} onClick={() => setMode("manual")}>
            Manual
          </button>
        </div>
      )}

      {/* Scheduled matches */}
      {mode === "scheduled" && (
        <div>
          {/* Selected match summary + toggle */}
          <div
            className="card"
            style={{ cursor: "pointer", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => setListOpen(o => !o)}
          >
            <div>
              {selectedMatch
                ? <><span style={{ fontWeight: 700 }}>{selectedMatch.team_a} vs {selectedMatch.team_b}</span> <span style={{ fontSize: 13, color: "var(--muted)" }}>· Match {selectedMatch.match_number} · {selectedMatch.date_display}</span></>
                : <span style={{ color: "var(--muted)" }}>Select a match...</span>
              }
            </div>
            <span style={{ fontSize: 20, color: "var(--muted)" }}>{listOpen ? "▲" : "▼"}</span>
          </div>

          {/* Collapsible list */}
          {listOpen && (
            upcoming.length === 0 ? (
              <div className="card" style={{ color: "var(--muted)", textAlign: "center" }}>
                No upcoming matches.<br />Use Manual to pick teams.
              </div>
            ) : (
              upcoming.map((m) => (
                <div
                  key={m.match_number}
                  className="card"
                  style={{
                    cursor: "pointer",
                    border: selectedMatch?.match_number === m.match_number ? "2px solid var(--blue)" : "2px solid transparent",
                    marginBottom: 8,
                  }}
                  onClick={() => { setSelectedMatch(m); setListOpen(false); }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{m.team_a} vs {m.team_b}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Match {m.match_number} · {m.date_display} · {m.venue}
                      </div>
                    </div>
                    {m.cricbuzz_scores_url && (
                      <a
                        href={m.cricbuzz_scores_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 11, color: "var(--blue)", whiteSpace: "nowrap", marginLeft: 8, marginTop: 2, textDecoration: "none", border: "1px solid var(--blue)", borderRadius: 6, padding: "2px 7px" }}
                      >
                        Lineups ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Manual team select */}
      {mode === "manual" && (
        <>
          <div className="field">
            <label>Team A</label>
            <select value={teamA} onChange={(e) => setTeamA(e.target.value)}>
              <option value="">Select team...</option>
              {TEAMS.map((t) => (
                <option key={t} value={t} disabled={t === teamB}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Team B</label>
            <select value={teamB} onChange={(e) => setTeamB(e.target.value)}>
              <option value="">Select team...</option>
              {TEAMS.map((t) => (
                <option key={t} value={t} disabled={t === teamA}>{t}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Draft size */}
      <div className="field" style={{ marginTop: 16 }}>
        <label>Players to Draft Each</label>
        <div className="row" style={{ marginTop: 4 }}>
          {[6, 7, 8].map((n) => (
            <button
              key={n}
              className={`btn ${draftSize === n ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setDraftSize(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ color: "var(--muted)", fontSize: 14 }}>
        The app automatically decides who picks first based on match history.
      </div>

      <button className="btn btn-primary mt16" onClick={handleStart} disabled={loading || !canStart}>
        {loading ? "Starting..." : "Start Draft →"}
      </button>
    </div>
  );
}
