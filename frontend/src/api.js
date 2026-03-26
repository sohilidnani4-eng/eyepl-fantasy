import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Groups
export const createGroup = (data) => api.post("/groups", data);
export const joinGroup = (data) => api.post("/groups/join", data);
export const getGroup = (code) => api.get(`/groups/${code}`);

// Matches
export const createMatch = (code, data) => api.post(`/groups/${code}/matches`, data);
export const getMatch = (matchId) => api.get(`/matches/${matchId}`);
export const cancelMatch = (matchId) => api.delete(`/matches/${matchId}`);

// Scoring
export const scoreMatch = (matchId, data) => api.post(`/matches/${matchId}/score`, data);
export const updateScore = (matchId, data) => api.put(`/matches/${matchId}/score`, data);

// Players
export const getPlayers = (team) => api.get(`/players?team=${team}`);

export default api;
