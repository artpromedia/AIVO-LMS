/**
 * Notification-preference persistence for the school-admin console.
 *
 * Stores a per-school matrix of event type × staff role → email on/off.
 * Follows the dpa-store precedent: in-memory for tests / local dev,
 * Postgres for production.
 */
import { adminNotificationPrefs } from "@aivo/db";
import { eq } from "drizzle-orm";

/** Each cell: event type × staff role → whether email is enabled. */
export type NotificationMatrix = Record<string, Record<string, boolean>>;

export const DEFAULT_EVENT_TYPES = [
  "learner_import_completed",
  "classroom_created",
  "classroom_roster_changed",
  "report_generated",
  "account_suspended",
  "intervention_alert",
];

export const DEFAULT_STAFF_ROLES = ["school_admin", "district_admin", "teacher", "co_teacher"];

export function buildDefaultMatrix(): NotificationMatrix {
  const matrix: NotificationMatrix = {};
  for (const evt of DEFAULT_EVENT_TYPES) {
    matrix[evt] = {};
    for (const role of DEFAULT_STAFF_ROLES) {
      // Admins get email on by default; teachers off by default.
      matrix[evt][role] = role.includes("admin");
    }
  }
  return matrix;
}

export interface NotificationStore {
  /** Returns the stored matrix, or the default template when none exists yet. */
  get(schoolId: string): Promise<NotificationMatrix>;
  /** Returns the previously stored matrix (for audit diffing), or null. */
  getRaw(schoolId: string): Promise<NotificationMatrix | null>;
  put(schoolId: string, matrix: NotificationMatrix, updatedBy?: string): Promise<void>;
}

export class InMemoryNotificationStore implements NotificationStore {
  private readonly rows = new Map<string, NotificationMatrix>();

  async getRaw(schoolId: string): Promise<NotificationMatrix | null> {
    return this.rows.get(schoolId) ?? null;
  }

  async get(schoolId: string): Promise<NotificationMatrix> {
    const existing = this.rows.get(schoolId);
    if (existing) return existing;
    const matrix = buildDefaultMatrix();
    this.rows.set(schoolId, matrix);
    return matrix;
  }

  async put(schoolId: string, matrix: NotificationMatrix): Promise<void> {
    this.rows.set(schoolId, matrix);
  }

  clear(): void {
    this.rows.clear();
  }
}

export class PostgresNotificationStore implements NotificationStore {
  constructor(private readonly db: any) {}

  async getRaw(schoolId: string): Promise<NotificationMatrix | null> {
    const rows = await this.db
      .select()
      .from(adminNotificationPrefs)
      .where(eq(adminNotificationPrefs.schoolId, schoolId))
      .limit(1);
    return rows[0] ? (rows[0].matrix as NotificationMatrix) : null;
  }

  async get(schoolId: string): Promise<NotificationMatrix> {
    const existing = await this.getRaw(schoolId);
    if (existing) return existing;
    const matrix = buildDefaultMatrix();
    // Seed the default so subsequent reads are stable and auditable.
    await this.db.insert(adminNotificationPrefs).values({ schoolId, matrix }).onConflictDoNothing();
    return matrix;
  }

  async put(schoolId: string, matrix: NotificationMatrix, updatedBy?: string): Promise<void> {
    await this.db
      .insert(adminNotificationPrefs)
      .values({ schoolId, matrix, updatedBy })
      .onConflictDoUpdate({
        target: adminNotificationPrefs.schoolId,
        set: { matrix, updatedBy, updatedAt: new Date() },
      });
  }
}

export function selectNotificationStore(db: any): NotificationStore {
  if (process.env.DATABASE_URL) return new PostgresNotificationStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "admin-svc: DATABASE_URL required in production. The in-memory NotificationStore " +
        "must NOT be used in production — notification preferences would be lost on restart.",
    );
  }
  return new InMemoryNotificationStore();
}
