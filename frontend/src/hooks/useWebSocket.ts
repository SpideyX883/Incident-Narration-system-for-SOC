/**
 * Project Sybil — WebSocket Hook
 * Manages WebSocket connection for real-time analysis progress.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgressEvent } from '../types';

interface UseWebSocketOptions {
  requestId: string | null;
  onEvent?: (event: ProgressEvent) => void;
  onComplete?: () => void;
}

export function useWebSocket({ requestId, onEvent, onComplete }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const connect = useCallback(() => {
    if (!requestId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/progress/${requestId}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data: ProgressEvent = JSON.parse(event.data);
          if (data.event === 'pong' || data.event === 'keepalive') return;
          onEvent?.(data);
          if (data.event === 'analysis_complete') {
            onComplete?.();
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
    }
  }, [requestId, onEvent, onComplete]);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (requestId) connect();
    return () => disconnect();
  }, [requestId, connect, disconnect]);

  return { connected, disconnect };
}
