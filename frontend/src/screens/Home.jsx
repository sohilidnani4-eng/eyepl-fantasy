import { useNavigate, Link } from "react-router-dom";

function getSavedGroups() {
  try {
    return JSON.parse(localStorage.getItem("ipl_groups") || "[]");
  } catch {
    return [];
  }
}

export default function Home() {
  const navigate = useNavigate();
  const groups = getSavedGroups();

  return (
    <div className="screen">
      <div className="home-hero">
        <span className="emoji">🏏 💰 🔮</span>
        <h1>EYEPL Pick Em Fantasy</h1>
        <p>Pick well, it isn't all luck!</p>
      </div>

      <div className="gap8">
        <button className="btn btn-primary" onClick={() => navigate("/create")}>
          Create Group
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/join")}>
          Join Group
        </button>
        {groups.length > 0 && (
          <button className="btn btn-secondary" onClick={() => navigate("/my-picks")}>
            My Picks
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="group-list">
          <h3>Your Groups</h3>
          {groups.map((g) => (
            <Link key={g.code} className="group-item" to={`/group/${g.code}`}>
              <div>
                <div className="group-item-code">{g.code}</div>
                <div className="group-item-names">{g.playerName}</div>
              </div>
              <span style={{ fontSize: 20 }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
