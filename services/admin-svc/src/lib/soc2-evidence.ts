/**
 * Sprint 11 — SOC 2 evidence bundle generator.
 *
 * Once per day, generate a gzipped tarball containing four artifacts:
 *
 *   1. `access-review.csv` — every internal-role user with last-login
 *      timestamp and MFA enrollment status (CC6.1, CC6.2).
 *   2. `audit-merkle.json` — admin-audit-log row count, latest seq, and
 *      the hash of the last row (which by construction commits to every
 *      previous row via prevHash chaining → effectively a Merkle root)
 *      (CC7.2).
 *   3. `config-history.json` — last 30 days of platform_config diffs
 *      with author + timestamp (CC8.1).
 *   4. `backup-verification.json` — output of the most recent backup
 *      verification run (CC7.5). Pulled from the `backup-verify` GitHub
 *      Action artifact when present, otherwise an explicit unverified result.
 *
 * The bundle is written to `EVIDENCE_DIR` (default `data/evidence/`)
 * and a row is inserted in `evidence_bundles` with the sha256 hash so
 * auditors can verify integrity from the compliance UI.
 *
 * Production additionally uploads the bundle to an S3 bucket with
 * Object Lock COMPLIANCE retention enabled. Local development may omit
 * `EVIDENCE_S3_BUCKET`; production fails closed when it is missing.
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { gzipSync } from "zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { users, adminAuditLog, platformConfig, evidenceBundles, sessions } from "@aivo/db";
import { desc, sql, eq, gte } from "drizzle-orm";
import { createDrizzleAdvisoryLock, createDrizzleLedger, startSafeCron } from "@aivo/scheduling";

const INTERNAL_ROLES = [
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
];

export const EVIDENCE_DIR =
  process.env.EVIDENCE_DIR || path.resolve(process.cwd(), "data/evidence");

interface BundleSummary {
  accessReviewRows: number;
  auditLogRows: number;
  auditLatestSeq: number | null;
  auditLatestHash: string | null;
  configChanges: number;
  backupVerified: boolean;
  wormStorageUri: string | null;
  retentionUntil: string | null;
}

async function uploadEvidenceToWorm(
  body: Buffer,
  filename: string,
  sha256: string,
): Promise<{ storageUri: string; retentionUntil: Date } | null> {
  const bucket = process.env.EVIDENCE_S3_BUCKET;
  if (!bucket) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EVIDENCE_S3_BUCKET is required in production for immutable SOC 2 evidence");
    }
    return null;
  }
  const region = process.env.EVIDENCE_S3_REGION || process.env.AWS_REGION;
  if (!region) throw new Error("EVIDENCE_S3_REGION or AWS_REGION is required for evidence upload");
  const prefix = (process.env.EVIDENCE_S3_PREFIX || "soc2-evidence").replace(/^\/+|\/+$/g, "");
  const key = `${prefix}/${filename}`;
  const retentionYears = Number.parseInt(process.env.EVIDENCE_RETENTION_YEARS || "7", 10);
  const retentionUntil = new Date();
  retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + retentionYears);
  const sseKmsKeyId = process.env.EVIDENCE_S3_KMS_KEY_ID;

  await new S3Client({ region }).send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
      ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
      Metadata: { sha256 },
      ObjectLockMode: "COMPLIANCE",
      ObjectLockRetainUntilDate: retentionUntil,
      ServerSideEncryption: sseKmsKeyId ? "aws:kms" : "AES256",
      SSEKMSKeyId: sseKmsKeyId,
    }),
  );
  return { storageUri: `s3://${bucket}/${key}`, retentionUntil };
}

/** Build a single tar entry header (POSIX ustar) — minimal but valid. */
function tarHeader(name: string, size: number): Buffer {
  const buf = Buffer.alloc(512);
  buf.write(name.slice(0, 100), 0, 100, "utf8");
  buf.write("0000644", 100, 7, "utf8"); // mode
  buf.write("0000000", 108, 7, "utf8"); // uid
  buf.write("0000000", 116, 7, "utf8"); // gid
  buf.write(size.toString(8).padStart(11, "0"), 124, 11, "utf8");
  buf.write(
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, "0"),
    136,
    11,
    "utf8",
  );
  buf.write("        ", 148, 8, "utf8"); // checksum field is spaces while calculating
  buf.write("0", 156, 1, "utf8"); // typeflag = regular file
  buf.write("ustar  ", 257, 8, "utf8");
  // checksum
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += buf[i];
  buf.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8");
  return buf;
}

