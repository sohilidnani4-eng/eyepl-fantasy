import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { deleteGroup } from "../api";

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
      </div>

      <div className="gap8">
        <button className="btn btn-primary" onClick={() => navigate("/create")}>
          Create Group
        </button>
        <button className="btn btn-primary" onClick={() => navigate("/join")}>
          Join Group
        </button>
        {groups.length > 0 && (
          <button className="btn btn-primary" onClick={() => navigate("/my-picks")}>
            My Picks
          </button>
        )}
        <button className="btn btn-primary" onClick={() => navigate("/venues")}>
          Venue Stats
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/demo")} style={{ borderStyle: "dashed" }}>
          Try Demo Draft
        </button>
      </div>

      {groups.length > 0 && (
        <div className="group-list">
          <h3>Your Groups</h3>
          {groups.map((g) => (
            <Link key={g.code} className="group-item" to={`/group/${g.code}`} style={{ position: "relative" }}>
              <div>
                <div className="group-item-code">{g.code}</div>
                <div className="group-item-names">{g.playerName}</div>
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
          ))}
        </div>
      )}
    </div>
  );
}
