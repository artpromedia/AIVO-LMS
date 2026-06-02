"use client";

import { useState, useTransition } from "react";
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

interface RequestSeatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSeats: number;
}

export function RequestSeatsModal({ open, onOpenChange, currentSeats }: RequestSeatsModalProps) {
  const [pending, start] = useTransition();
  const [requestedSeats, setRequestedSeats] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleClose() {
    setError(null);
    setSuccess(false);
    setRequestedSeats("");
    setJustification("");
    onOpenChange(false);
  }

  function handleSubmit() {
    const count = parseInt(requestedSeats, 10);
    if (!Number.isInteger(count) || count <= 0) {
      setError("Please enter a positive number of seats.");
      return;
    }
    if (!justification.trim()) {
      setError("Please provide a justification.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await fetch("/api/bff/admin/billing/request-seats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestedSeats: count, justification: justification.trim() }),
      });
      const json: { ok: boolean; error?: { message?: string } } = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to submit request. Please try again.");
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Request Additional Seats</DialogTitle>
        <DialogDescription>
          Your district currently allocates <strong>{currentSeats}</strong> seats to this school.
          Request additional seats from the district admin.
        </DialogDescription>

        {success ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-aivo-success/10 px-4 py-3 text-sm text-aivo-success">
              Your seat request has been submitted. The district admin will review it shortly.
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="requested-seats" className="mb-1.5 block text-sm font-medium">
                Number of additional seats requested
              </label>
              <Input
                id="requested-seats"
                type="number"
                min={1}
                value={requestedSeats}
                onChange={(e) => setRequestedSeats(e.target.value)}
                placeholder="e.g. 50"
                disabled={pending}
              />
            </div>
            <div>
              <label htmlFor="justification" className="mb-1.5 block text-sm font-medium">
                Justification
              </label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why additional seats are needed…"
                disabled={pending}
              />
            </div>
            {error && <p className="text-sm text-aivo-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" disabled={pending} onClick={handleClose}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleSubmit}
                disabled={pending || !requestedSeats || !justification.trim()}
              >
                {pending ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
