/**
 * Mobile TTS factory.
 *
 * Mirrors the web-v2 TTS adapter shape:
 *   - getTTSProvider() returns a TTSProvider keyed off EXPO_PUBLIC_TTS_PROVIDER.
 *   - "offline" uses expo-speech (on-device, no network, no premium voices).
 *   - "azure" / "polly" / "elevenlabs" call the cloud REST APIs for premium
 *     voices. In production NODE_ENV the factory hard-fails if the configured
 *     provider isn't reachable (no silent fallback).
 *
 * The cloud providers are intentionally thin wrappers around the same web-v2
 * adapters' wire format so the BFF can stub them identically in tests.
 */
import type { TTSProvider, TTSRequest, TTSResult } from "./provider";
import { OfflineSpeechProvider } from "./providers/offline";
import { CloudTTSProvider } from "./providers/cloud";

export type { TTSProvider, TTSRequest, TTSResult } from "./provider";

export type MobileTTSProviderName = "offline" | "azure" | "polly" | "elevenlabs";

export function getTTSProvider(): TTSProvider {
  const env = (process.env.EXPO_PUBLIC_TTS_PROVIDER ?? "offline").toLowerCase() as
    | MobileTTSProviderName
    | "";
  const isProd = process.env.NODE_ENV === "production";

  switch (env) {
    case "azure":
    case "polly":
    case "elevenlabs": {
      const p = new CloudTTSProvider(env);
      if (!p.available()) {
        if (isProd) {
          throw new Error(`Mobile TTS provider "${env}" not configured.`);
        }
        return new OfflineSpeechProvider();
      }
      return p;
    }
    case "offline":
    case "":
    default:
      return new OfflineSpeechProvider();
  }
}
