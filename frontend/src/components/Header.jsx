import { useNavigate } from "react-router-dom";

export default function Header({ title, onBack, onCancel }) {
  const navigate = useNavigate();

  return (
    <div className="screen-header">
      {onBack && (
        <button className="back-btn" onClick={onBack}>←</button>
      )}
      <span className="screen-title" style={{ flex: 1 }}>{title}</span>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--red)", background: "none", border: "1.5px solid var(--red)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", marginRight: 6 }}
        >
          Cancel Match
        </button>
      )}
      <button
        className="back-btn"
        onClick={() => navigate("/")}
        title="Home"
        style={{ fontSize: 20 }}
      >
        🏠
      </button>
    </div>
  );
}
