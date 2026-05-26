/**
 * Sprint 16 — envelope-encryption wrapper for caregiver / IEP
 * attachment payloads in family-svc.
 *
 * The IEP upload entry-point lives in services/assessment-svc/src/routes/iep.ts
 * (`POST /api/iep/upload`); the caregiver attachment surface is still
 * in design as of Sprint 16, but when it lands, every blob ingested
 * by either route MUST flow through `sealAttachment` before it hits
 * object storage. The companion `openAttachment` is used by the
 * download path.
 *
 * The actual crypto lives in packages/security/src/envelope.ts.
 * KEK lookup is keyed by tenantId and rotated per
 * docs/security/key-rotation.md.
 */
import {
  encryptForLearnerWithTenant,
  decryptForLearnerWithTenant,
  type SealedPayload,
} from "@aivo/security";

export interface AttachmentSealInput {
  /** Raw bytes of the uploaded file. */
  bytes: Buffer;
  /** Owning learner — bound into the AAD. */
  learnerId: string;
  /** Owning tenant — selects the KEK. */
  tenantId: string;
}

/**
 * Encrypt-and-package: returns a JSON-serialisable sealed payload
 * suitable for storing alongside the attachment's metadata row.
 * Object-storage callers should write the ciphertext (`sealed.c`) to
 * blob storage and persist the wrapped DEK + IV + tag in the DB.
 */
export async function sealAttachment(
  input: AttachmentSealInput,
): Promise<SealedPayload> {
  return encryptForLearnerWithTenant(input.bytes, input.learnerId, input.tenantId);
}

/**
 * Reverse: returns plaintext bytes given the previously-stored sealed
 * payload + the same (learnerId, tenantId) tuple. AAD enforcement in
 * the underlying envelope helper means a ciphertext for learner-A
 * cannot be decrypted by passing learner-B.
 */
export async function openAttachment(
  sealed: SealedPayload,
  learnerId: string,
  tenantId: string,
): Promise<Buffer> {
  return decryptForLearnerWithTenant(sealed, learnerId, tenantId);
}
