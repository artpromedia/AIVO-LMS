/**
 * S3 object-lock (WORM) implementation of the anchor {@link WormStore}.
 *
 * Writes the daily anchor to a bucket configured with Object Lock in
 * COMPLIANCE mode, so even a root principal cannot overwrite/delete it
 * before the retention period — the external tamper-evidence anchor.
 *
 * The bucket/region come from env (AUDIT_WORM_BUCKET / AWS_REGION). Returns
 * `s3://bucket/key#versionId` as the ref persisted in audit_anchors.worm_ref.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { WormStore } from "./anchor.js";

export class S3WormStore implements WormStore {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    region = process.env.AWS_REGION ?? "us-east-1",
    /** Object Lock retention in days (must not exceed bucket default). */
    private readonly retainDays = 2555,
  ) {
    this.client = new S3Client({ region });
  }

  async put(key: string, body: string): Promise<{ ref: string }> {
    const retainUntil = new Date(Date.now() + this.retainDays * 24 * 60 * 60 * 1000);
    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ObjectLockMode: "COMPLIANCE",
        ObjectLockRetainUntilDate: retainUntil,
      }),
    );
    const version = res.VersionId ? `#${res.VersionId}` : "";
    return { ref: `s3://${this.bucket}/${key}${version}` };
  }
}
