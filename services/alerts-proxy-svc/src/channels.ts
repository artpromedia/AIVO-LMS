export type ChannelId = "slack" | "pagerduty" | "opsgenie";

export interface ChannelConfig {
  id: ChannelId;
  configured: boolean;
  /** Source of the configured value, for ops debugging — never the secret itself. */
  via: string | null;
  /** Resolved secret/credential. Never logged or returned over /api/alerts/health. */
  secret: string | null;
}

interface RawEnv {
  [k: string]: string | undefined;
}

const SLACK_KEYS = ["OPS_ALERTS_SLACK_WEBHOOK_URL", "ALERTS_SLACK_WEBHOOK_URL"];
const PD_KEYS = ["OPS_ALERTS_PAGERDUTY_ROUTING_KEY", "ALERTS_PAGERDUTY_ROUTING_KEY"];
const OPSGENIE_KEYS = ["OPS_ALERTS_OPSGENIE_API_KEY", "ALERTS_OPSGENIE_API_KEY"];

function pick(env: RawEnv, keys: string[]): { via: string | null; secret: string | null } {
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "string" && v.length > 0) return { via: k, secret: v };
  }
  return { via: null, secret: null };
}

export function loadChannels(env: RawEnv = process.env): ChannelConfig[] {
  const slack = pick(env, SLACK_KEYS);
  const pd = pick(env, PD_KEYS);
  const og = pick(env, OPSGENIE_KEYS);
  return [
    { id: "slack", configured: slack.via !== null, via: slack.via, secret: slack.secret },
    { id: "pagerduty", configured: pd.via !== null, via: pd.via, secret: pd.secret },
    { id: "opsgenie", configured: og.via !== null, via: og.via, secret: og.secret },
  ];
}

/** Strip secrets before returning channel state on a public endpoint. */
export function publicView(channels: ChannelConfig[]): Array<Omit<ChannelConfig, "secret">> {
  return channels.map(({ secret: _secret, ...rest }) => rest);
}

export const REQUIRED_CHANNELS_IN_PROD: ChannelId[] = ["slack", "pagerduty", "opsgenie"];
