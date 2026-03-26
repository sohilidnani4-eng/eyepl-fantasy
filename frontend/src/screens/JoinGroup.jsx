import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinGroup } from "../api";
import Header from "../components/Header";

function saveGroup(code, playerName, role) {
  const groups = JSON.parse(localStorage.getItem("ipl_groups") || "[]");
  if (!groups.find((g) => g.code === code)) {
    groups.unshift({ code, playerName, role });
    localStorage.setItem("ipl_groups", JSON.stringify(groups));
  }
  localStorage.setItem(`ipl_player_${code}`, role);
  localStorage.setItem(`ipl_name_${code}`, playerName);
}

export default function JoinGroup() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    if (!code.trim()) return setError("Enter room code");
    if (!name.trim()) return setError("Enter your name");
    setLoading(true);
    setError("");
    try {
      const res = await joinGroup({ code: code.trim().toUpperCase(), player2_name: name.trim() });
      const group = res.data;
      saveGroup(group.id, name.trim(), "player2");
      navigate(`/group/${group.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to join group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <Header title="Join Group" onBack={() => navigate("/")} />

      {error && <div className="error-msg">{error}</div>}

      <div className="field">
        <label>Room Code</label>
        <input
          type="text"
          placeholder="e.g. 7X2K"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
          style={{ letterSpacing: 4, fontWeight: 700, fontSize: 20 }}
          autoFocus
        />
      </div>
      <div className="field">
        <label>Your Name</label>
        <input
          type="text"
          placeholder="e.g. Priya"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <button className="btn btn-primary mt16" onClick={handleJoin} disabled={loading}>
        {loading ? "Joining..." : "Join Group"}
      </button>
    </div>
  );
}
