"use client";

/**
 * District SCIM provisioning section (Sprint B5) — token lifecycle with
 * the plaintext shown exactly once (kept out of URLs and server logs),
 * per-resource sync counters from the audit trail, and the
 * unmapped-group review list so nothing an IdP pushes is silently
 * dropped.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface ScimTokenView {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ScimUnmappedGroupView {
  id: string;
  displayName: string;
  reason: string;
  memberCount: number;
  lastSeenAt: string;
  seenCount: number;
}

export interface ScimActivityView {
  counters: Record<string, number>;
  lastSyncAt: string | null;
}

const COUNTER_LABELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "SCIM_USER_CREATED", label: "Users created" },
  { key: "SCIM_USER_REPLACED", label: "Users updated" },
  { key: "SCIM_USER_PATCHED", label: "Users patched" },
  { key: "SCIM_USER_DEACTIVATED", label: "Users deactivated" },
  { key: "SCIM_GROUP_MAPPED", label: "Classes mapped" },
  { key: "SCIM_GROUP_UNMAPPED", label: "Groups skipped" },
];

const REASON_COPY: Record<string, string> = {
  not_class_convention:
    "Name doesn't match `Class: <School Name> / <Class Name>` — likely a role or org group; no class was created.",
  unknown_school: "The school named before the slash doesn't exist in this district.",
};

function formatWhen(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  return isNaN(date.getTime()) ? "never" : date.toLocaleString();
}

export function ScimSection({
  tokens,
  unmappedGroups,
  activity,
}: {
  tokens: ScimTokenView[];
  unmappedGroups: ScimUnmappedGroupView[];
  activity: ScimActivityView;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tokenName, setTokenName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ name: string; plaintext: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Confirmed mutations applied on top of the server props so the UI
  // reflects a 200 immediately — router.refresh() trues everything up,
  // but the row must not look unchanged while the RSC payload streams.
  const [revokedIds, setRevokedIds] = useState<ReadonlySet<string>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(new Set());

  const tokenRows = tokens.map((token) =>
    revokedIds.has(token.id) && !token.revokedAt
      ? { ...token, revokedAt: new Date().toISOString() }
      : token,
  );
  const unmappedRows = unmappedGroups.filter((group) => !resolvedIds.has(group.id));

  async function post(path: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function issueToken(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const name = tokenName.trim();
    if (!name) {
      setError("Give the token a name (e.g. “Okta production”).");
      return;
    }
    setIssuing(true);
    const res = await post("/district/sis/scim/tokens", { name });
    setIssuing(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Token could not be issued.");
      return;
    }
    const body = (await res.json()) as { plaintext: string };
    setIssued({ name, plaintext: body.plaintext });
    setTokenName("");
    setCopied(false);
    startTransition(() => router.refresh());
  }

  async function revoke(id: string) {
    setError(null);
    const res = await post("/district/sis/scim/tokens/revoke", { id });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Token could not be revoked.");
      return;
    }
    setRevokedIds((prev) => new Set(prev).add(id));
    startTransition(() => router.refresh());
  }

  async function resolveGroup(id: string) {
    setError(null);
    const res = await post("/district/sis/scim/unmapped/resolve", { id });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not mark as reviewed.");
      return;
    }
    setResolvedIds((prev) => new Set(prev).add(id));
    startTransition(() => router.refresh());
  }

  async function copyPlaintext() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.plaintext);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-10" data-testid="scim-section">
      <h2 className="text-xl font-black">SCIM provisioning (Okta / Microsoft Entra)</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Your identity provider creates, updates, and deactivates AIVO staff accounts
        automatically against <code className="font-mono text-xs">/scim/v2</code>. Push groups
        named <code className="font-mono text-xs">Class: &lt;School Name&gt; / &lt;Class Name&gt;</code>{" "}
        map to classrooms; everything else is recorded below for review. Setup steps live in the
        SCIM runbook.
      </p>

      {error ? <p className="admin-error mt-4">{error}</p> : null}

      <div className="admin-card mt-4 p-6">
        <h3 className="text-lg font-black">Bearer tokens</h3>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={issueToken}>
          <label className="block text-sm font-semibold text-slate-600">
            Token name
            <input
              className="admin-input"
              type="text"
              value={tokenName}
              onChange={(event) => setTokenName(event.target.value)}
              placeholder="Okta production"
              data-testid="scim-token-name"
            />
          </label>
          <button className="admin-button" type="submit" disabled={issuing} data-testid="scim-token-issue">
            Issue token
          </button>
        </form>

        {issued ? (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4" data-testid="scim-token-plaintext">
            <p className="text-sm font-bold text-amber-900">
              Copy “{issued.name}” now — it will not be shown again.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs">
                {issued.plaintext}
              </code>
              <button className="admin-button-secondary" type="button" onClick={copyPlaintext}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Created</th>
                <th>Last used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokenRows.map((token) => (
                <tr key={token.id}>
                  <td className="font-bold">{token.name}</td>
                  <td className="font-mono text-xs text-slate-500">{token.prefix}…</td>
                  <td className="text-sm">{formatWhen(token.createdAt)}</td>
                  <td className="text-sm">{formatWhen(token.lastUsedAt)}</td>
                  <td>
                    <span className="admin-status">{token.revokedAt ? "revoked" : "active"}</span>
                  </td>
                  <td>
                    {!token.revokedAt ? (
                      <button
                        className="text-sm font-semibold text-red-700 hover:underline"
                        type="button"
                        onClick={() => revoke(token.id)}
                        data-testid={`scim-token-revoke-${token.prefix}`}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {tokenRows.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-sm text-slate-500" colSpan={6}>
                    No SCIM tokens issued yet — issue one and paste it into your IdP’s
                    provisioning settings.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card mt-4 p-6">
        <h3 className="text-lg font-black">Sync activity</h3>
        <p className="mt-1 text-sm text-slate-600">
          Counted from the tamper-evident audit trail. Last provisioning call:{" "}
          <span className="font-semibold">{formatWhen(activity.lastSyncAt)}</span>.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3" data-testid="scim-counters">
          {COUNTER_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded border border-slate-200 p-3">
              <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
              <dd className="text-2xl font-black">{activity.counters[key] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="admin-card mt-4 p-6" data-testid="scim-unmapped">
        <h3 className="text-lg font-black">Group pushes needing review</h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Groups your IdP pushed that didn’t map to a class. They were skipped — not imported —
          and stay here until reviewed. Rename the group in your IdP to the class convention to
          import it.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Group name</th>
                <th>Why it was skipped</th>
                <th>Members</th>
                <th>Last pushed</th>
                <th>Pushes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {unmappedRows.map((group) => (
                <tr key={group.id}>
                  <td className="font-mono text-xs font-bold">{group.displayName}</td>
                  <td className="max-w-md text-sm">{REASON_COPY[group.reason] ?? group.reason}</td>
                  <td className="text-sm">{group.memberCount}</td>
                  <td className="text-sm">{formatWhen(group.lastSeenAt)}</td>
                  <td className="text-sm">{group.seenCount}</td>
                  <td>
                    <button
                      className="text-sm font-semibold text-blue-700 hover:underline"
                      type="button"
                      onClick={() => resolveGroup(group.id)}
                    >
                      Mark reviewed
                    </button>
                  </td>
                </tr>
              ))}
              {unmappedRows.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-sm text-slate-500" colSpan={6}>
                    Nothing waiting — every pushed group mapped cleanly.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
