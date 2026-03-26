import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

const DRAFT_SIZE = 7;
const MY_NAME = "You";
const BOT_NAME = "Bot";

// Sample MI vs KKR squads for demo
const DEMO_PLAYERS = [
  // MI
  { name: "Rohit Sharma", team: "MI", role: "Batter" },
  { name: "Ishan Kishan", team: "MI", role: "Batter/WK" },
  { name: "Suryakumar Yadav", team: "MI", role: "Batter" },
  { name: "Hardik Pandya", team: "MI", role: "All-Rounder" },
  { name: "Tim David", team: "MI", role: "Batter" },
  { name: "Naman Dhingra", team: "MI", role: "Batter/WK" },
  { name: "Jasprit Bumrah", team: "MI", role: "Bowler" },
  { name: "Trent Boult", team: "MI", role: "Bowler" },
  { name: "Deepak Chahar", team: "MI", role: "Bowler" },
  { name: "Mitchell Santner", team: "MI", role: "All-Rounder" },
  { name: "Tilak Varma", team: "MI", role: "Batter" },
  { name: "Robin Minz", team: "MI", role: "Batter/WK" },
  { name: "Vignesh Puthur", team: "MI", role: "Bowler" },
  { name: "Reece Topley", team: "MI", role: "Bowler" },
  { name: "Allah Ghazanfar", team: "MI", role: "Bowler" },
  // KKR
  { name: "Ajinkya Rahane", team: "KKR", role: "Batter" },
  { name: "Quinton de Kock", team: "KKR", role: "Batter/WK" },
  { name: "Angkrish Raghuvanshi", team: "KKR", role: "Batter" },
  { name: "Venkatesh Iyer", team: "KKR", role: "All-Rounder" },
  { name: "Andre Russell", team: "KKR", role: "All-Rounder" },
  { name: "Sunil Narine", team: "KKR", role: "All-Rounder" },
  { name: "Rinku Singh", team: "KKR", role: "Batter" },
  { name: "Ramandeep Singh", team: "KKR", role: "All-Rounder" },
  { name: "Varun Chakaravarthy", team: "KKR", role: "Bowler" },
  { name: "Harshit Rana", team: "KKR", role: "Bowler" },
  { name: "Spencer Johnson", team: "KKR", role: "Bowler" },
  { name: "Anrich Nortje", team: "KKR", role: "Bowler" },
  { name: "Mayank Markande", team: "KKR", role: "Bowler" },
  { name: "Luvnith Sisodia", team: "KKR", role: "Batter/WK" },
  { name: "Rovman Powell", team: "KKR", role: "Batter" },
];

const ROLES = ["All", "Batter", "Batter/WK", "All-Rounder", "Bowler"];

