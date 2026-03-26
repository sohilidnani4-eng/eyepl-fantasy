import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMatch, getGroup } from "../api";
import Header from "../components/Header";

export default function MatchResult() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [group, setGroup] = useState(null);

  useEffect(() => {
    getMatch(matchId).then(async (r) => {
      const m = r.data;
      setMatch(m);
      const g = await getGroup(m.group_id);
      setGroup(g.data);
    });
  }, [matchId]);

  if (!match || !group) return <div className="screen"><p className="muted">Loading...</p></div>;

  const p1name = group.player1_name;
  const p2name = group.player2_name;
  const p1picks = match.picks.filter((p) => p.picked_by === "player1");
  const p2picks = match.picks.filter((p) => p.picked_by === "player2");

  const winnerName = match.winner === "player1" ? p1name : match.winner === "player2" ? p2name : null;
  const isTie = match.winner === "tie";

  const money = (match.margin_money || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="screen">
      <Header title={`${match.team_a} vs ${match.team_b}`} onBack={() => navigate(`/group/${match.group_id}`)} />

      {/* Result banner */}
      <div className="result-banner" style={{ background: isTie ? "var(--muted)" : "var(--blue)" }}>
        {isTie ? (
          <>
            <div className="winner-name">It's a Tie! 🤝</div>
            <div className="money">₹0</div>
          </>
        ) : (
          <>
            <div className="winner-name">🏆 {winnerName} wins!</div>
            <div className="margin">by {match.margin_runs} runs</div>
            <div className="money">₹{money}</div>
          </>
        )}
      </div>

      {/* Score comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div className="squad-total">{match.player1_total}<div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{p1name}</div></div>
        <div className="squad-total">{match.player2_total}<div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{p2name}</div></div>
      </div>

      {/* Squad details */}
      <div className="squad-compare">
        <div>
          <h3>{p1name}</h3>
          {p1picks.map((p) => (
            <div key={p.player_name} className="squad-player">
              <div className="sp-name">{p.player_name}</div>
              <div className="sp-stats">
                {p.runs_scored ?? 0}r
                {p.wickets_taken ? ` · ${p.wickets_taken}w` : ""}
                {` = ${(p.runs_scored ?? 0) + (p.wickets_taken ?? 0) * group.wicket_value}`}
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3>{p2name}</h3>
          {p2picks.map((p) => (
            <div key={p.player_name} className="squad-player">
              <div className="sp-name">{p.player_name}</div>
              <div className="sp-stats">
                {p.runs_scored ?? 0}r
                {p.wickets_taken ? ` · ${p.wickets_taken}w` : ""}
                {` = ${(p.runs_scored ?? 0) + (p.wickets_taken ?? 0) * group.wicket_value}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calculation breakdown */}
      <div className="card" style={{ fontSize: 13, color: "var(--muted)" }}>
        1 wicket = {group.wicket_value} runs · ₹{group.runs_to_rupees} per run
        {!isTie && <> · {match.margin_runs} runs × ₹{group.runs_to_rupees} = <strong style={{ color: "var(--text)" }}>₹{money}</strong></>}
      </div>

      <button className="btn btn-primary mt16" onClick={() => navigate(`/group/${match.group_id}`)}>
        Back to Dashboard
      </button>
    </div>
  );
}
