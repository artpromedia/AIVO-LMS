import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { opsAlertOutboxStoreFromEnv } from "./factory.js";

describe("opsAlertOutboxStoreFromEnv", () => {
  it("falls back to memory and reports pgRequestedButUnwired when PG_TABLE is set without a client", async () => {
    const result = await opsAlertOutboxStoreFromEnv({
      service: "test-svc",
      env: { OPS_ALERTS_OUTBOX_PG_TABLE: "ops_alerts_outbox" },
    });
    assert.equal(result.store.kind, "memory");
    assert.equal(result.pgRequestedButUnwired, true);
  });

  it("falls back to file (not memory) when PG_TABLE is set without a client but FILE_PATH is provided", async () => {
    const result = await opsAlertOutboxStoreFromEnv({
      service: "test-svc",
      env: {
        OPS_ALERTS_OUTBOX_PG_TABLE: "ops_alerts_outbox",
        OPS_ALERTS_OUTBOX_FILE_PATH: "/tmp/aivo-test-outbox.jsonl",
      },
    });
    assert.equal(result.store.kind, "file");
    assert.equal(result.pgRequestedButUnwired, true);
  });

  it("throws when strict and PG_TABLE is set without a client", async () => {
    await assert.rejects(
      () =>
        opsAlertOutboxStoreFromEnv({
          service: "test-svc",
          strict: true,
          env: { OPS_ALERTS_OUTBOX_PG_TABLE: "ops_alerts_outbox" },
        }),
      /pgOutboxClient/,
    );
  });

  it("uses postgres store when both PG_TABLE and a client are provided", async () => {
    const result = await opsAlertOutboxStoreFromEnv({
      service: "test-svc",
      env: { OPS_ALERTS_OUTBOX_PG_TABLE: "ops_alerts_outbox" },
      pgOutboxClient: () => ({ query: async () => ({ rows: [], rowCount: 0 }) }),
    });
    assert.equal(result.store.kind, "postgres");
    assert.equal(result.pgRequestedButUnwired, false);
  });

  it("uses memory by default with no env set", async () => {
    const result = await opsAlertOutboxStoreFromEnv({ service: "test-svc", env: {} });
    assert.equal(result.store.kind, "memory");
    assert.equal(result.pgRequestedButUnwired, false);
  });
});
