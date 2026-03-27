import Header from "../components/Header";

const VENUES = [
  {
    stadium: "Wankhede",
    city: "Mumbai",
    team: "MI",
    matches: 125,
    bat1st: 45.2,
    bat2nd: 54.8,
    notes: "Short boundaries, dew aids chases. Pace-friendly. Clear chasing advantage.",
  },
  {
    stadium: "Chepauk",
    city: "Chennai",
    team: "CSK",
    matches: 91,
    bat1st: 55.1,
    bat2nd: 44.9,
    notes: "The outlier — defending works here. Spin grip on slow surface. Only venue with clear bat-first advantage.",
  },
  {
    stadium: "Eden Gardens",
    city: "Kolkata",
    team: "KKR",
    matches: 100,
    bat1st: 42.0,
    bat2nd: 57.0,
    notes: "Heavy dew, strong chase bias. That 262 chase is the highest successful chase in IPL history at this ground.",
  },
  {
    stadium: "Chinnaswamy",
    city: "Bangalore",
    team: "RCB",
    matches: 99,
    bat1st: 45.3,
    bat2nd: 54.7,
    notes: "Altitude + short boundaries = run feast. Tough pitch in overcast conditions.",
  },
  {
    stadium: "Rajiv Gandhi",
    city: "Hyderabad",
    team: "SRH",
    matches: 83,
    bat1st: 42.2,
    bat2nd: 56.6,
    notes: "Batting paradise. Pace and bounce. Chase advantage despite being drier than coastal venues.",
  },
  {
    stadium: "Narendra Modi",
    city: "Ahmedabad",
    team: "GT",
    matches: 45,
    bat1st: 50.0,
    bat2nd: 50.0,
    notes: "Dead even — the most neutral venue. Massive boundaries demand smart hitting over brute force.",
  },
  {
    stadium: "Arun Jaitley",
    city: "Delhi",
    team: "DC",
    matches: 97,
    bat1st: 47.9,
    bat2nd: 51.0,
    notes: "Fairly balanced. Spin emerges mid-innings. 205 chased without losing a wicket is remarkable.",
  },
  {
    stadium: "Sawai Mansingh",
    city: "Jaipur",
    team: "RR",
    matches: 64,
    bat1st: 35.9,
    bat2nd: 64.1,
    notes: "Strongest chase bias in the IPL — 64.1%. Despite minimal dew, the pitch slows and spinners come into play.",
  },
  {
    stadium: "Ekana",
    city: "Lucknow",
    team: "LSG",
    matches: 22,
    bat1st: 40.9,
    bat2nd: 54.5,
    notes: "Small sample. Early batting aid shifts to spin. Chase lean but only 22 matches.",
  },
  {
    stadium: "Mullanpur",
    city: "Chandigarh",
    team: "PBKS",
    matches: 11,
    bat1st: 54.55,
    bat2nd: 45.45,
    notes: "Tiny sample but alongside Chennai where batting first has an edge. New venue, still developing its character.",
  },
];

function getAdvantage(bat1st, bat2nd) {
  if (bat1st > bat2nd + 4) return { label: "Bat 1st", color: "var(--orange)" };
  if (bat2nd > bat1st + 4) return { label: "Chase", color: "var(--green)" };
  return { label: "Even", color: "var(--muted)" };
}

export default function Venues() {
  return (
    <div className="screen">
      <Header title="Venue Stats" />
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        IPL historical win % by venue. Useful when picking batters vs bowlers.
      </p>

      {VENUES.map((v) => {
        const adv = getAdvantage(v.bat1st, v.bat2nd);
        return (
          <div key={v.stadium} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{v.stadium}, {v.city}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{v.team} · {v.matches} matches</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: adv.color, background: "var(--bg)", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", marginLeft: 8 }}>
                {adv.label}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: v.bat1st > v.bat2nd ? "var(--orange)" : "var(--text)" }}>{v.bat1st}%</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Bat 1st wins</div>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: v.bat2nd > v.bat1st ? "var(--green)" : "var(--text)" }}>{v.bat2nd}%</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Chase wins</div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.5 }}>{v.notes}</p>
          </div>
        );
      })}
    </div>
  );
}
