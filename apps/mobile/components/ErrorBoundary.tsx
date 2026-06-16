/**
 * Root error boundary (Sprint A2).
 *
 * Before this existed, an unhandled render error crashed the whole app
 * with no recovery UI and no report — the worst possible failure for a
 * child mid-lesson. The boundary reports to Sentry (scrubbed) and renders
 * a calm, reduced-motion-safe recovery screen with "try again" and
 * "go home" actions.
 *
 * A second instance wraps the stage player with `onBeforeRecover` so a
 * crash there queues the learner's session-end payload BEFORE any UI
 * action — progress is never lost to a render error.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Sentry } from "@/lib/sentry";
import i18n from "@/lib/i18n";
import { colors } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface Props {
  children: React.ReactNode;
  /** Identifies which surface crashed in the Sentry event. */
  scope?: string;
  /**
   * Runs once when an error is caught, BEFORE recovery UI interaction —
   * the stage player uses this to flush the session outbox.
   */
  onBeforeRecover?: (error: Error) => void | Promise<void>;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    Sentry.captureException(error, {
      tags: { boundary: this.props.scope ?? "root" },
      extra: { componentStack: info.componentStack ?? "" },
    });
    void this.props.onBeforeRecover?.(error);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private goHome = () => {
    this.setState({ error: null });
    router.replace("/");
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.heading} accessibilityRole="header">
          {i18n.t("errorBoundary.title")}
        </Text>
        <Text style={styles.body}>{i18n.t("errorBoundary.body")}</Text>
        <Pressable
          onPress={this.reset}
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("errorBoundary.tryAgain")}
        >
          <Text style={styles.primaryLabel}>{i18n.t("errorBoundary.tryAgain")}</Text>
        </Pressable>
        <Pressable
          onPress={this.goHome}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("errorBoundary.goHome")}
        >
          <Text style={styles.secondaryLabel}>{i18n.t("errorBoundary.goHome")}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  heading: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 24,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 320,
  },
  primaryButton: {
    marginTop: 24,
    minHeight: 44,
    minWidth: 200,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.white,
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 44,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.primary,
  },
});