function tarPad(size: number): Buffer {
  const r = size % 512;
  return r === 0 ? Buffer.alloc(0) : Buffer.alloc(512 - r);
}

function buildTar(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  for (const e of entries) {
    parts.push(tarHeader(e.name, e.data.length));
    parts.push(e.data);
    parts.push(tarPad(e.data.length));
  }
  parts.push(Buffer.alloc(1024)); // two zero blocks to mark end
  return Buffer.concat(parts);
}

async function buildAccessReview(db: any): Promise<{ csv: string; rows: number }> {
  // Last successful login per user via sessions.createdAt MAX.
  //
  // Task #74: drizzle binds JS arrays as a *tuple* of parameters
  // (`ANY($1, $2, ...$N)` instead of `ANY($1::text[])`), which Postgres rejects
  // with "op ANY/ALL (array) requires array". We instead build the ARRAY[]
  // literal at template-substitution time. INTERNAL_ROLES is a hard-coded
  // constant, so SQL injection isn't a concern.
  const rolesArray = sql.raw(
    `ARRAY[${INTERNAL_ROLES.map((r) => `'${r}'`).join(",")}]::user_role[]`,
  );
  const rows = await db.execute(sql`
    SELECT u.id, u.email, u.name, u.role, u.tenant_id,
           u.mfa_enabled,
           (u.totp_secret_encrypted IS NOT NULL) AS totp_enrolled,
           u.last_login_at,
           (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_session_at
    FROM users u
    WHERE u.role = ANY(${rolesArray})
    ORDER BY u.role, u.email
  `);
  const data: any[] = (rows as any).rows ?? rows;
  const header =
    "user_id,email,name,role,tenant_id,mfa_enabled,totp_enrolled,last_login_at,last_session_at";
  const lines = data.map((r: any) =>
    [
      r.id,
      r.email,
      r.name?.replace(/,/g, " "),
      r.role,
      r.tenant_id ?? "",
      r.mfa_enabled ? "true" : "false",
      r.totp_enrolled ? "true" : "false",
      r.last_login_at?.toISOString?.() ?? r.last_login_at ?? "",
      r.last_session_at?.toISOString?.() ?? r.last_session_at ?? "",
    ].join(","),
  );
  return { csv: [header, ...lines].join("\n") + "\n", rows: data.length };
}

async function buildAuditMerkle(db: any) {
  const [count] = await db.select({ c: sql<number>`COUNT(*)::int` }).from(adminAuditLog);
  const [latest] = await db
    .select({ seq: adminAuditLog.seq, hash: adminAuditLog.hash })
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.seq))
    .limit(1);
  return {
    rows: Number(count?.c ?? 0),
    latestSeq: latest?.seq ?? null,
    latestHash: latest?.hash ?? null,
    chainAlgorithm: "sha256(prev_hash || canonical_json(row))",
    note: "The latest hash commits to every prior row via prev_hash chaining; treat as the Merkle root for the tamper-evident log.",
  };
}

async function buildConfigHistory(db: any) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: platformConfig.id,
      changedBy: platformConfig.changedBy,
      changeDescription: platformConfig.changeDescription,
      createdAt: platformConfig.createdAt,
      config: platformConfig.config,
    })
    .from(platformConfig)
    .where(gte(platformConfig.createdAt, since))
    .orderBy(desc(platformConfig.createdAt));
  return { windowDays: 30, count: rows.length, changes: rows };
}

async function buildBackupVerification(): Promise<{ verified: boolean; details: any }> {
  const proofPath =
    process.env.BACKUP_VERIFICATION_PROOF ||
    path.resolve(process.cwd(), "data/backup-verification.json");
  try {
    const txt = await fs.readFile(proofPath, "utf8");
    const parsed = JSON.parse(txt);
    return { verified: parsed.verified === true, details: parsed };
  } catch {
    return {
      verified: false,
      details: {
        note: "No backup verification artifact present in window. Wire the backup-verify GitHub Action to drop its result at BACKUP_VERIFICATION_PROOF.",
      },
    };
  }
}

