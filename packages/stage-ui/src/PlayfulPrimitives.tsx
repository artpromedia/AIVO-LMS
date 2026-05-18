import * as React from "react";

export function StagePlayfulButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        minHeight: 56,
        borderRadius: 24,
        border: 0,
        padding: "0 20px",
        background: "var(--aivo-semantic-color-interactive-primary-default, #3b82f6)",
        color: "var(--aivo-semantic-color-text-onPrimary, #fff)",
        ...(props.style ?? {}),
      }}
    />
  );
}

export function StagePlayfulCard(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        borderRadius: 24,
        border: "1px solid var(--aivo-semantic-color-border-subtle, #e5e7eb)",
        background: "var(--aivo-semantic-color-surface-base, #fff)",
        boxShadow: "var(--aivo-shadow-soft-2, 0 6px 12px rgba(59,130,246,.1))",
        ...(props.style ?? {}),
      }}
    />
  );
}
