import { eq } from "drizzle-orm";
import { serviceRuntimeState } from "@aivo/db";
import {
  createEmptyStatusStore,
  createSeededStatusStore,
  getStatusStore,
  replaceStatusStore,
  type StatusPageStore,
} from "./store.js";

const SERVICE_KEY = "status-page-svc";

type SerializedStatusPageStore = {
  components: unknown[];
  incidents: unknown[];
  updates: unknown[];
  maintenances: unknown[];
  subscribers: unknown[];
};

function serialize(store: StatusPageStore): SerializedStatusPageStore {
  return {
    components: [...store.components.values()],
    incidents: [...store.incidents.values()],
    updates: [...store.updates.values()],
    maintenances: [...store.maintenances.values()],
    subscribers: [...store.subscribers.values()],
  };
}

function deserialize(state: SerializedStatusPageStore): StatusPageStore {
  return {
    components: new Map((state.components ?? []).map((row: any) => [row.id, row])),
    incidents: new Map((state.incidents ?? []).map((row: any) => [row.id, row])),
    updates: new Map((state.updates ?? []).map((row: any) => [row.id, row])),
    maintenances: new Map((state.maintenances ?? []).map((row: any) => [row.id, row])),
    subscribers: new Map((state.subscribers ?? []).map((row: any) => [row.id, row])),
  };
}

export async function hydrateStatusStore(db: any): Promise<void> {
  const [row] = await db
    .select({ state: serviceRuntimeState.state })
    .from(serviceRuntimeState)
    .where(eq(serviceRuntimeState.service, SERVICE_KEY))
    .limit(1);
  if (row?.state) {
    replaceStatusStore(deserialize(row.state as SerializedStatusPageStore));
    return;
  }
  replaceStatusStore(
    process.env.NODE_ENV === "production" ? createEmptyStatusStore() : createSeededStatusStore(),
  );
  await persistStatusStore(db);
}

export async function persistStatusStore(db: any): Promise<void> {
  await db
    .insert(serviceRuntimeState)
    .values({ service: SERVICE_KEY, state: serialize(getStatusStore()), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: serviceRuntimeState.service,
      set: { state: serialize(getStatusStore()), updatedAt: new Date() },
    });
}
