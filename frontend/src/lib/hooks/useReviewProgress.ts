'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api/client';
import type { ReviewProgressEvent } from '@/types';

/**
 * Stream review progress over SSE. Falls back gracefully: if the stream
 * drops after we already saw `completed`/`failed`, we do not retry or surface
 * a spurious error (a common failure mode when the server closes the socket).
 */
export function useReviewProgress(reviewId: string, enabled = true) {
  const [events, setEvents] = useState<ReviewProgressEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef(false);

  useEffect(() => {
    if (!enabled || !reviewId) return;

    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    terminalRef.current = false;
    const ctrl = new AbortController();

    const markTerminal = (event: ReviewProgressEvent) => {
      if (event.status === 'completed' || event.status === 'failed') {
        terminalRef.current = true;
        setIsComplete(true);
        ctrl.abort();
      }
    };

    void fetchEventSource(`${API_BASE}/reviews/${reviewId}/progress`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: ctrl.signal,
      openWhenHidden: true,
      async onopen(response) {
        if (response.ok) return;
        const body = await response.text().catch(() => '');
        const msg =
          response.status === 401
            ? 'Not authenticated — sign in again'
            : body || `Progress stream failed (${response.status})`;
        setError(msg);
        ctrl.abort();
        throw new Error(msg);
      },
      onmessage(ev) {
        if (!ev.data || ev.data.startsWith(':')) return;
        try {
          const event = JSON.parse(ev.data) as ReviewProgressEvent;
          setEvents((prev) => {
            const last = prev[prev.length - 1];
            if (
              last &&
              last.status === event.status &&
              last.progress === event.progress &&
              last.message === event.message
            ) {
              return prev;
            }
            return [...prev, event];
          });
          markTerminal(event);
        } catch {
          /* ignore malformed events */
        }
      },
      onclose() {
        // Normal end after completed/failed — not an error.
        if (terminalRef.current) return;
      },
      onerror(err) {
        if (terminalRef.current || ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Progress stream disconnected');
        // Do NOT throw — throwing makes fetch-event-source retry in a loop.
      },
    }).catch((err: unknown) => {
      if (terminalRef.current || ctrl.signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Progress stream failed');
    });

    return () => {
      ctrl.abort();
    };
  }, [reviewId, enabled]);

  const latest = events[events.length - 1];
  return { events, latest, isComplete, error, progress: latest?.progress ?? 0 };
}
