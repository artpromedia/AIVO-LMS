export function parseSurfaceCapabilities(source) {
  const capabilities = [];
  const entry =
    /^\s{2}([a-z][a-z0-9_]*):\s*\{[\s\S]*?\bweb:\s*"([^"]+)"[\s\S]*?\bmobile:\s*"([^"]+)"/gm;
  for (const match of source.matchAll(entry)) {
    capabilities.push({ type: match[1], web: match[2], mobile: match[3] });
  }
  return capabilities;
}

export function compareSurfaceCapabilities(capabilities) {
  return capabilities.map((capability) => ({
    ...capability,
    parity: capability.web === capability.mobile,
  }));
}

export function parseSubjectSlugs(source) {
  return [...source.matchAll(/^\s{4}slug:\s*"([^"]+)",/gm)].map((match) => match[1]);
}

export function subjectVisibilityAxis(subjects, clients) {
  return subjects.map((subject) => ({
    subject,
    web: clients.web,
    mobile: clients.mobile,
    parity: clients.web === clients.mobile,
  }));
}

export function sourceMarkerAxis(source, requirements) {
  return requirements.map(({ feature, markers }) => ({
    feature,
    present: markers.every((marker) => source.includes(marker)),
    missing: markers.filter((marker) => !source.includes(marker)),
  }));
}

export function parseTutorTierAssignments(source) {
  const assignments = [];
  const entry = /^\s{2}([a-z][a-z0-9_]*):\s*\{[\s\S]*?\btiers:\s*([A-Z_]+),/gm;
  for (const match of source.matchAll(entry)) {
    assignments.push({ tutor: match[1], tiers: match[2] });
  }
  return assignments;
}
