import { STEADY_SIGNAL_DATA } from "./generated/steady-signal.js";

export type SteadySignalAppearance = keyof typeof STEADY_SIGNAL_DATA.modes.appearance;
export type SteadySignalSensory = keyof typeof STEADY_SIGNAL_DATA.modes.sensory;
export type SteadySignalAge = keyof typeof STEADY_SIGNAL_DATA.modes.age;
export type SteadySignalCommunication = keyof typeof STEADY_SIGNAL_DATA.modes.communication;
export type SteadySignalRole = keyof typeof STEADY_SIGNAL_DATA.modes.role;

export interface SteadySignalSelection {
  appearance?: SteadySignalAppearance;
  sensory?: SteadySignalSensory;
  age?: SteadySignalAge;
  communication?: SteadySignalCommunication;
  role?: SteadySignalRole;
}

const defaults = {
  appearance: "light",
  sensory: "standard",
  age: "middle",
  communication: "supported-text",
  role: "learner",
} as const satisfies Required<SteadySignalSelection>;

export function resolveSteadySignal(selection: SteadySignalSelection = {}) {
  const resolved = { ...defaults, ...selection };
  return {
    selection: resolved,
    foundation: STEADY_SIGNAL_DATA.foundation,
    colors: {
      ...STEADY_SIGNAL_DATA.foundation.color,
      ...STEADY_SIGNAL_DATA.modes.appearance[resolved.appearance],
      ...STEADY_SIGNAL_DATA.modes.role[resolved.role],
    },
    sensory: STEADY_SIGNAL_DATA.modes.sensory[resolved.sensory],
    age: STEADY_SIGNAL_DATA.modes.age[resolved.age],
    communication: STEADY_SIGNAL_DATA.modes.communication[resolved.communication],
    role: STEADY_SIGNAL_DATA.modes.role[resolved.role],
  };
}

export function getSteadySignalDataset(selection: SteadySignalSelection = {}) {
  const resolved = { ...defaults, ...selection };
  return {
    "data-design-system": "steady-signal",
    "data-ss-appearance": resolved.appearance,
    "data-ss-sensory": resolved.sensory,
    "data-ss-age": resolved.age,
    "data-ss-communication": resolved.communication,
    "data-ss-role": resolved.role,
  } as const;
}

export const STEADY_SIGNAL = {
  brandKey: "steady-signal",
  data: STEADY_SIGNAL_DATA,
  defaults,
  resolve: resolveSteadySignal,
  getDataset: getSteadySignalDataset,
} as const;

export const STEADY_SIGNAL_DEFAULT = resolveSteadySignal();
