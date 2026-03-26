import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getGroup } from "../api";
import Header from "../components/Header";

function getSavedGroups() {
  try { return JSON.parse(localStorage.getItem("ipl_groups") || "[]"); } catch { return []; }
}

export default function MyPicks() {
  const navigate = useNavigate();
  const [data, setData] = useState([]); // [{group, myRole, matches: [{match, myPicks}]}]
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    async function load() {
      const saved = getSavedGroups();
      const results = await Promise.all(
        saved.map(async (g) => {
          try {
            const res = await getGroup(g.code);
            const group = res.data;
            const myRole = localStorage.getItem(`ipl_player_${g.code}`) || g.role;
            const matchesWithPicks = group.matches
              .filter((m) => m.status === "scored" || m.status === "draft_complete" || m.status === "drafting")
              .map((m) => m);
            return { group, myRole, matches: matchesWithPicks };
          } catch { return null; }
        })
      );
      setData(results.filter(Boolean));
      setLoading(false);
    }
    load();
  }, []);

  // Gather ALL picks across all groups for comparison
  const allPicksByGroup = data.map((d) => ({
    code: d.group.id,
    opponent: d.myRole === "player1" ? d.group.player2_name : d.group.player1_name,
    myRole: d.myRole,
    picks: d.group.matches.flatMap((m) =>
      // We only have summary here, need full match — skip for now
      []
    ),
  }));

  if (loading) return <div className="screen"><p className="muted">Loading...</p></div>;

  if (data.length === 0) return (
    <div className="screen">
      <Header title="My Picks" />
      <p className="muted" style={{ textAlign: "center", marginTop: 32 }}>No groups yet. Create or join a group first.</p>
    </div>
  );

  return (
    <div className="screen">
      <Header title="My Picks" />

      {data.map(({ group, myRole }) => {
        const opponent = myRole === "player1" ? group.player2_name : group.player1_name;
        const scoredMatches = group.matches.filter((m) => m.status === "scored");
        return (
          <div key={group.id} className="card" style={{ marginBottom: 12, cursor: "pointer" }}
            onClick={() => navigate(`/group/${group.id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>vs {opponent || "?"}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Room {group.id} · {scoredMatches.length} matches played</div>
              </div>
              <span style={{ fontSize: 18 }}>›</span>
            </div>
          </div>
        );
      })}

      <PickComparison data={data} />
    </div>
  );
}

// Fetch full match picks and compare across groups
function PickComparison({ data }) {
  const [allPicks, setAllPicks] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    const api = (await import("../api")).default;
    const result = [];
    for (const { group, myRole } of data) {
      const groupPicks = [];
      for (const m of group.matches) {
        if (m.status === "scored" || m.status === "draft_complete") {
          try {
            const res = await api.get(`/matches/${m.id}`);
            const picks = res.data.picks.filter((p) => p.picked_by === myRole);
            groupPicks.push({ matchId: m.id, teamA: m.team_a, teamB: m.team_b, picks });
          } catch {}
        }
      }
      result.push({ code: group.id, opponent: myRole === "player1" ? group.player2_name : group.player1_name, matches: groupPicks });
    }
    setAllPicks(result);
    setLoading(false);
  }

  if (!allPicks) return (
    <button className="btn btn-secondary mt16" onClick={load} disabled={loading}>
      {loading ? "Loading..." : "🔍 Compare My Picks Across Groups"}
    </button>
  );

  // Build a flat list of all player names I've ever picked, per group
  const picksByGroup = allPicks.map((g) => ({
    ...g,
    playerNames: new Set(g.matches.flatMap((m) => m.picks.map((p) => p.player_name))),
  }));

  if (picksByGroup.length < 2) return (
    <div className="card" style={{ color: "var(--muted)", fontSize: 14, marginTop: 12 }}>
      Need at least 2 groups to compare picks.
    </div>
  );

  // Find common picks (in ALL groups) and unique picks per group
  const allSets = picksByGroup.map((g) => g.playerNames);
  const common = [...allSets[0]].filter((name) => allSets.every((s) => s.has(name)));

  return (
    <div style={{ marginTop: 16 }}>
      {common.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderLeft: "3px solid var(--blue)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>🔁 Picked in ALL groups ({common.length})</div>
          {common.map((name) => (
            <div key={name} style={{ fontSize: 14, padding: "3px 0" }}>{name}</div>
          ))}
        </div>
      )}

      {picksByGroup.map((g) => {
        const unique = [...g.playerNames].filter((name) => !common.includes(name));
        return (
          <div key={g.code} className="card" style={{ marginBottom: 12, borderLeft: "3px solid var(--green)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>vs {g.opponent} — unique picks ({unique.length})</div>
            {unique.length === 0
              ? <div style={{ fontSize: 13, color: "var(--muted)" }}>All picks overlap with other groups</div>
              : unique.map((name) => (
                  <div key={name} style={{ fontSize: 14, padding: "3px 0" }}>{name}</div>
                ))
            }
          </div>
        );
      })}
    </div>
  );
}
