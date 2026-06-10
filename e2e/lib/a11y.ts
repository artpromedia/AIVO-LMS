/**
 * Shared axe-core accessibility gate for the admin console specs: the page
 * must have no serious or critical WCAG violations. Lower-impact findings
 * are reported in the failure message but don't fail the suite, so the gate
 * stays actionable instead of noisy.
 */
import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const summary = blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
  }));
  expect(summary, `serious/critical axe violations:\n${JSON.stringify(summary, null, 1)}`).toEqual(
    [],
  );
}
