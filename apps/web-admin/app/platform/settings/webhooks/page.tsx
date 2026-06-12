import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { getWebhooks, setWebhookActive } from "@aivo/admin-api/platform-settings";
import { AdminCard, AdminKpiCard, AdminPageFrame , ConfirmDangerDialog, FlashRegion } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";

async function toggleAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!id) redirect("/platform/settings/webhooks?error=Missing%20webhook.");
  try {
    await setWebhookActive(session, id, active);
  } catch (error) {
    redirect(`/platform/settings/webhooks?error=${encodeURIComponent(actionError(error, "Webhook update failed."))}`);
  }
  redirect(
    `/platform/settings/webhooks?notice=${encodeURIComponent(active ? "Webhook enabled." : "Webhook disabled.")}`,
  );
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const { webhooks, deliveries } = await getWebhooks(session);
  const active = webhooks.filter((w) => w.active).length;

  return (
    <AdminPageFrame
      eyebrow="Platform · Settings"
      title="Webhooks"
      description="Registered webhook endpoints and recent delivery attempts, read from the webhooks tables (Postgres). Secrets are never shown."
    >
      <FlashRegion className="mt-8" notice={params.notice} error={params.error} />

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <AdminKpiCard label="Endpoints" value={webhooks.length} />
        <AdminKpiCard label="Active" value={active} />
      </section>

      <h2 className="mt-8 text-xl font-black">Endpoints</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Events</th>
                <th>Active</th>
                <th>Last delivery</th>
                <th>Last status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => (
                <tr key={webhook.id}>
                  <td className="max-w-sm truncate font-mono text-xs">{webhook.url}</td>
                  <td className="text-sm">{webhook.events.join(", ") || "—"}</td>
                  <td>
                    <span className="admin-status">{webhook.active ? "active" : "disabled"}</span>
                  </td>
                  <td className="text-sm">{formatDateTime(webhook.lastDeliveryAt)}</td>
                  <td className="text-sm">{webhook.lastDeliveryStatus ?? "—"}</td>
                  <td>
                    {webhook.active ? (
                      <ConfirmDangerDialog
                        action={toggleAction}
                        hiddenFields={{ id: webhook.id, active: "false" }}
                        trigger="Disable"
                        triggerClassName="admin-action"
                        title="Disable this webhook?"
                        body={`Deliveries to ${webhook.url} stop immediately until it is re-enabled.`}
                        confirmLabel="Disable webhook"
                      />
                    ) : (
                      <form action={toggleAction}>
                        <input name="id" type="hidden" value={webhook.id} />
                        <input name="active" type="hidden" value="true" />
                        <button className="admin-action" type="submit">
                          Enable
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {webhooks.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No webhook endpoints registered.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <h2 className="mt-8 text-xl font-black">Recent deliveries</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Response</th>
                <th>Webhook</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="text-sm">{formatDateTime(delivery.deliveredAt)}</td>
                  <td className="font-bold">{delivery.event}</td>
                  <td
                    className={`text-sm font-bold ${
                      delivery.responseStatus && delivery.responseStatus >= 400
                        ? "text-red-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {delivery.responseStatus ?? "—"}
                  </td>
                  <td className="font-mono text-xs text-slate-500">{delivery.webhookId}</td>
                </tr>
              ))}
              {deliveries.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={4}>
                    No deliveries recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
