import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMatch, scoreMatch } from "../api";
import Header from "../components/Header";

export default function Scoring() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [tab, setTab] = useState("url"); // "url" | "manual"
  const [url, setUrl] = useState("");
  const [manualStats, setManualStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unmatched, setUnmatched] = useState([]);

  useEffect(() => {
    getMatch(matchId).then((r) => {
      const m = r.data;
      setMatch(m);
      if (m.cricbuzz_url) setUrl(m.cricbuzz_url);
      // Init manual stats from existing picks
      const stats = {};
      m.picks.forEach((p) => {
        stats[p.player_name] = {
          runs: p.runs_scored ?? 0,
          wickets: p.wickets_taken ?? 0,
        };
      });
      setManualStats(stats);
    });
  }, [matchId]);

  async function handleScore() {
    setLoading(true);
    setError("");
    setUnmatched([]);
    try {
      let body;
      if (tab === "url") {
        if (!url.trim()) return setError("Paste a Cricbuzz scorecard URL");
        body = { method: "url", url: url.trim() };
      } else {
        const stats = match.picks.map((p) => ({
          player_name: p.player_name,
          runs_scored: Number(manualStats[p.player_name]?.runs || 0),
          wickets_taken: Number(manualStats[p.player_name]?.wickets || 0),
        }));
        body = { method: "manual", stats };
      }
      const res = await scoreMatch(matchId, body);
      if (res.data.unmatched_players?.length) {
        setUnmatched(res.data.unmatched_players);
      }
      navigate(`/match/${matchId}/result`);
    } catch (e) {
      setError(e.response?.data?.detail || "Scoring failed. Try manual entry.");
    } finally {
      setLoading(false);
    }
  }

  function updateStat(name, field, val) {
    setManualStats((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: val },
    }));
  }

  if (!match) return <div className="screen"><p className="muted">Loading...</p></div>;

  const p1picks = match.picks.filter((p) => p.picked_by === "player1");
  const p2picks = match.picks.filter((p) => p.picked_by === "player2");

  return (
    <div className="screen">
      <Header title="Score Match" onBack={() => navigate(-1)} />

      <div className="card" style={{ marginBottom: 16, fontSize: 14, color: "var(--muted)" }}>
        {match.team_a} vs {match.team_b} · {match.draft_size} picks each
      </div>

      {error && <div className="error-msg">{error}</div>}
      {unmatched.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--orange)" }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Unmatched players on scorecard</p>
          <p className="muted" style={{ fontSize: 13 }}>Couldn't auto-match: {unmatched.join(", ")}</p>
          <p className="muted" style={{ fontSize: 13 }}>Switch to Manual to enter stats directly.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === "url" ? "active" : ""}`} onClick={() => setTab("url")}>
          Cricbuzz URL
        </button>
        <button className={`tab ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>
          Manual Entry
        </button>
      </div>

      {tab === "url" && (
        <div>
          {match.cricbuzz_url ? (
            <div className="card" style={{ borderLeft: "3px solid var(--green)", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Scorecard link ready</div>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
                The Cricbuzz scorecard for this match is pre-filled. Just press <strong>Calculate &amp; Save Score</strong> below — no copy-pasting needed.
              </p>
              <a
                href={url.replace("live-cricket-scorecard", "live-cricket-scores")}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "var(--blue)" }}
              >
                View scorecard on Cricbuzz ↗
              </a>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Cricbuzz Scorecard URL</label>
                <input
                  type="url"
                  placeholder="https://www.cricbuzz.com/live-cricket-scorecard/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
                Paste the scorecard URL from Cricbuzz. The app will automatically extract runs and wickets for your drafted players.
              </p>
            </>
          )}
        </div>
      )}

      {tab === "manual" && (
        <div>
          <div className="score-squad">
            <h3>Player 1's Squad</h3>
            {p1picks.map((p) => (
              <div key={p.player_name} className="score-row">
                <div className="player-name">{p.player_name} <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.player_team}</span></div>
                <input
                  className="score-input"
                  type="number"
                  min="0"
                  placeholder="Runs"
                  value={manualStats[p.player_name]?.runs ?? ""}
                  onChange={(e) => updateStat(p.player_name, "runs", e.target.value)}
                />
                <input
                  className="score-input"
                  type="number"
                  min="0"
                  max="10"
                  placeholder="Wkts"
                  value={manualStats[p.player_name]?.wickets ?? ""}
                  onChange={(e) => updateStat(p.player_name, "wickets", e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="score-squad">
            <h3>Player 2's Squad</h3>
            {p2picks.map((p) => (
              <div key={p.player_name} className="score-row">
                <div className="player-name">{p.player_name} <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.player_team}</span></div>
                <input
                  className="score-input"
                  type="number"
                  min="0"
                  placeholder="Runs"
                  value={manualStats[p.player_name]?.runs ?? ""}
                  onChange={(e) => updateStat(p.player_name, "runs", e.target.value)}
                />
                <input
                  className="score-input"
                  type="number"
                  min="0"
                  max="10"
                  placeholder="Wkts"
                  value={manualStats[p.player_name]?.wickets ?? ""}
                  onChange={(e) => updateStat(p.player_name, "wickets", e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Runs · Wickets per player</p>
        </div>
      )}

      <button className="btn btn-primary mt16" onClick={handleScore} disabled={loading}>
        {loading ? "Calculating..." : "Calculate & Save Score"}
      </button>
    </div>
  );
}