export async function generateEvidenceBundle(
  db: any,
  opts: { date?: Date } = {},
): Promise<{
  bundleDate: string;
  filename: string;
  filepath: string;
  sizeBytes: number;
  sha256: string;
  summary: BundleSummary;
}> {
  const date = opts.date ?? new Date();
  const bundleDate = date.toISOString().slice(0, 10);

  const [access, auditMerkle, configHistory, backup] = await Promise.all([
    buildAccessReview(db),
    buildAuditMerkle(db),
    buildConfigHistory(db),
    buildBackupVerification(),
  ]);

  const entries = [
    { name: "access-review.csv", data: Buffer.from(access.csv, "utf8") },
    { name: "audit-merkle.json", data: Buffer.from(JSON.stringify(auditMerkle, null, 2), "utf8") },
    {
      name: "config-history.json",
      data: Buffer.from(JSON.stringify(configHistory, null, 2), "utf8"),
    },
    {
      name: "backup-verification.json",
      data: Buffer.from(JSON.stringify(backup, null, 2), "utf8"),
    },
    {
      name: "manifest.json",
      data: Buffer.from(
        JSON.stringify(
          {
            bundleDate,
            generatedAt: new Date().toISOString(),
            artifacts: [
              "access-review.csv",
              "audit-merkle.json",
              "config-history.json",
              "backup-verification.json",
            ],
            controls: {
              "CC6.1": "access-review.csv",
              "CC6.2": "access-review.csv",
              "CC7.2": "audit-merkle.json",
              "CC7.5": "backup-verification.json",
              "CC8.1": "config-history.json",
            },
          },
          null,
          2,
        ),
        "utf8",
      ),
    },
  ];

  const tar = buildTar(entries);
  const gz = gzipSync(tar);
  const sha256 = createHash("sha256").update(gz).digest("hex");
  const filename = `soc2-evidence-${bundleDate}.tar.gz`;

  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  const filepath = path.join(EVIDENCE_DIR, filename);
  await fs.writeFile(filepath, gz, { mode: 0o440 });
  const worm = await uploadEvidenceToWorm(gz, filename, sha256);

  const summary: BundleSummary = {
    accessReviewRows: access.rows,
    auditLogRows: auditMerkle.rows,
    auditLatestSeq: auditMerkle.latestSeq,
    auditLatestHash: auditMerkle.latestHash,
    configChanges: configHistory.count,
    backupVerified: backup.verified,
    wormStorageUri: worm?.storageUri ?? null,
    retentionUntil: worm?.retentionUntil.toISOString() ?? null,
  };

  // Upsert by bundleDate so a same-day re-run replaces the row instead
  // of failing on the unique constraint.
  await db
    .insert(evidenceBundles)
    .values({
      bundleDate,
      filename,
      sizeBytes: gz.length,
      sha256,
      storageUri: worm?.storageUri ?? null,
      retentionUntil: worm?.retentionUntil ?? null,
      summary,
    })
    .onConflictDoUpdate({
      target: evidenceBundles.bundleDate,
      set: {
        filename,
        sizeBytes: gz.length,
        sha256,
        storageUri: worm?.storageUri ?? null,
        retentionUntil: worm?.retentionUntil ?? null,
        summary,
        generatedAt: new Date(),
      },
    });
  return { bundleDate, filename, filepath, sizeBytes: gz.length, sha256, summary };
}

/**
 * Schedule the evidence cron via `@aivo/scheduling` (Task #62) so a leader
 * crash can't silently skip a day's bundle and the run shows up on the
 * Background Jobs admin page (Tasks #67, #78). Returns the scheduler handle so
 * the internal "Run now" route can call it.
 */
export function startEvidenceCron(db: any, log: { info: Function; error: Function }) {
  const lock = createDrizzleAdvisoryLock(db);
  const ledger = createDrizzleLedger(db);
  return startSafeCron({
    jobName: "admin.soc2-evidence",
    ledger,
    lock,
    log: log as never,
    run: async () => {
      const result = await generateEvidenceBundle(db);
      log.info(
        { bundleDate: result.bundleDate, sha256: result.sha256, sizeBytes: result.sizeBytes },
        "soc2 evidence bundle generated",
      );
      return { status: "ok" };
    },
  });
}
