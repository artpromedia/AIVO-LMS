"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, HeartHandshake, Brain, Users } from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";

interface TeamMember {
  id: string;
  memberType: "teacher" | "caregiver" | "therapist";
  teacherEmail?: string;
  caregiverEmail?: string;
  therapistEmail?: string;
  status: string;
  relationship?: string;
  specialty?: string;
  credentials?: string;
  invitedAt: string;
  acceptedAt?: string;
}

const ROLE_COLOR: Record<"teacher" | "caregiver" | "therapist", string> = {
  teacher: "reading",
  caregiver: "science",
  therapist: "primary",
};

const ROLE_HSL: Record<"teacher" | "caregiver" | "therapist", string> = {
  teacher: "199 89% 48%",
  caregiver: "142 71% 45%",
  therapist: "262 83% 58%",
};

export default function CollaborationPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");
  const tCommon = useTranslations("common");

  interface SeatInfo { used: number; max: number }
  interface MembersState {
    teachers: TeamMember[];
    caregivers: TeamMember[];
    therapists: TeamMember[];
    seats?: { teacher: SeatInfo; caregiver: SeatInfo; therapist: SeatInfo };
  }
  const [members, setMembers] = useState<MembersState>({
    teachers: [], caregivers: [], therapists: [],
  });
  const [showInvite, setShowInvite] = useState<"teacher" | "caregiver" | "therapist" | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState("");
  const [inviteSpecialty, setInviteSpecialty] = useState("");
  const [inviteCredentials, setInviteCredentials] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    if (!accessToken || !learnerId) return;
    try {
      const res = await fetch(`/api/family/collaboration/${learnerId}/members`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  useEffect(() => { fetchMembers(); }, [accessToken, learnerId]);

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showInvite || !inviteEmail) return;
    setSubmitting(true);
    setError("");

    const body: Record<string, string> = { email: inviteEmail };
    if (showInvite === "caregiver") body.relationship = inviteRelationship;
    if (showInvite === "therapist") {
      body.specialty = inviteSpecialty;
      body.credentials = inviteCredentials;
    }

    try {
      const res = await fetch(`/api/family/collaboration/${learnerId}/invite/${showInvite}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowInvite(null);
        setInviteEmail("");
        setInviteRelationship("");
        setInviteSpecialty("");
        setInviteCredentials("");
        fetchMembers();
      } else {
        const data = await res.json();
        setError(data.error || t("failed_invite"));
      }
    } catch {
      setError(t("network_error_retry"));
    }
    setSubmitting(false);
  };

  const removeMember = async (memberId: string, memberType: string) => {
    if (!confirm(t("remove_team_member"))) return;
    try {
      await fetch(`/api/family/collaboration/${learnerId}/member/${memberId}?memberType=${memberType}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      fetchMembers();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const getEmail = (m: TeamMember) => m.teacherEmail || m.caregiverEmail || m.therapistEmail || "";

  if (loading || !user) return null;

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
    ACCEPTED: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
    ACTIVE: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
    DECLINED: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  };

  const allMembers = [
    ...members.teachers.map(m => ({ ...m, memberType: "teacher" as const })),
    ...members.caregivers.map(m => ({ ...m, memberType: "caregiver" as const })),
    ...members.therapists.map(m => ({ ...m, memberType: "therapist" as const })),
  ];

  const ROLE_ICON: Record<"teacher" | "caregiver" | "therapist", React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
    teacher: GraduationCap,
    caregiver: HeartHandshake,
    therapist: Brain,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text">{t("learning_team")}</h1>
        <p className="vi-text-muted mt-1">{t("collaborate_desc")}</p>
      </div>

      {members.seats && (
        <div className="grid grid-cols-3 gap-4">
          {([
            { key: "teacher" as const, label: t("invite_teacher") },
            { key: "caregiver" as const, label: t("invite_caregiver") },
            { key: "therapist" as const, label: t("invite_therapist") },
          ] as const).map(({ key, label }) => {
            const seat = members.seats![key];
            const isFull = seat.used >= seat.max;
            const color = ROLE_COLOR[key];
            const hsl = ROLE_HSL[key];
            const Icon = ROLE_ICON[key];
            return (
              <div
                key={key}
                className="vi-card p-4"
                style={isFull ? undefined : { background: `hsl(${hsl} / 0.06)`, borderColor: `hsl(${hsl} / 0.3)` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <IconWell color={color} size="sm"><Icon className="w-5 h-5" strokeWidth={2.5} /></IconWell>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={isFull
                      ? { background: "rgb(226 232 240)", color: "rgb(100 116 139)" }
                      : { background: `hsl(${hsl} / 0.12)`, color: `hsl(${hsl})` }}
                  >
                    {seat.used}/{seat.max}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800 capitalize mb-2">{key}</p>
                <button
                  onClick={() => !isFull && setShowInvite(key)}
                  disabled={isFull}
                  className={`w-full px-4 py-2 rounded-full text-sm font-bold transition ${
                    isFull ? "vi-surface-soft vi-text-muted cursor-not-allowed" : "text-white hover:opacity-90"
                  }`}
                  style={isFull ? { minHeight: "44px" } : { background: `hsl(${hsl})`, minHeight: "44px" }}
                >
                  {isFull ? t("seats_full") : label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!members.seats && (
        <div className="flex gap-3">
          {(["teacher", "caregiver", "therapist"] as const).map((key) => {
            const hsl = ROLE_HSL[key];
            const labelKey = key === "teacher" ? "invite_teacher" : key === "caregiver" ? "invite_caregiver" : "invite_therapist";
            return (
              <button
                key={key}
                onClick={() => setShowInvite(key)}
                className="px-5 py-2.5 rounded-full font-bold transition text-sm hover:opacity-90"
                style={{ background: `hsl(${hsl} / 0.12)`, color: `hsl(${hsl})`, minHeight: "44px" }}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {showInvite && (
        <form onSubmit={inviteMember} className="vi-card p-6 space-y-4">
          <h3 className="font-heading font-bold text-lg vi-text capitalize">
            {t("invite_title", { type: showInvite })}
          </h3>

          {error && (
            <div className="p-3 rounded-xl text-sm font-semibold bg-[hsl(var(--visual-math)/0.08)] text-[hsl(var(--visual-math))]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">{t("email_address")}</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border vi-border focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none font-body"
              style={{ minHeight: "44px" }} />
          </div>

          {showInvite === "caregiver" && (
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">{t("relationship")}</label>
              <input type="text" value={inviteRelationship} onChange={(e) => setInviteRelationship(e.target.value)}
                placeholder={t("relationship_placeholder")}
                className="w-full px-4 py-2.5 rounded-xl border vi-border focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none font-body"
                style={{ minHeight: "44px" }} />
            </div>
          )}

          {showInvite === "therapist" && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">{t("specialty")}</label>
                <input type="text" value={inviteSpecialty} onChange={(e) => setInviteSpecialty(e.target.value)}
                  placeholder={t("specialty_placeholder")}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none font-body"
                  style={{ minHeight: "44px" }} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">{t("credentials")}</label>
                <input type="text" value={inviteCredentials} onChange={(e) => setInviteCredentials(e.target.value)}
                  placeholder={t("credentials_placeholder")}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none font-body"
                  style={{ minHeight: "44px" }} />
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50"
              style={{ minHeight: "44px" }}>
              {submitting ? t("sending") : t("send_invite")}
            </button>
            <button type="button" onClick={() => { setShowInvite(null); setError(""); }}
              className="px-6 py-2.5 rounded-full vi-surface-soft vi-text-muted font-bold hover:bg-[hsl(var(--visual-border))] transition"
              style={{ minHeight: "44px" }}>
              {tCommon("cancel")}
            </button>
          </div>

          {showInvite === "teacher" && (
            <p className="text-xs vi-text-muted">{t("teacher_slot_info")}</p>
          )}
          {showInvite === "caregiver" && (
            <p className="text-xs vi-text-muted">{t("caregiver_slot_info")}</p>
          )}
          {showInvite === "therapist" && (
            <p className="text-xs vi-text-muted">{t("therapist_slot_info")}</p>
          )}
        </form>
      )}

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-xl vi-text mb-4">{t("team_members")}</h2>

        {allMembers.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto inline-flex mb-3">
              <IconWell color="primary" size="md"><Users className="w-7 h-7" strokeWidth={2.5} /></IconWell>
            </div>
            <p className="vi-text-muted font-semibold">{t("no_team_members")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allMembers.map((m) => {
              const hsl = ROLE_HSL[m.memberType];
              return (
                <div key={m.id} className="flex items-center justify-between p-4 rounded-xl vi-surface-soft border vi-border">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: `hsl(${hsl})` }}
                    >
                      {m.memberType === "teacher" ? "T" : m.memberType === "caregiver" ? "C" : "Th"}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{getEmail(m)}</div>
                      <div className="text-xs vi-text-muted capitalize">
                        {m.memberType}
                        {m.relationship && ` — ${m.relationship}`}
                        {m.specialty && ` — ${m.specialty}`}
                        {m.credentials && ` (${m.credentials})`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs rounded-full font-bold ${STATUS_COLORS[m.status] || "vi-surface-soft vi-text-muted"}`}>
                      {m.status}
                    </span>
                    <button onClick={() => removeMember(m.id, m.memberType)}
                      className="text-xs text-[hsl(var(--visual-math))] hover:opacity-80 font-bold transition">
                      {tCommon("remove")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
