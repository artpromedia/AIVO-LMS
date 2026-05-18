"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

interface SearchResults {
  users: { id: string; name: string; email: string }[];
  learners: { id: string; name: string }[];
  tenants: { id: string; name: string }[];
}

export default function CommandPalette() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDialogElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  const search = useCallback(
    (q: string) => {
      if (!accessToken || !q.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      fetch(`/api/admin-svc/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setResults(d))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    },
    [accessToken],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setOpen(false);
    }
  };

  const hasResults =
    results &&
    (results.users.length > 0 || results.learners.length > 0 || results.tenants.length > 0);

  if (!open) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      open
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh] w-full h-full max-w-none max-h-none m-0 p-0 border-0"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400" strokeWidth={2} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, learners, tenants..."
            className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
          <kbd className="px-2 py-0.5 text-[10px] rounded border border-slate-200 text-slate-400 font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && <div className="p-4 text-center text-sm text-slate-400">Searching...</div>}

          {!loading && query.trim() && !hasResults && (
            <div className="p-8 text-center text-sm text-slate-400">No results found.</div>
          )}

          {!loading && hasResults && (
            <div className="py-2">
              {results!.users.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Users
                  </p>
                  {results!.users.map((u) => (
                    <Link
                      key={u.id}
                      href={`/dashboard/admin/users/${u.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                    >
                      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results!.learners.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Learners
                  </p>
                  {results!.learners.map((l) => (
                    <Link
                      key={l.id}
                      href={`/dashboard/admin/learners/${l.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                    >
                      <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                        {l.name?.charAt(0)?.toUpperCase() || "L"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{l.name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results!.tenants.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Tenants
                  </p>
                  {results!.tenants.map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/admin/tenants/${t.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                    >
                      <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                        {t.name?.charAt(0)?.toUpperCase() || "T"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{t.name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !query.trim() && (
            <div className="p-6 text-center text-sm text-slate-400">
              Type to search across the platform...
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
