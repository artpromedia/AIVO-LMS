import { describe, expect, it } from "vitest";
import {
  approveDeletion,
  createDeletionRequest,
  finalizeHardDelete,
  markReadyForHardDelete,
} from "../services/deletion-workflow.js";

describe("deletion workflow", () => {
  it("blocks when an active retention hold is present", () => {
    const request = createDeletionRequest({
      learnerId: "l1",
      requesterId: "u1",
      requesterRole: "parent",
      retentionHolds: [{ districtId: "d1", reason: "legal hold" }],
    });
    expect(request.status).toBe("BLOCKED_BY_RETENTION_HOLD");
  });

  it("transitions PENDING_REVIEW -> SOFT_DELETED -> READY -> HARD_DELETED", () => {
    let req = createDeletionRequest({
      learnerId: "l1",
      requesterId: "u1",
      requesterRole: "parent",
      retentionHolds: [],
    });
    expect(req.status).toBe("PENDING_REVIEW");
    req = approveDeletion(req);
    expect(req.status).toBe("SOFT_DELETED");
    req = markReadyForHardDelete(req);
    expect(req.status).toBe("READY_FOR_HARD_DELETE");
    req = finalizeHardDelete(req);
    expect(req.status).toBe("HARD_DELETED");
  });

  it("refuses to approve a deletion that is blocked by a hold", () => {
    const request = createDeletionRequest({
      learnerId: "l1",
      requesterId: "u1",
      requesterRole: "parent",
      retentionHolds: [{ districtId: "d1", reason: "legal hold" }],
    });
    expect(() => approveDeletion(request)).toThrow();
  });

  it("treats an expired hold as inactive", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const request = createDeletionRequest({
      learnerId: "l1",
      requesterId: "u1",
      requesterRole: "parent",
      retentionHolds: [{ districtId: "d1", reason: "expired", expiresAt: past }],
    });
    expect(request.status).toBe("PENDING_REVIEW");
  });
});
