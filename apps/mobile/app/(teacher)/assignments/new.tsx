import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card, Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useCreateAssignment } from "@/hooks/useTeacher";

/**
 * Teacher create assignment (MOB-TCH-007) — mirror of web's
 * /teacher/assignments/new.
 */
export default function TeacherNewAssignmentScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const create = useCreateAssignment();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");

  const onSubmit = async () => {
    try {
      await create.mutateAsync({
        title: title.trim(),
        subject: subject.trim(),
        dueDate: dueDate.trim() || undefined,
      });
      router.replace("/(teacher)/assignments" as never);
    } catch {
      Alert.alert(
        t("common.error", "Something went wrong"),
        t("teacherAssignments.createFailed", "Couldn't create the assignment."),
      );
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor={palette.inkMuted}
        style={[
          styles.input,
          { borderColor: palette.border, color: palette.ink, backgroundColor: palette.bgRaised },
        ]}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("teacherAssignments.new", "New assignment")} />
      <Card tone="raised" style={{ gap: spacing.md }}>
        {field(
          t("teacherAssignments.titleField", "Title"),
          title,
          setTitle,
          t("teacherAssignments.titlePh", "e.g. Fractions practice"),
        )}
        {field(t("teacherAssignments.subject", "Subject"), subject, setSubject, "Math")}
        {field(
          t("teacherAssignments.dueField", "Due date (optional)"),
          dueDate,
          setDueDate,
          "2026-02-01",
        )}
        <Button
          title={t("teacherAssignments.create", "Create assignment")}
          onPress={onSubmit}
          disabled={!title.trim() || !subject.trim()}
          loading={create.isPending}
          fullWidth
          size="lg"
        />
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: fontFamilies.bodyBold },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fontFamilies.bodyRegular,
  },
});
