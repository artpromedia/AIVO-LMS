import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAddLearner } from "@/hooks/useLearners";
import { validateBirthDate } from "@/lib/birth-date";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent add-learner (MOB-PAR-002) — mirror of web's
 * `/parent/learners/new`. Captures the basics to create a learner via
 * identity-svc, then routes into the new learner's hub.
 */
export default function ParentLearnerNewScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const addLearner = useAddLearner();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [language, setLanguage] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pin, setPin] = useState("");

  // COPPA age gate (Sprint A6): the birth date is REQUIRED — it is what
  // determines whether this learner is under 13 and therefore which
  // consent regime applies. Format pinned to YYYY-MM-DD; future dates and
  // ages > 21 are rejected as input errors.
  const birthDateError = validateBirthDate(birthDate);
  const valid = firstName.trim().length > 0 && pin.trim().length >= 4 && birthDateError === null;

  const onSubmit = async () => {
    try {
      const created: any = await addLearner.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gradeLevel: gradeLevel.trim(),
        pin: pin.trim(),
        dateOfBirth: birthDate.trim(),
        preferredLanguage: language.trim(),
      });
      const id = created?.id;
      if (id) router.replace(`/(parent)/learners/${id}` as never);
      else router.back();
    } catch {
      Alert.alert(
        t("common.error", "Something went wrong"),
        t("parentLearnerNew.failed", "Couldn't add the learner. Please try again."),
      );
    }
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { keyboard?: "default" | "number-pad"; secure?: boolean } = {},
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        keyboardType={opts.keyboard ?? "default"}
        secureTextEntry={opts.secure}
        style={[
          styles.input,
          { borderColor: palette.border, color: palette.ink, backgroundColor: palette.bgRaised },
        ]}
        placeholderTextColor={palette.inkMuted}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentLearnerNew.title", "Add a learner")} />
      <Card tone="raised" style={{ gap: spacing.md }}>
        {field(t("parentLearnerNew.firstName", "First name"), firstName, setFirstName)}
        {field(t("parentLearnerNew.lastName", "Last name"), lastName, setLastName)}
        {field(t("parentLearnerNew.grade", "Grade level"), gradeLevel, setGradeLevel)}
        {field(
          t("parentLearnerNew.language", "Preferred language (optional)"),
          language,
          setLanguage,
        )}
        {field(
          t("parentLearnerNew.birthDate", "Birth date (YYYY-MM-DD)"),
          birthDate,
          setBirthDate,
          { keyboard: "number-pad" },
        )}
        {birthDate.length > 0 && birthDateError ? (
          <Text
            style={[styles.label, { color: colors.error }]}
            accessibilityLiveRegion="polite"
          >
            {t(`parentLearnerNew.birthDateError.${birthDateError}`)}
          </Text>
        ) : null}
        {field(t("parentLearnerNew.pin", "Learner PIN (4+ digits)"), pin, setPin, {
          keyboard: "number-pad",
          secure: true,
        })}
        <Button
          title={t("parentLearnerNew.create", "Add learner")}
          onPress={onSubmit}
          disabled={!valid}
          loading={addLearner.isPending}
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

