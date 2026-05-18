"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

export function ImpersonationBanner() {
  const { user, isImpersonating, originalAdmin, exitImpersonation } = useAuth();
  const router = useRouter();

  if (!isImpersonating || !user) return null;

  const handleExit = async () => {
    await exitImpersonation();
    router.push("/dashboard/admin/users");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 flex items-center justify-center gap-4 text-sm font-semibold shadow-lg">
      <Eye className="w-4 h-4" strokeWidth={2.5} aria-hidden />
      <span>
        Viewing as <strong>{user.name}</strong> ({user.role.replace(/_/g, " ")})
        {originalAdmin && (
          <span className="opacity-80"> &middot; Logged in as {originalAdmin.name}</span>
        )}
      </span>
      <button
        onClick={handleExit}
        className="px-3 py-1 bg-white text-orange-600 rounded-full text-xs font-bold hover:bg-orange-50 transition"
      >
        Return to Admin
      </button>
    </div>
  );
}
