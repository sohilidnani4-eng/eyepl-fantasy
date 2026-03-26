import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getGroup, cancelMatch } from "../api";
import Header from "../components/Header";

function formatMoney(net) {
  const abs = Math.abs(net).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  if (net > 0) return { text: `P1 is owed ₹${abs}`, color: "var(--green)" };
  if (net < 0) return { text: `P2 is owed ₹${abs}`, color: "var(--orange)" };
  return { text: "All square ₹0", color: "var(--muted)" };
}

function statusBadge(status) {
  const map = {
    drafting: ["In Draft", "badge-orange"],
    draft_complete: ["Draft Done", "badge-blue"],
    scored: ["Scored", "badge-green"],
    cancelled: ["Cancelled", "badge-gray"],
  };
  const [label, cls] = map[status] || ["Unknown", "badge-gray"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function GroupDashboard() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");

  const myRole = localStorage.getItem(`ipl_player_${code}`) || "player1";

  async function load() {
    try {
      const res = await getGroup(code);
      setGroup(res.data);
    } catch {
      setError("Group not found");
    }
  }

  useEffect(() => { load(); }, [code]);

  if (error) return <div className="screen"><div className="error-msg">{error}</div></div>;
  if (!group) return <div className="screen"><p className="muted">Loading...</p></div>;

  const { standing, matches } = group;
  const money = formatMoney(standing?.net_money || 0);
  const p1 = group.player1_name;
  const p2 = group.player2_name || "Waiting...";

  // Find active draft match
  const activeDraft = matches.find((m) => m.status === "drafting" || m.status === "draft_complete");

  return (
    <div className="screen">
      <Header
        title={`${p1} vs ${p2}`}
        onBack={() => navigate("/")}
      />
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: -16, marginBottom: 16 }}>
        Room: <strong>{code}</strong>
        {group.is_locked && <span className="badge badge-gray" style={{ marginLeft: 8 }}>🔒 Rates locked</span>}
      </div>

      {/* Standings */}
      <div className="standings">
        <div className="stat-box">
          <div className="stat-val">{standing?.player1_wins || 0}</div>
          <div className="stat-label">{p1} Wins</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{standing?.player2_wins || 0}</div>
          <div className="stat-label">{p2} Wins</div>
        </div>
      </div>
      <div className="net-money" style={{ color: money.color }}>{money.text}</div>

      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
        1 wicket = {group.wicket_value} runs · ₹{group.runs_to_rupees} per run
      </div>

      <div className="divider" />

      {/* Active draft */}
      {activeDraft && (
        <div className="row" style={{ marginBottom: 12 }}>
          <button
            className="btn btn-green"
            onClick={() => navigate(`/match/${activeDraft.id}/draft`)}
          >
            Resume Draft: {activeDraft.team_a} vs {activeDraft.team_b} →
          </button>
          <button
            className="btn btn-danger btn-sm"
            style={{ flexShrink: 0 }}
            onClick={async () => {
              if (!window.confirm("Mark this match as cancelled / did not play?")) return;
              await cancelMatch(activeDraft.id);
              load();
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* New match */}
      {!activeDraft && group.player2_name && (
        <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => navigate(`/group/${code}/match/new`)}>
          + New Match
        </button>
      )}
      {!group.player2_name && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          Waiting for Player 2 to join with code <strong>{code}</strong>
        </div>
      )}

      {/* Match history */}
      {matches.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            Match History
          </h3>
          {[...matches].reverse().map((m) => (
            <Link
              key={m.id}
              className="match-item"
              to={m.status === "scored" ? `/match/${m.id}/result` : `/match/${m.id}/draft`}
            >
              <div>
                <div className="match-teams">{m.team_a} vs {m.team_b}</div>
                <div className="match-meta">
                  {m.status === "scored"
                    ? (m.winner === "tie"
                        ? "Tie — ₹0"
                        : `${m.winner === "player1" ? p1 : p2} won by ${m.margin_runs} runs · ₹${(m.margin_money || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`)
                    : `Pick ${m.draft_size} each`}
                </div>
              </div>
              {statusBadge(m.status)}
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
