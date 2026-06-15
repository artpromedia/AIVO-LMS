"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CalendarPlus, Video, MapPin, Phone, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bffFetch, isBffError } from "@/lib/api/client";
import { toast } from "@/lib/use-toast";

interface Provider {
  id: string;
  kind: "coach" | "therapist";
  displayName: string;
  specialty: string | null;
}
interface SessionDto {
  id: string;
  providerId: string;
  providerName: string;
  kind: "coach" | "therapist";
  specialty: string | null;
  title: string;
  scheduledStart: string;
  durationMinutes: number;
  location: "video" | "in_person" | "phone";
  status: "scheduled" | "completed" | "cancelled";
  feedback: string | null;
  cancelReason: string | null;
  canManage: boolean;
}

const LOCATION_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

function whenLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** datetime-local value (local wall time) → ISO instant. */
function localToIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function SessionsManager({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const t = useTranslations("parent.sessions");
  const queryClient = useQueryClient();
  const sessionsKey = ["sessions", learnerId] as const;
  const [bookOpen, setBookOpen] = React.useState(false);
  const [rescheduleFor, setRescheduleFor] = React.useState<SessionDto | null>(null);

  const sessionsQuery = useQuery({
    queryKey: sessionsKey,
    queryFn: () => bffFetch<{ sessions: SessionDto[] }>(`/api/bff/parent/learners/${learnerId}/sessions`),
  });
  const providersQuery = useQuery({
    queryKey: ["providers", learnerId],
    queryFn: () => bffFetch<{ providers: Provider[] }>(`/api/bff/parent/learners/${learnerId}/providers`),
    enabled: bookOpen,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const upcoming = sessions.filter((s) => s.status === "scheduled");
  const past = sessions.filter((s) => s.status !== "scheduled");

  function describeError(e: unknown): string {
    const code = isBffError(e) ? e.code : "";
    if (code === "PRECONDITION_FAILED") return t("err_unavailable");
    if (code === "CONFLICT") return t("err_conflict");
    if (code === "VALIDATION_FAILED") return t("err_invalid");
    return t("err_generic");
  }

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      bffFetch(`/api/bff/parent/sessions/${id}/cancel`, { method: "POST", body: {} }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsKey });
      toast({ title: t("cancelled_title") });
    },
    onError: (e) => toast({ title: t("err_title"), description: describeError(e), variant: "danger" }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-aivo-ink-soft">{t("intro", { name: learnerName })}</p>
        <Button onClick={() => setBookOpen(true)}>
          <CalendarPlus className="mr-1 h-4 w-4" aria-hidden /> {t("book")}
        </Button>
      </div>

      <section aria-label={t("upcoming")}>
        <h2 className="mb-2 text-sm font-semibold text-iw-text-strong">{t("upcoming")}</h2>
        {sessionsQuery.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : upcoming.length === 0 ? (
          <EmptyState title={t("none_upcoming_title")} description={t("none_upcoming_body")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                t={t}
                onReschedule={() => setRescheduleFor(s)}
                onCancel={() => cancelMutation.mutate(s.id)}
                cancelPending={cancelMutation.isPending}
              />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section aria-label={t("past")}>
          <h2 className="mb-2 text-sm font-semibold text-iw-text-strong">{t("past")}</h2>
          <ul className="flex flex-col gap-2">
            {past.map((s) => (
              <SessionRow key={s.id} session={s} t={t} />
            ))}
          </ul>
        </section>
      ) : null}

      <BookDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        providers={providersQuery.data?.providers ?? []}
        loadingProviders={providersQuery.isPending}
        learnerId={learnerId}
        t={t}
        describeError={describeError}
        onBooked={() => {
          void queryClient.invalidateQueries({ queryKey: sessionsKey });
          setBookOpen(false);
          toast({ title: t("booked_title") });
        }}
      />

      <RescheduleDialog
        session={rescheduleFor}
        onClose={() => setRescheduleFor(null)}
        t={t}
        describeError={describeError}
        onRescheduled={() => {
          void queryClient.invalidateQueries({ queryKey: sessionsKey });
          setRescheduleFor(null);
          toast({ title: t("rescheduled_title") });
        }}
      />
    </div>
  );
}

function SessionRow({
  session,
  t,
  onReschedule,
  onCancel,
  cancelPending,
}: {
  session: SessionDto;
  t: (k: string, v?: Record<string, string | number>) => string;
  onReschedule?: () => void;
  onCancel?: () => void;
  cancelPending?: boolean;
}) {
  const LocIcon = LOCATION_ICON[session.location];
  return (
    <li>
      <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-iw-text-strong">{session.providerName}</p>
            <span className="rounded-full bg-iw-raised px-2 py-0.5 text-xs text-aivo-ink-soft">
              {t(`kind_${session.kind}`)}
            </span>
            {session.status !== "scheduled" ? (
              <span className="rounded-full bg-iw-raised px-2 py-0.5 text-xs text-aivo-ink-soft">
                {t(`status_${session.status}`)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-aivo-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {whenLabel(session.scheduledStart)}
            </span>
            <span>{t("minutes", { count: session.durationMinutes })}</span>
            <span className="inline-flex items-center gap-1">
              <LocIcon className="h-3.5 w-3.5" aria-hidden /> {t(`location_${session.location}`)}
            </span>
          </p>
          {session.feedback ? (
            <p className="mt-1 text-sm text-aivo-ink">{session.feedback}</p>
          ) : null}
        </div>
        {session.canManage && onReschedule && onCancel ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={onReschedule}>
              {t("reschedule")}
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={cancelPending}>
              {t("cancel")}
            </Button>
          </div>
        ) : null}
      </Card>
    </li>
  );
}

function BookDialog({
  open,
  onOpenChange,
  providers,
  loadingProviders,
  learnerId,
  t,
  describeError,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  providers: Provider[];
  loadingProviders: boolean;
  learnerId: string;
  t: (k: string, v?: Record<string, string | number>) => string;
  describeError: (e: unknown) => string;
  onBooked: () => void;
}) {
  const [providerId, setProviderId] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [duration, setDuration] = React.useState("30");
  const [location, setLocation] = React.useState("video");

  const book = useMutation({
    mutationFn: () =>
      bffFetch(`/api/bff/parent/learners/${learnerId}/sessions`, {
        method: "POST",
        body: {
          providerId,
          scheduledStart: localToIso(when),
          durationMinutes: Number(duration),
          location,
        },
      }),
    onSuccess: onBooked,
    onError: (e) => toast({ title: t("err_title"), description: describeError(e), variant: "danger" }),
  });

  const canBook = providerId !== "" && when !== "" && !book.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("book_title")}</DialogTitle>
        <DialogDescription>{t("book_subtitle")}</DialogDescription>
        {loadingProviders ? (
          <p className="mt-3 text-sm text-aivo-ink-soft">{t("loading_providers")}</p>
        ) : providers.length === 0 ? (
          <p className="mt-3 text-sm text-aivo-ink-soft">{t("no_providers")}</p>
        ) : (
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canBook) book.mutate();
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="book-provider">{t("provider")}</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger id="book-provider">
                  <SelectValue placeholder={t("provider_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName} · {p.specialty ?? t(`kind_${p.kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="book-when">{t("when")}</Label>
              <Input
                id="book-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="book-duration">{t("duration")}</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="book-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["30", "45", "60"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {t("minutes", { count: Number(d) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="book-location">{t("location")}</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="book-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["video", "in_person", "phone"].map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`location_${l}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-1 flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!canBook}>
                {book.isPending ? t("booking") : t("confirm_book")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({
  session,
  onClose,
  t,
  describeError,
  onRescheduled,
}: {
  session: SessionDto | null;
  onClose: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  describeError: (e: unknown) => string;
  onRescheduled: () => void;
}) {
  const [when, setWhen] = React.useState("");
  React.useEffect(() => {
    setWhen("");
  }, [session?.id]);

  const reschedule = useMutation({
    mutationFn: () =>
      bffFetch(`/api/bff/parent/sessions/${session!.id}/reschedule`, {
        method: "POST",
        body: { newStart: localToIso(when) },
      }),
    onSuccess: onRescheduled,
    onError: (e) => toast({ title: t("err_title"), description: describeError(e), variant: "danger" }),
  });

  return (
    <Dialog open={session !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogTitle>{t("reschedule_title")}</DialogTitle>
        <DialogDescription>
          {session ? t("reschedule_subtitle", { name: session.providerName }) : ""}
        </DialogDescription>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (when && !reschedule.isPending) reschedule.mutate();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="resched-when">{t("new_time")}</Label>
            <Input
              id="resched-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              required
            />
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={when === "" || reschedule.isPending}>
              {reschedule.isPending ? t("rescheduling") : t("confirm_reschedule")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
