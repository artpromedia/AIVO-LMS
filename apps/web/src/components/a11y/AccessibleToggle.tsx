"use client";

interface AccessibleToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  id: string;
  color?: string;
}

export function AccessibleToggle({
  value,
  onChange,
  label,
  description,
  id,
  color = "bg-primary",
}: AccessibleToggleProps) {
  const labelId = `${id}-label`;
  const descId = description ? `${id}-desc` : undefined;

  return (
    <button
      id={id}
      role="switch"
      aria-checked={value}
      aria-labelledby={labelId}
      aria-describedby={descId}
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${value ? color : "bg-slate-200"}`}
    >
      <span
        className={`absolute w-5 h-5 rounded-full bg-white shadow top-0.5 transition ${value ? "left-[22px]" : "left-0.5"}`}
      />
      <span id={labelId} className="sr-only">
        {label}
      </span>
      {descId && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </button>
  );
}
