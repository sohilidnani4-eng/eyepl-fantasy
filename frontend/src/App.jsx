import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./screens/Home";
import CreateGroup from "./screens/CreateGroup";
import JoinGroup from "./screens/JoinGroup";
import GroupDashboard from "./screens/GroupDashboard";
import MatchSetup from "./screens/MatchSetup";
import LiveDraft from "./screens/LiveDraft";
import Scoring from "./screens/Scoring";
import MatchResult from "./screens/MatchResult";
import MyPicks from "./screens/MyPicks";

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateGroup />} />
        <Route path="/join" element={<JoinGroup />} />
        <Route path="/group/:code" element={<GroupDashboard />} />
        <Route path="/group/:code/match/new" element={<MatchSetup />} />
        <Route path="/match/:matchId/draft" element={<LiveDraft />} />
        <Route path="/match/:matchId/score" element={<Scoring />} />
        <Route path="/match/:matchId/result" element={<MatchResult />} />
        <Route path="/my-picks" element={<MyPicks />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
