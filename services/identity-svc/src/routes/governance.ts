import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import {
  users,
  sessions,
  mfaCodes,
  mfaRecoveryCodes,
  webauthnCredentials,
  passwordHistory,
  passwordResetTokens,
  adminSessions,
  consentRecords,
} from "@aivo/db";
import { eq, or } from "drizzle-orm";

export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, {
    service: "identity-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {} };
      const uid = req.subjectId;

      const [sess, mfa, mfaRec, webauthn, pwHistory, pwReset, adminSess, consent, user] =
        await Promise.all([
          db.delete(sessions).where(eq(sessions.userId, uid)).returning({ id: sessions.id }),
          db.delete(mfaCodes).where(eq(mfaCodes.userId, uid)).returning({ id: mfaCodes.id }),
          db
            .delete(mfaRecoveryCodes)
            .where(eq(mfaRecoveryCodes.userId, uid))
            .returning({ id: mfaRecoveryCodes.id }),
          db
            .delete(webauthnCredentials)
            .where(eq(webauthnCredentials.userId, uid))
            .returning({ id: webauthnCredentials.id }),
          db
            .delete(passwordHistory)
            .where(eq(passwordHistory.userId, uid))
            .returning({ id: passwordHistory.id }),
          db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.userId, uid))
            .returning({ id: passwordResetTokens.id }),
          db
            .delete(adminSessions)
            .where(eq(adminSessions.userId, uid))
            .returning({ id: adminSessions.id }),
          db
            .delete(consentRecords)
            .where(or(eq(consentRecords.parentId, uid), eq(consentRecords.childId, uid)))
            .returning({ id: consentRecords.id }),
          db.delete(users).where(eq(users.id, uid)).returning({ id: users.id }),
        ]);

      return {
        counts: {
          sessions: sess.length,
          mfa_codes: mfa.length,
          mfa_recovery_codes: mfaRec.length,
          webauthn_credentials: webauthn.length,
          password_history: pwHistory.length,
          password_reset_tokens: pwReset.length,
          admin_sessions: adminSess.length,
          consent_records: consent.length,
          users: user.length,
        },
      };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (!db) return { counts: {}, bundle: {} };
      const uid = req.subjectId;

      const [user, sess, webauthn, consent] = await Promise.all([
        db.select().from(users).where(eq(users.id, uid)),
        db.select().from(sessions).where(eq(sessions.userId, uid)),
        db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, uid)),
        db
          .select()
          .from(consentRecords)
          .where(or(eq(consentRecords.parentId, uid), eq(consentRecords.childId, uid))),
      ]);

      return {
        counts: {
          users: user.length,
          sessions: sess.length,
          webauthn_credentials: webauthn.length,
          consent_records: consent.length,
        },
        bundle: {
          users: user,
          sessions: sess,
          webauthn_credentials: webauthn,
          consent_records: consent,
        },
      };
    },
  });
}
