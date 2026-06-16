import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

const AGE_BANDS = [
  { value: "3-5", label: "3-5" },
  { value: "6-9", label: "6–9" },
  { value: "10-12", label: "10–12" },
  { value: "13-15", label: "13–15" },
];

/**
 * Parent control to grant / revoke Speech Buddy consent for one learner —
 * mirror of web's SpeechBuddyConsentCard. Talks directly to family-svc
 * (`/api/family/speech-buddy/consent/:learnerId`) via the authenticated
 * apiFetch.
 */
export function SpeechBuddyConsentCard({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const palette = useSensoryPalette();
  const path = `/api/family/speech-buddy/consent/${learnerId}`;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);
  const [grantedBand, setGrantedBand] = useState<string | null>(null);
  const [ageBand, setAgeBand] = useState("6-9");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(API.FAMILY, path);
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) {
          setGranted(Boolean(j.granted));
          if (j.consent?.ageBand) {
            setGrantedBand(j.consent.ageBand);
            setAgeBand(j.consent.ageBand);
          }
        }
      } catch {
        if (alive) setError("Couldn't load consent status.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  async function grant() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch(API.FAMILY, path, {
        method: "POST",
        body: JSON.stringify({ ageBand }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't save consent.");
        return;
      }
      setGranted(true);
      setGrantedBand(ageBand);
    } catch {
      setError("Couldn't save consent.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch(API.FAMILY, `${path}/revoke`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't revoke consent.");
        return;
      }
      setGranted(false);
      setGrantedBand(null);
    } catch {
      setError("Couldn't revoke consent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="raised" style={{ gap: spacing.sm }}>
      <Text style={[styles.title, { color: palette.ink }]}>Speech Buddy</Text>
      <Text style={[styles.body, { color: palette.inkMuted }]}>
        Optional voice companion that helps {learnerName} practise social-emotional skills. Off
        until you turn it on; every session is safety-filtered, and you can withdraw consent any
        time.
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : granted ? (
        <>
          <Text style={[styles.status, { color: palette.ink }]}>
            Enabled{grantedBand ? ` for ${grantedBand}` : ""}.
          </Text>
          <Pressable
            disabled={busy}
            onPress={revoke}
            accessibilityRole="button"
            accessibilityLabel="Withdraw Speech Buddy consent"
            style={[styles.btnOutline, { borderColor: palette.border }]}
          >
            <Text style={[styles.btnOutlineText, { color: palette.ink }]}>
              {busy ? "Working…" : "Withdraw consent"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: palette.ink }]}>Age band</Text>
          <View style={styles.chips}>
            {AGE_BANDS.map((b) => {
              const active = b.value === ageBand;
              return (
                <Pressable
                  key={b.value}
                  onPress={() => setAgeBand(b.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? palette.primary : palette.border,
                      backgroundColor: active ? `${palette.primary}22` : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? palette.primary : palette.inkMuted,
                      fontFamily: fontFamilies.bodyBold,
                    }}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            disabled={busy}
            onPress={grant}
            accessibilityRole="button"
            accessibilityLabel="Enable Speech Buddy"
            style={[styles.btn, { backgroundColor: palette.primary }]}
          >
            <Text style={styles.btnText}>{busy ? "Working…" : "Enable Speech Buddy"}</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, lineHeight: 19 },
  status: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  label: { fontSize: 13, fontFamily: fontFamilies.bodyBold, marginTop: spacing.xs },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: radius.xl,
    marginTop: spacing.xs,
  },
  btnText: { color: colors.white, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  btnOutline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  btnOutlineText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  error: { fontSize: 13, color: colors.error, fontFamily: fontFamilies.bodyRegular },
});
