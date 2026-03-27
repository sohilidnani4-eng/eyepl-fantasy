import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { deleteGroup, getGroup } from "../api";

function getSavedGroups() {
  try {
    return JSON.parse(localStorage.getItem("ipl_groups") || "[]");
  } catch {
    return [];
  }
}

function removeSavedGroup(code) {
  const groups = getSavedGroups().filter((g) => g.code !== code);
  localStorage.setItem("ipl_groups", JSON.stringify(groups));
  localStorage.removeItem(`ipl_player_${code}`);
}

export default function Home() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState(getSavedGroups());
  const [opponents, setOpponents] = useState({});

  useEffect(() => {
    const saved = getSavedGroups();
    saved.forEach(async (g) => {
      try {
        const res = await getGroup(g.code);
        const group = res.data;
        const role = localStorage.getItem(`ipl_player_${g.code}`) || g.role;
        const opponent = role === "player1" ? group.player2_name : group.player1_name;
        setOpponents((prev) => ({ ...prev, [g.code]: opponent || null }));
      } catch {}
    });
  }, []);

  async function handleDelete(e, code) {
    e.preventDefault();
    if (!window.confirm(`Delete group ${code}? This cannot be undone.`)) return;
    try {
      await deleteGroup(code);
    } catch {}
    removeSavedGroup(code);
    setGroups(getSavedGroups());
  }

  return (
    <div className="screen">
      <div className="home-hero">
        <span className="emoji">🏏 💰 🔮</span>
        <h1>EYEPL Pick Em</h1>
        <p>Pick well, it isn't all just luck!</p>
        <p style={{ marginTop: 6 }}>Calculates game by game scores, keeps tally of runs & wickets.</p>
        <p style={{ marginTop: 4 }}>Play with your mates.</p>

        <div className="hero-buttons">
          <button className="btn-hero" onClick={() => navigate("/create")}>Create Group</button>
          <button className="btn-hero" onClick={() => navigate("/join")}>Join Group</button>
          {groups.length > 0 && (
            <button className="btn-hero" onClick={() => navigate("/my-picks")}>My Picks</button>
          )}
          <button className="btn-hero" onClick={() => navigate("/venues")}>Venue Stats</button>
          <button className="btn-hero btn-hero-demo" onClick={() => navigate("/demo")}>Try Demo Draft</button>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="group-list">
          <h3>Your Groups</h3>
          {groups.map((g) => {
            const opponent = opponents[g.code];
            return (
              <Link key={g.code} className="group-item" to={`/group/${g.code}`} style={{ position: "relative" }}>
                <div>
                  <div className="group-item-code">
                    {opponent ? `vs ${opponent}` : `Room ${g.code}`}
                  </div>
                  <div className="group-item-names">
                    {opponent ? `Room ${g.code} · You: ${g.playerName}` : g.playerName}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>›</span>
                  {g.role === "player1" && (
                    <button
                      onClick={(e) => handleDelete(e, g.code)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--red)", padding: "4px" }}
                      title="Delete group"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
