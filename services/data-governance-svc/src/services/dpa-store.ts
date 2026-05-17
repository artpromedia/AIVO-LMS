import { randomUUID } from "node:crypto";

export interface DpaAcceptanceInput {
  districtId: string;
  version: string;
  acceptedById: string;
  acceptedByName: string;
  acceptedByRole: string;
}

export interface DpaRecord extends DpaAcceptanceInput {
  id: string;
  acceptedAt: string;
}

export class InMemoryDpaStore {
  private records = new Map<string, DpaRecord[]>();

  acceptDpa(input: DpaAcceptanceInput): DpaRecord {
    const record: DpaRecord = {
      id: randomUUID(),
      acceptedAt: new Date().toISOString(),
      ...input,
    };
    const list = this.records.get(input.districtId) ?? [];
    list.push(record);
    this.records.set(input.districtId, list);
    return record;
  }

  latestForDistrict(districtId: string): DpaRecord | undefined {
    const list = this.records.get(districtId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  listForDistrict(districtId: string): DpaRecord[] {
    return [...(this.records.get(districtId) ?? [])];
  }
}
