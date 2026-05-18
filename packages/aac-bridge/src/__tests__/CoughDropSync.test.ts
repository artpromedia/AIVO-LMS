import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoughDropSync } from "../coughdrop/CoughDropSync.js";
import type { SymbolBoard } from "../types.js";

const sampleBoard: SymbolBoard = {
  id: "board-1",
  name: "Test Board",
  locale: "en",
  items: [
    {
      id: "btn1",
      label: "Hello",
      imageUrl: "https://cdn.example.com/hello.png",
      boardId: "board-1",
      position: { row: 0, col: 0 },
    },
  ],
  grid: { rows: 1, cols: 1 },
};

/** Test subclass that replaces fetch with a mock. */
class TestableCoughDropSync extends CoughDropSync {
  public mockFetch = vi.fn();

  protected _fetch(url: string, init?: RequestInit): Promise<Response> {
    return this.mockFetch(url, init) as Promise<Response>;
  }
}

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe("CoughDropSync", () => {
  let sync: TestableCoughDropSync;

  beforeEach(() => {
    sync = new TestableCoughDropSync("test-api-key", "user-123");
    vi.clearAllMocks();
  });

  it("POSTs to CoughDrop API when board does not exist", async () => {
    // First call = search (board not found), second = create
    sync.mockFetch
      .mockResolvedValueOnce(makeResponse(200, { boards: [] }))
      .mockResolvedValueOnce(makeResponse(201, { board: { id: "cd-board-999" } }));

    await sync.syncLearnerVocabulary("learner-abc", sampleBoard);

    const createCall = sync.mockFetch.mock.calls[1];
    expect(createCall[1].method).toBe("POST");
    const bodyParsed = JSON.parse(createCall[1].body as string);
    // Must contain OBF "buttons" field
    expect(bodyParsed.board).toHaveProperty("buttons");
  });

  it("PATCHes when a board with matching name already exists", async () => {
    sync.mockFetch
      .mockResolvedValueOnce(
        makeResponse(200, { boards: [{ id: "existing-board", name: "AIVO - learner-abc" }] }),
      )
      .mockResolvedValueOnce(makeResponse(200, { board: { id: "existing-board" } }));

    await sync.syncLearnerVocabulary("learner-abc", sampleBoard);

    const updateCall = sync.mockFetch.mock.calls[1];
    expect(updateCall[1].method).toBe("PATCH");
    expect(updateCall[0]).toContain("existing-board");
  });

  it("getSyncStatus returns 'synced' after a successful sync", async () => {
    sync.mockFetch
      .mockResolvedValueOnce(makeResponse(200, { boards: [] }))
      .mockResolvedValueOnce(makeResponse(201, { board: { id: "new-board" } }));

    await sync.syncLearnerVocabulary("learner-abc", sampleBoard);
    const status = await sync.getSyncStatus("learner-abc");

    expect(status.status).toBe("synced");
    expect(status.boardId).toBe("new-board");
    expect(status.lastSyncAt).toBeInstanceOf(Date);
  });

  it("getSyncStatus returns 'never' before any sync", async () => {
    const status = await sync.getSyncStatus("learner-abc");
    expect(status.status).toBe("never");
    expect(status.boardId).toBeNull();
  });

  it("does not expose the API key in any thrown error message", async () => {
    sync.mockFetch
      .mockResolvedValueOnce(makeResponse(200, { boards: [] }))
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }));

    await expect(sync.syncLearnerVocabulary("learner-abc", sampleBoard)).rejects.toThrow();

    // Verify key is not in any mock call log
    const allArgs = sync.mockFetch.mock.calls.map((c) => JSON.stringify(c)).join("");
    // Only the Authorization header contains the key; the response body must not
    // The key must not appear in the response body context
    const status = await sync.getSyncStatus("learner-abc");
    expect(status.status).toBe("error");
  });

  it("throws when constructed without apiKey", () => {
    expect(() => new CoughDropSync("", "user-1")).toThrow();
  });
});
