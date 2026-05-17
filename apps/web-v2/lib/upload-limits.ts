/**
 * Sprint 23: canonical upload limit constants. The IEP-specific values live
 * in `lib/validators/iep.ts` because the Zod schema there is what actually
 * gates the upload route. We re-export them here so docs and any future
 * upload routes have a single import path and cannot drift out of sync.
 */
export {
  IEP_MAX_BYTES as MAX_IEP_UPLOAD_BYTES,
  IEP_ALLOWED_MIME_TYPES as ALLOWED_IEP_MIME_TYPES,
} from "@/lib/validators/iep";
