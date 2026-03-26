import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createGroup } from "../api";
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

export default function CreateGroup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [wicketValue, setWicketValue] = useState(25);
  const [runsToRupees, setRunsToRupees] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  async function handleCreate() {
    if (!name.trim()) return setError("Enter your name");
    setLoading(true);
    setError("");
    try {
      const res = await createGroup({
        player1_name: name.trim(),
        wicket_value: Number(wicketValue),
        runs_to_rupees: Number(runsToRupees),
      });
      const group = res.data;
      saveGroup(group.id, name.trim(), "player1");
      setCreated(group.id);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="screen">
        <Header title="Group Created!" onBack={() => navigate("/")} />
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted">Share this code with your friend</p>
          <div className="room-code">{created}</div>
          <p className="muted" style={{ fontSize: 13 }}>
            They'll enter this code to join your group
          </p>
        </div>
        <button className="btn btn-primary mt16" onClick={() => navigate(`/group/${created}`)}>
          Go to Dashboard →
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title="Create Group" onBack={() => navigate("/")} />

      {error && <div className="error-msg">{error}</div>}

      <div className="field">
        <label>Your Name</label>
        <input
          type="text"
          placeholder="e.g. Rahul"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="card">
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Scoring Rules</p>
        <div className="field">
          <label>1 Wicket = ? Runs</label>
          <input
            type="number"
            value={wicketValue}
            onChange={(e) => setWicketValue(e.target.value)}
            min="1"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>₹ per Run</label>
          <input
            type="number"
            value={runsToRupees}
            onChange={(e) => setRunsToRupees(e.target.value)}
            min="1"
          />
        </div>
        <p className="muted mt8" style={{ fontSize: 12 }}>
          These are locked after the first match is scored.
        </p>
      </div>

      <button className="btn btn-primary mt16" onClick={handleCreate} disabled={loading}>
        {loading ? "Creating..." : "Create Group"}
      </button>
    </div>
  );
}
