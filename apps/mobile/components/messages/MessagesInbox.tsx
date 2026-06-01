import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface ThreadListItem {
  id: string;
  subject: string;
  unread: number;
  lastMessage: { body: string } | null;
}

interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

/**
 * Mobile threaded inbox — mirror of web's MessagesInbox. Master/detail in one
 * screen: a thread list, tap to open a thread, reply inline. Calls comms-svc
 * directly via the authenticated apiFetch(API.COMMS, ...).
 */
export function MessagesInbox() {
  const palette = useSensoryPalette();
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState("");
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await apiFetch(API.COMMS, "/api/comms/threads");
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.threads)) setThreads(j.threads as ThreadListItem[]);
    } catch {
      setError("Couldn't load your messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(async (id: string, subject: string) => {
    setActiveId(id);
    setActiveSubject(subject);
    setMessages(null);
    setError(null);
    try {
      const res = await apiFetch(API.COMMS, `/api/comms/threads/${id}/messages`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.messages)) {
        setMessages(j.messages as ThreadMessage[]);
        void apiFetch(API.COMMS, `/api/comms/threads/${id}/read`, { method: "POST" });
        setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
      } else {
        setError("Couldn't open that conversation.");
      }
    } catch {
      setError("Couldn't open that conversation.");
    }
  }, []);

  async function send() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch(API.COMMS, `/api/comms/threads/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Couldn't send your message.");
        return;
      }
      setMessages((prev) => [...(prev ?? []), j.message as ThreadMessage]);
      setDraft("");
      void loadThreads();
    } catch {
      setError("Couldn't send your message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xl }} />;
  }

  // --- detail ---
  if (activeId) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to inbox"
          onPress={() => {
            setActiveId(null);
            setMessages(null);
          }}
          style={styles.backRow}
        >
          <Ionicons name="chevron-back" size={20} color={palette.primary} />
          <Text style={[styles.backText, { color: palette.primary }]}>Inbox</Text>
        </Pressable>
        <Text style={[styles.subject, { color: palette.ink }]}>{activeSubject}</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {messages === null ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            messages.map((m) => (
              <View key={m.id} style={{ alignItems: m.mine ? "flex-end" : "flex-start" }}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: m.mine ? palette.primary : palette.bgRaised,
                    },
                  ]}
                >
                  <Text style={{ color: m.mine ? "#ffffff" : palette.ink, fontSize: 14 }}>
                    {m.body}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View style={[styles.composer, { borderTopColor: palette.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a reply…"
            placeholderTextColor={palette.inkMuted}
            multiline
            style={[styles.input, { borderColor: palette.border, color: palette.ink }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={sending || draft.trim().length === 0}
            onPress={send}
            style={[
              styles.sendBtn,
              { backgroundColor: palette.primary, opacity: sending || !draft.trim() ? 0.5 : 1 },
            ]}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  // --- list ---
  return (
    <View style={{ flex: 1 }}>
      {threads.length === 0 ? (
        <Text style={[styles.empty, { color: palette.inkMuted }]}>
          No conversations yet. When someone on your AIVO team messages you it will appear here.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {threads.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={t.subject}
              onPress={() => void openThread(t.id, t.subject)}
              style={[styles.threadRow, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.threadSubject, { color: palette.ink }]} numberOfLines={1}>
                  {t.subject}
                </Text>
                {t.lastMessage ? (
                  <Text style={[styles.threadPreview, { color: palette.inkMuted }]} numberOfLines={1}>
                    {t.lastMessage.body}
                  </Text>
                ) : null}
              </View>
              {t.unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                  <Text style={styles.badgeText}>{t.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: spacing.xs },
  backText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  subject: { fontSize: 18, fontFamily: fontFamilies.displayBold, marginBottom: spacing.xs },
  bubble: { maxWidth: "82%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  threadSubject: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  threadPreview: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#ffffff", fontSize: 12, fontFamily: fontFamilies.bodyBold },
  empty: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, marginTop: spacing.lg, lineHeight: 21 },
  error: { fontSize: 13, color: "#ef4444", marginTop: spacing.sm },
});
