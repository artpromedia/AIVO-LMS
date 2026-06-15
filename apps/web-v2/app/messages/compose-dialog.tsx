"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bffFetch } from "@/lib/api/client";
import { toast } from "@/lib/use-toast";

interface Contact {
  userId: string;
  displayName: string;
  role: string;
  learnerId: string;
  learnerName: string;
}

/** Encodes a (recipient, learner) pairing into a single Select value. */
const pairValue = (c: Pick<Contact, "userId" | "learnerId">) => `${c.userId}:${c.learnerId}`;

/**
 * Compose a new care-team thread. Recipients come from
 * `/api/bff/messages/contacts` (accepted care-team members only), so a parent
 * can only message someone already on a learner's team. `presetTo` /
 * `presetLearner` let the care-team page deep-link a pre-selected recipient.
 */
export function ComposeDialog({
  open,
  onOpenChange,
  presetTo,
  presetLearner,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetTo?: string | null;
  presetLearner?: string | null;
  onCreated: (threadId: string, subject: string) => void;
}) {
  const t = useTranslations("parent.compose");
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");

  const contactsQuery = useQuery({
    queryKey: ["messages", "contacts"],
    queryFn: () => bffFetch<{ contacts: Contact[] }>("/api/bff/messages/contacts"),
    enabled: open,
  });
  const contacts = contactsQuery.data?.contacts ?? [];

  // Preselect from a deep link, but only when that pairing is actually a valid
  // contact for this parent (never trust the URL to widen access).
  React.useEffect(() => {
    if (!open || !presetTo || !presetLearner) return;
    const wanted = `${presetTo}:${presetLearner}`;
    if (contacts.some((c) => pairValue(c) === wanted)) setSelected(wanted);
  }, [open, presetTo, presetLearner, contacts]);

  const selectedContact = contacts.find((c) => pairValue(c) === selected) ?? null;

  const send = useMutation({
    mutationFn: () => {
      const [recipientUserId, learnerId] = selected.split(":");
      return bffFetch<{ threadId: string }>("/api/bff/messages/threads", {
        method: "POST",
        body: { recipientUserId, learnerId, subject: subject.trim() || undefined, body: body.trim() },
      });
    },
    onSuccess: (data) => {
      const display = subject.trim() || selectedContact?.learnerName || t("title");
      void queryClient.invalidateQueries({ queryKey: ["messages", "threads"] });
      setBody("");
      setSubject("");
      setSelected("");
      onOpenChange(false);
      onCreated(data.threadId, display);
    },
    onError: () => {
      // Draft is preserved so the parent can retry without retyping.
      toast({ title: t("error_title"), description: t("error_body"), variant: "danger" });
    },
  });

  const canSend = selected !== "" && body.trim().length > 0 && !send.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("subtitle")}</DialogDescription>

        {contactsQuery.isPending ? (
          <p className="mt-3 text-sm text-aivo-ink-soft">{t("loading_contacts")}</p>
        ) : contacts.length === 0 ? (
          <p className="mt-3 text-sm text-aivo-ink-soft">{t("no_contacts")}</p>
        ) : (
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) send.mutate();
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="compose-to">{t("to")}</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="compose-to">
                  <SelectValue placeholder={t("to_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={pairValue(c)} value={pairValue(c)}>
                      {t("contact_line", {
                        name: c.displayName,
                        role: t(`role_${c.role}`),
                        learner: c.learnerName,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="compose-subject">{t("subject")}</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("subject_placeholder")}
                maxLength={200}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="compose-body">{t("message")}</Label>
              <Textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={t("message_placeholder")}
                required
              />
            </div>

            <div className="mt-1 flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!canSend}>
                {send.isPending ? t("sending") : t("send")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
