import { useId, type ReactNode } from "react";
import { ProductMockupFrame } from "../primitives/ProductMockupFrame";

export function MockupShowcase({
  eyebrow,
  heading,
  body,
  bullets,
  mockupTitle,
  mockup,
  reverse = false,
}: {
  eyebrow?: string;
  heading: string;
  body: ReactNode;
  bullets?: string[];
  mockupTitle?: string;
  mockup: ReactNode;
  reverse?: boolean;
}) {
  const headingId = useId();
  return (
    <section className="mb-14" aria-labelledby={headingId}>
      <div className="grid gap-8 lg:grid-cols-2 items-center">
        <div className={reverse ? "lg:order-2" : ""}>
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wider text-iw-primary">{eyebrow}</p>
          )}
          <h2
            id={headingId}
            className="mt-2 font-heading text-2xl md:text-3xl font-bold text-iw-ink"
          >
            {heading}
          </h2>
          <div className="mt-3 text-iw-ink-muted font-body leading-relaxed">{body}</div>
          {bullets && bullets.length > 0 && (
            <ul className="mt-5 space-y-2">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2 text-iw-ink font-body text-sm">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-iw-primary" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        <ProductMockupFrame title={mockupTitle} className={reverse ? "lg:order-1" : ""}>
          {mockup}
        </ProductMockupFrame>
      </div>
    </section>
  );
}
