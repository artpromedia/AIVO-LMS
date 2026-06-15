/**
 * Best-effort, non-blocking session notice via comms-svc. A booking/reschedule
 * never fails because the parent's confirmation email could not be sent; in dev
 * (comms-svc disabled / no token) this is simply a no-op.
 */
import { getCommsBearer, isCommsSvcEnabled, sendSessionNoticeSvc } from "@/lib/bff/comms-svc";
import { getUserById } from "@/lib/db/repos";

export async function notifySessionUpcoming(input: {
  parentUserId: string;
  learnerName: string;
  providerName: string;
}): Promise<void> {
  try {
    if (!isCommsSvcEnabled()) return;
    const bearer = await getCommsBearer();
    if (!bearer) return;
    const parent = await getUserById(input.parentUserId);
    if (!parent?.email) return;
    await sendSessionNoticeSvc(bearer, parent.email, {
      learnerName: input.learnerName,
      tutorName: input.providerName,
    });
  } catch {
    // best-effort — confirmation email is never load-bearing for a booking.
  }
}
