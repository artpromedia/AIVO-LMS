"use client";
/**
 * Sprint 11 — SOC 2 evidence bundles list.
 *
 * The page lists the last 30 nightly bundles. Downloads are gated by
 * the existing step-up flow (`data:export` scope). After download we
 * verify the file's sha256 in the browser against `X-Evidence-Sha256`
 * so auditors get tamper-evidence end-to-end.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { requireStepUp } from "@/lib/step-up";
import { Download, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";

interface Bundle {
  id: string;
  bundleDate: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  summary: {
    accessReviewRows: number;
    auditLogRows: number;
    auditLatestSeq: number | null;
    auditLatestHash: string | null;
    configChanges: number;
    backupVerified: boolean;
  };
  generatedAt: string;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function EvidencePage() {
  const { accessToken } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [verifyState, setVerifyState] = useState<Record<string, "ok" | "mismatch" | "downloading">>(
    {},
  );

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin-svc/compliance/evidence", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBundles(data.bundles || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load bundles");
    } finally {
      setLoading(false);
    }
  }

  // `load` is defined in the same component and only depends on `accessToken`, which is
  // already in the deps array, so omitting it here is safe.
  useEffect(() => {
    load();
  }, [accessToken]);

  async function downloadAndVerify(b: Bundle) {
    if (!accessToken) return;
    setVerifyState((s) => ({ ...s, [b.id]: "downloading" }));
    try {
      const stepUpToken = await requireStepUp("data:export", accessToken);
      const res = await fetch(`/api/admin-svc/compliance/evidence/${b.bundleDate}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-step-up-token": stepUpToken,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const headerHash = (res.headers.get("x-evidence-sha256") || "").toLowerCase();
      const computed = await sha256Hex(buf);
      const ok = computed === b.sha256.toLowerCase() && computed === headerHash;
      setVerifyState((s) => ({ ...s, [b.id]: ok ? "ok" : "mismatch" }));
      // Save the file regardless so the auditor still has the artifact.
      const blob = new Blob([buf], { type: "application/gzip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = b.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setVerifyState((s) => ({ ...s, [b.id]: "mismatch" }));
    }
  }

  async function runNow() {
    if (!accessToken) return;
    setRunning(true);
    try {
      const stepUpToken = await requireStepUp("data:export", accessToken);
      await fetch("/api/admin-svc/compliance/evidence/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-step-up-token": stepUpToken,
        },
      });
      await load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            SOC 2 Evidence Bundles
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Nightly export of access reviews (CC6.1/CC6.2), audit-log Merkle root (CC7.2), config
            history (CC8.1), and backup verification (CC7.5). Each bundle is hashed so you can
            verify integrity end-to-end after download.
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Generating…" : "Generate now"}
        </button>
      </header>

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Date (UTC)</th>
              <th className="text-right p-3">Size</th>
              <th className="text-right p-3">Internal users</th>
              <th className="text-right p-3">Audit rows</th>
              <th className="text-right p-3">Config changes (30d)</th>
              <th className="text-center p-3">Backup verified</th>
              <th className="text-left p-3">SHA-256</th>
              <th className="text-right p-3">Download</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && bundles.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No bundles yet. Click <em>Generate now</em> to create the first one.
                </td>
              </tr>
            )}
            {bundles.map((b) => {
              const v = verifyState[b.id];
              return (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="p-3 font-mono">{b.bundleDate}</td>
                  <td className="p-3 text-right">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td className="p-3 text-right">{b.summary.accessReviewRows}</td>
                  <td className="p-3 text-right">{b.summary.auditLogRows}</td>
                  <td className="p-3 text-right">{b.summary.configChanges}</td>
                  <td className="p-3 text-center">{b.summary.backupVerified ? "✓" : "—"}</td>
                  <td className="p-3 font-mono text-xs text-gray-500" title={b.sha256}>
                    {b.sha256.slice(0, 12)}…
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => downloadAndVerify(b)}
                      disabled={v === "downloading"}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
                    >
                      <Download className="w-3 h-3" />
                      {v === "downloading"
                        ? "…"
                        : v === "ok"
                          ? "Verified"
                          : v === "mismatch"
                            ? "Mismatch!"
                            : "Download"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Hashes are verified in your browser against <code>X-Evidence-Sha256</code> on download.
        Bundles are stored on disk under <code>EVIDENCE_DIR</code>; in production the same bytes are
        mirrored to a WORM-locked S3 bucket once <code>EVIDENCE_S3_BUCKET</code>
        is configured.
      </p>
    </div>
  );
}
