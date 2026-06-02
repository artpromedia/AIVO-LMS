import React from "react";
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type ViewProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";

export function MobilePlayfulButton({
  children,
  style,
  ...props
}: PressableProps & { children: React.ReactNode }) {
  const base: ViewStyle = {
    minHeight: 56,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 20,
  };
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        base,
        typeof style === "function" ? style(state) : (style as StyleProp<ViewStyle>),
      ]}
      {...props}
    >
      <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{children}</Text>
    </Pressable>
  );
}

export function MobilePlayfulCard({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          borderRadius: 24,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#E5E7EB",
          padding: 16,
        },
        style,
      ]}
    />
  );
}
