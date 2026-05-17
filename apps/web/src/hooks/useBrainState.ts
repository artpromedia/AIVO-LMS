"use client";
import { useEffect, useState, useRef } from "react";

interface BrainState {
  masteryLevels: Record<string, number>;
  functioningLevelProfile: { level: string; confidence?: number };
  sensoryProfile: { visual?: string; auditory?: string; tactile?: string };
  activeAccommodations: string[];
  iepProfile: { goals?: string[] };
  disabilitySignals: Record<string, number>;
  version: number;
  updatedAt: string;
}

interface CacheEntry {
  state: BrainState;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const brainCache = new Map<string, CacheEntry>();

export function useBrainState(learnerId: string, accessToken: string | null) {
  const [brainState, setBrainState] = useState<BrainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!learnerId || !accessToken) {
      setLoading(false);
      return;
    }

    const cached = brainCache.get(learnerId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setBrainState(cached.state);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api/brain/${learnerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error("Brain not initialized yet");
        return res.json();
      })
      .then(data => {
        const state = data.state || data;
        brainCache.set(learnerId, { state, fetchedAt: Date.now() });
        setBrainState(state);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Could not load brain data");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [learnerId, accessToken]);

  return { brainState, loading, error };
}
