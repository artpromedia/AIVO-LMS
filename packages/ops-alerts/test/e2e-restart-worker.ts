// Helper worker for e2e-restart.test.ts — boots an OpsAlertClient with the
// FileOpsAlertOutboxStore at OUTBOX_PATH, performs the action passed via
// argv[2], then exits. NOT a service — never load directly.
import { OpsAlertClient } from "../src/client.js";
import { FileOpsAlertOutboxStore } from "../src/stores/file.js";

async function main() {
  const action = process.argv[2];
  const outboxPath = process.env.OUTBOX_PATH;
  const proxyUrl = process.env.PROXY_URL;
  if (!outboxPath || !proxyUrl) {
    console.error("missing OUTBOX_PATH or PROXY_URL");
    process.exit(2);
  }

  const client = new OpsAlertClient({
    service: "e2e-test-svc",
    proxyUrl,
    outbox: new FileOpsAlertOutboxStore(outboxPath),
    autoFlushIntervalMs: 0,
    attemptTimeoutMs: 1500,
    logger: { warn: () => {}, info: () => {}, error: () => {}, fatal: () => {} } as any,
  });

  if (action === "queue") {
    await client.page({
      severity: "critical",
      title: "e2e: queued before kill",
      message: "should survive restart",
      context: { phase: "pre-kill" },
    });
    process.stdout.write("queued\n");
    process.exit(0);
  }
  if (action === "drain") {
    const result = await client.flushOutbox();
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exit(0);
  }
  console.error(`unknown action: ${action}`);
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
