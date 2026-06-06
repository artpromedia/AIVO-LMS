import { describe, expect, it } from "vitest";
import { createGovernanceHandlers, verifyStoredHashLinks } from "../routes/governance.js";

interface Row {
  userId: string | null;
  onBehalfOfId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  prevHash: string;
  hash: string;
}

function fakeDb(rows: Row[]) {
  return {
    select() {
      return {
        from() {
          return {
            async where() {
              const count = rows.filter(
                (row) => row.userId === "subject-1" || row.onBehalfOfId === "subject-1",
              ).length;
              return [{ count }];
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Partial<Row>) {
          return {
            async where() {
              for (const row of rows) {
                if (row.userId === "subject-1" || row.onBehalfOfId === "subject-1") {
                  Object.assign(row, values);
                }
              }
            },
          };
        },
      };
    },
  };
}

const request = {
  subjectId: "subject-1",
  subjectType: "learner",
  tenantId: "tenant-1",
  dsarId: "dsar-1",
};

describe("audit governance hash-link preservation", () => {
  it("anonymizes actor PII without changing the stored forward chain", async () => {
    const rows: Row[] = [
      {
        userId: "other",
        onBehalfOfId: null,
        ipAddress: "10.0.0.1",
        userAgent: "one",
        prevHash: "",
        hash: "hash-1",
      },
      {
        userId: "subject-1",
        onBehalfOfId: null,
        ipAddress: "10.0.0.2",
        userAgent: "two",
        prevHash: "hash-1",
        hash: "hash-2",
      },
      {
        userId: "other",
        onBehalfOfId: "subject-1",
        ipAddress: "10.0.0.3",
        userAgent: "three",
        prevHash: "hash-2",
        hash: "hash-3",
      },
    ];
    const linksBefore = rows.map(({ prevHash, hash }) => ({ prevHash, hash }));

    const result = await createGovernanceHandlers(fakeDb(rows)).erase(request);

    expect(result).toEqual({ counts: {}, anonymizedCounts: { audit_events: 2 } });
    expect(rows.map(({ prevHash, hash }) => ({ prevHash, hash }))).toEqual(linksBefore);
    expect(verifyStoredHashLinks(rows)).toBe(true);
    expect(rows[1]).toMatchObject({
      userId: null,
      onBehalfOfId: null,
      ipAddress: null,
      userAgent: null,
    });
    expect(rows[2]).toMatchObject({
      userId: null,
      onBehalfOfId: null,
      ipAddress: null,
      userAgent: null,
    });
  });

  it("keeps an empty chain valid and reports zero anonymized rows", async () => {
    const rows: Row[] = [];

    const result = await createGovernanceHandlers(fakeDb(rows)).erase(request);

    expect(result).toEqual({ counts: {}, anonymizedCounts: { audit_events: 0 } });
    expect(verifyStoredHashLinks(rows)).toBe(true);
  });
});
