const LEVEL_VALUES = {
  "MUY BAJO": 1,
  BAJO: 2,
  MEDIO: 3,
  ALTO: 4,
  "MUY ALTO": 5,
};

const VALUE_LABELS = {
  1: "MUY BAJO",
  2: "BAJO",
  3: "MEDIO",
  4: "ALTO",
  5: "MUY ALTO",
};

function cleanLevelText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function levelTextToValue(value) {
  const normalized = cleanLevelText(value);
  return LEVEL_VALUES[normalized] || null;
}

function levelValueToText(value) {
  return VALUE_LABELS[value] || null;
}

function parseRequirementKind(text) {
  const content = String(text || "").toLowerCase();
  if (content.includes("complementaria")) {
    return "complementaria";
  }

  return "maestra";
}

function parseRequirementRange(expectedText, fallbackLabel) {
  const text = String(expectedText || "").toLowerCase();
  const fallback = String(fallbackLabel || "").toLowerCase();
  const content = `${text} ${fallback}`;

  if (content.includes("mayor de 70")) {
    return { minLevel: 4, maxLevel: 5, desiredLabel: "ALTO - MUY ALTO" };
  }

  if (content.includes("entre 51 y 69")) {
    return { minLevel: 3, maxLevel: 4, desiredLabel: "MEDIO - ALTO" };
  }

  if (content.includes("bajo a medio a alto")) {
    return { minLevel: 2, maxLevel: 4, desiredLabel: "BAJO - ALTO" };
  }

  if (content.includes("medio a muy alto")) {
    return { minLevel: 3, maxLevel: 5, desiredLabel: "MEDIO - MUY ALTO" };
  }

  if (content.includes("medio - alto") || content.includes("medio a alto")) {
    return { minLevel: 3, maxLevel: 4, desiredLabel: "MEDIO - ALTO" };
  }

  if (content.includes("bajo/medio") || content.includes("bajo a medio")) {
    return { minLevel: 2, maxLevel: 3, desiredLabel: "BAJO - MEDIO" };
  }

  if (content.includes("muy alto")) {
    return { minLevel: 5, maxLevel: 5, desiredLabel: "MUY ALTO" };
  }

  if (content.includes("alto")) {
    return { minLevel: 4, maxLevel: 4, desiredLabel: "ALTO" };
  }

  if (content.includes("medio")) {
    return { minLevel: 3, maxLevel: 3, desiredLabel: "MEDIO" };
  }

  if (content.includes("bajo")) {
    return { minLevel: 2, maxLevel: 2, desiredLabel: "BAJO" };
  }

  return { minLevel: 3, maxLevel: 4, desiredLabel: "MEDIO - ALTO" };
}

function parseBooleanLike(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return normalized === "SI" || normalized === "SÍ" || normalized === "YES";
}

function excelSerialToISO(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const utc = new Date(Date.UTC(1899, 11, 30) + numeric * 86400000);
  return utc.toISOString().slice(0, 10);
}

module.exports = {
  LEVEL_VALUES,
  VALUE_LABELS,
  cleanLevelText,
  levelTextToValue,
  levelValueToText,
  parseRequirementKind,
  parseRequirementRange,
  parseBooleanLike,
  excelSerialToISO,
};
