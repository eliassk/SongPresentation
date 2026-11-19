import type { AppState } from './types';

export interface Link {
  send(type: string, payload?: Record<string, unknown>): void;
}

/** Reconnects forever with backoff. Displays MUST keep their last frame while offline. */
export function connect(onState: (s: AppState) => void, onStatus?: (online: boolean) => void): Link {
  let ws: WebSocket | null = null;
  let retry = 500;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

  function open() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 500;
      onStatus?.(true);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') onState(msg.state);
    };
    ws.onclose = () => {
      onStatus?.(false);
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 5000);
    };
    ws.onerror = () => ws?.close();
  }
  open();

  return {
    send(type, payload = {}) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload }));
    },
  };
}
