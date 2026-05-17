/**
 * CoughDropSync — synchronises AIVO learner vocabulary to a parent's
 * CoughDrop account using the CoughDrop REST API v1.
 */
import { exportToOBF } from "../obf/OBFExporter.js";
import type { SymbolBoard } from "../types.js";

const COUGHDROP_API_BASE = "https://app.coughdrop.com/api/v1";

export type SyncStatus = "synced" | "pending" | "error" | "never";

export interface SyncState {
  lastSyncAt: Date | null;
  boardId: string | null;
  status: SyncStatus;
}

export class CoughDropSync {
  private apiKey: string;
  private userId: string;
  private syncState: SyncState = { lastSyncAt: null, boardId: null, status: "never" };

  constructor(apiKey: string, userId: string) {
    if (!apiKey || !userId) throw new Error("CoughDropSync: apiKey and userId are required");
    this.apiKey = apiKey;
    this.userId = userId;
  }

  async syncLearnerVocabulary(learnerId: string, board: SymbolBoard): Promise<void> {
    const boardName = `AIVO - ${learnerId}`;
    const obfPayload = exportToOBF(board);

    let existingBoardId: string | null = null;
    try {
      existingBoardId = await this._findBoard(boardName);
    } catch (err) {
      this.syncState = { lastSyncAt: null, boardId: null, status: "error" };
      throw err;
    }

    try {
      const url = existingBoardId
        ? `${COUGHDROP_API_BASE}/boards/${existingBoardId}`
        : `${COUGHDROP_API_BASE}/boards`;
      const method = existingBoardId ? "PATCH" : "POST";

      const res = await this._fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ board: { ...obfPayload, name: boardName, user_id: this.userId } }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CoughDrop API error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { board?: { id?: string } };
      const boardId = data?.board?.id ? String(data.board.id) : (existingBoardId ?? null);
      this.syncState = { lastSyncAt: new Date(), boardId, status: "synced" };
    } catch (err) {
      this.syncState = { ...this.syncState, status: "error" };
      throw err;
    }
  }

  async getSyncStatus(_learnerId: string): Promise<SyncState> {
    return { ...this.syncState };
  }

  private async _findBoard(name: string): Promise<string | null> {
    const res = await this._fetch(
      `${COUGHDROP_API_BASE}/boards?q=${encodeURIComponent(name)}&user_id=${this.userId}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { boards?: Array<{ id: string; name: string }> };
    const match = data?.boards?.find((b) => b.name === name);
    return match?.id ?? null;
  }

  /**
   * Thin fetch wrapper — override in tests with a mock.
   * @internal
   */
  protected _fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}
