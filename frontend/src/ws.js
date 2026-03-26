/**
 * WebSocket helper for the live draft.
 * Returns a cleanup function.
 */
export function connectDraft({ matchId, player, onMessage, onError }) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  const url = `${protocol}://${host}/ws/draft/${matchId}?player=${player}`;

  const ws = new WebSocket(url);

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onMessage(data);
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    if (onError) onError("Connection error");
  };

  ws.onclose = (e) => {
    if (e.code !== 1000 && e.code !== 1001 && onError) {
      onError("Disconnected");
    }
  };

  const send = (msg) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const close = () => ws.close(1000);

  return { send, close };
}
