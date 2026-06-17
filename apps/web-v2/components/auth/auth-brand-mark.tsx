import Image from "next/image";

/**
 * AivoBrandMark — the official AIVO Learning logo lockup that tops every auth
 * card, with an optional tracked contextual sublabel beneath it (Family /
 * Account / Schools). The logo is the real horizontal brand artwork served
 * from public/images; the sublabel still flows through the iw-* sensory tokens.
 */
export function AivoBrandMark({
  sublabel,
  align = "center",
  className,
}: {
  sublabel?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-1.5",
        align === "center" ? "items-center" : "items-start",
        className ?? "",
      ].join(" ")}
    >
      <Image
        src="/images/aivo-logo-purple.png"
        alt="AIVO Learning"
        width={149}
        height={60}
        priority
        className="h-10 w-auto"
      />
      {sublabel ? (
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-iw-accent">
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

AivoBrandMark.displayName = "Auth/AivoBrandMark";