export default function Demo() {
  const navigate = useNavigate();
  const [myPicks, setMyPicks] = useState([]);
  const [botPicks, setBotPicks] = useState([]);
  const [available, setAvailable] = useState(DEMO_PLAYERS);
  const [isMyTurn, setIsMyTurn] = useState(true); // user picks first
  const [botThinking, setBotThinking] = useState(false);
  const [confirmPick, setConfirmPick] = useState(null);
  const [roleFilter, setRoleFilter] = useState("All");
  const [done, setDone] = useState(false);
  const pickCount = useRef(0);

  // Bot auto-picks after a delay when it's bot's turn
  useEffect(() => {
    if (isMyTurn || done) return;
    if (myPicks.length + botPicks.length >= DRAFT_SIZE * 2) return;

    setBotThinking(true);
    const timer = setTimeout(() => {
      setAvailable((prev) => {
        if (prev.length === 0) return prev;
        const idx = Math.floor(Math.random() * prev.length);
        const picked = prev[idx];
        setBotPicks((bp) => {
          const newBotPicks = [...bp, picked];
          pickCount.current += 1;
          const total = myPicks.length + newBotPicks.length;
          if (total >= DRAFT_SIZE * 2) {
            setDone(true);
          } else {
            setIsMyTurn(true);
          }
          setBotThinking(false);
          return newBotPicks;
        });
        return prev.filter((_, i) => i !== idx);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [isMyTurn, done, myPicks.length, botPicks.length]);

  function handlePickClick(player) {
    if (!isMyTurn || botThinking || done) return;
    setConfirmPick(player);
  }

  function confirmAndPick() {
    if (!confirmPick) return;
    setMyPicks((prev) => {
      const newMyPicks = [...prev, confirmPick];
      pickCount.current += 1;
      const total = newMyPicks.length + botPicks.length;
      if (total >= DRAFT_SIZE * 2) {
        setDone(true);
      } else {
        setIsMyTurn(false);
      }
      return newMyPicks;
    });
    setAvailable((prev) => prev.filter((p) => p.name !== confirmPick.name));
    setConfirmPick(null);
  }

  const pickedNames = new Set([...myPicks, ...botPicks].map((p) => p.name));
  const filtered = available.filter((p) => roleFilter === "All" || p.role === roleFilter);
  const byTeam = {};
  for (const p of filtered) {
    if (!byTeam[p.team]) byTeam[p.team] = [];
    byTeam[p.team].push(p);
  }

  const totalPicks = myPicks.length + botPicks.length;
  const pickNumber = totalPicks + 1;

  if (done) {
    return (
      <div className="screen">
        <Header title="Demo Draft" />
        <div className="success-msg" style={{ textAlign: "center", marginBottom: 16 }}>
          Draft complete! This was a demo — no data was saved.
        </div>

        <div className="picks-panels">
          <div className="picks-panel">
            <h4>Your Squad ({myPicks.length})</h4>
            {myPicks.map((p) => (
              <div key={p.name} className="pick-chip">
                <div>{p.name}</div>
                <div className="pick-role">{p.team} · {p.role}</div>
              </div>
            ))}
          </div>
          <div className="picks-panel">
            <h4>Bot's Squad ({botPicks.length})</h4>
            {botPicks.map((p) => (
              <div key={p.name} className="pick-chip">
                <div>{p.name}</div>
                <div className="pick-role">{p.team} · {p.role}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary mt16" onClick={() => navigate("/demo")}>
          Play Again
        </button>
        <button className="btn btn-secondary mt16" onClick={() => navigate("/create")}>
          Create a Real Group →
        </button>
      </div>
    );
  }

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      <Header title="Demo — MI vs KKR" />

      <div className="draft-header">
        <div className="subtitle" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Pick {pickNumber} of {DRAFT_SIZE * 2} · {DRAFT_SIZE} each</span>
          <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px" }}>DEMO</span>
        </div>
      </div>

      <div className={`turn-indicator ${isMyTurn ? "turn-mine" : "turn-theirs"}`}>
        {botThinking ? "🤖 Bot is picking..." : isMyTurn ? "✅ Your turn to pick" : "⏳ Bot is picking..."}
      </div>

      <div className="picks-panels">
        <div className="picks-panel">
          <h4>{MY_NAME} · {myPicks.length}/{DRAFT_SIZE}</h4>
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
          <h4>{BOT_NAME} · {botPicks.length}/{DRAFT_SIZE}</h4>
          {botPicks.length === 0
            ? <p style={{ fontSize: 12, color: "var(--muted)" }}>No picks yet</p>
            : botPicks.map((p) => (
                <div key={p.name} className="pick-chip">
                  <div>{p.name}</div>
                  <div className="pick-role">{p.team} · {p.role}</div>
                </div>
              ))}
        </div>
      </div>

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
            {players.map((p) => (
              <div
                key={p.name}
                className="player-row"
                onClick={() => handlePickClick(p)}
                style={{ opacity: !isMyTurn || botThinking ? 0.5 : 1 }}
              >
                <div className="player-info">
                  <div className="name">{p.name}</div>
                  <div className="meta">{p.role}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {confirmPick && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ background: "#fff", width: "100%", borderRadius: "16px 16px 0 0", padding: "24px 20px 36px" }}>
            <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Pick {confirmPick.name}?</p>
            <p className="muted" style={{ marginBottom: 20 }}>{confirmPick.team} · {confirmPick.role}</p>
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
