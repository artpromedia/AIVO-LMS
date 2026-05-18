interface ParentSignals {
  communicationMode: string;
  deviceInteraction: string;
  responseMethod: string;
  attentionSpan?: string;
}

interface LevelResult {
  level: "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";
  confidence: number;
  assessmentMode: string;
  reasoning: string;
}

export function determineFunctioningLevel(signals: ParentSignals): LevelResult {
  const { communicationMode, deviceInteraction, responseMethod } = signals;

  if (communicationMode === "pre_symbolic" || deviceInteraction === "partner_assisted") {
    return {
      level: "PRE_SYMBOLIC",
      confidence: 85,
      assessmentMode: "OBSERVATIONAL",
      reasoning:
        "Pre-symbolic communication or partner-assisted interaction indicates pre-symbolic functioning level",
    };
  }

  if (communicationMode === "non_verbal" || deviceInteraction === "eye_gaze") {
    return {
      level: "NON_VERBAL",
      confidence: 80,
      assessmentMode: "SWITCH_SCAN",
      reasoning:
        "Non-verbal communication or eye-gaze interaction indicates non-verbal functioning level",
    };
  }

  if (
    communicationMode === "limited_verbal" ||
    deviceInteraction === "switch_access" ||
    responseMethod === "switch_scan"
  ) {
    return {
      level: "LOW_VERBAL",
      confidence: 75,
      assessmentMode: "PICTURE_BASED",
      reasoning: "Limited verbal or switch access indicates low verbal functioning level",
    };
  }

  if (
    communicationMode === "aac_device" ||
    communicationMode === "sign_language" ||
    deviceInteraction === "guided"
  ) {
    return {
      level: "SUPPORTED",
      confidence: 70,
      assessmentMode: "MODIFIED",
      reasoning:
        "AAC device, sign language, or guided interaction indicates supported functioning level",
    };
  }

  return {
    level: "STANDARD",
    confidence: 90,
    assessmentMode: "STANDARD",
    reasoning:
      "Verbal communication with independent device interaction indicates standard functioning level",
  };
}
