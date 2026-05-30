"use client";

import { useEffect, useRef } from "react";

/**
 * Measures time-on-item and writes it into a hidden form field at submit.
 *
 * The runner is server-rendered (a fresh form per question), so latency
 * can't be derived server-side. This client glue starts a timer when the
 * question mounts and, on the enclosing form's submit, stamps the elapsed
 * ms into the `latencyMs` field — captured before the server action runs.
 * If JS is disabled the field stays empty and the server simply records no
 * latency (a benign, optional signal).
 */
export function LatencyTimer({ name = "latencyMs" }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    const form = input?.form;
    if (!input || !form) return;
    const start = performance.now();
    const stamp = () => {
      input.value = String(Math.max(0, Math.round(performance.now() - start)));
    };
    // Capture phase so the value is set before the form is serialized for
    // the server action.
    form.addEventListener("submit", stamp, { capture: true });
    return () => form.removeEventListener("submit", stamp, { capture: true });
  }, []);

  return <input ref={ref} type="hidden" name={name} defaultValue="" />;
}
