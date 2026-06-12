"use client";

import * as React from "react";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { dismissToast, useToastQueue, type ToastRecord } from "@/lib/use-toast";
import { cn } from "@/lib/utils";

const VARIANT_CLASS: Record<ToastRecord["variant"], string> = {
  default: "border-iw-border bg-white",
  success:
    "border-[var(--aivo-domain-completion-complete-default)]/40 bg-[var(--aivo-domain-completion-complete-subtle)]",
  danger: "border-iw-danger/40 bg-iw-danger/10",
};

/**
 * Renders the imperative toast queue. Mounted once in the root layout.
 * Danger toasts are assertive alerts; the rest are polite status messages.
 */
export function Toaster() {
  const toasts = useToastQueue();
  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          duration={t.durationMs}
          onOpenChange={(open) => {
            if (!open) dismissToast(t.id);
          }}
          role={t.variant === "danger" ? "alert" : "status"}
          aria-live={t.variant === "danger" ? "assertive" : "polite"}
          className={cn("flex items-start gap-3", VARIANT_CLASS[t.variant])}
        >
          <div className="flex-1 min-w-0">
            <ToastTitle className="text-sm font-semibold text-iw-text-strong">
              {t.title}
            </ToastTitle>
            {t.description ? (
              <ToastDescription className="mt-0.5 text-sm text-iw-text-muted">
                {t.description}
              </ToastDescription>
            ) : null}
          </div>
          {t.action ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                t.action?.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </Button>
          ) : null}
        </Toast>
      ))}
      <ToastViewport aria-label="Notifications" />
    </ToastProvider>
  );
}
