function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRoleName(value) {
  return normalizeText(value)
    .replace(/\bps\b/g, "")
    .replace(/\bop\b/g, "one piece")
    .replace(/\bcolejae\b/g, "colaje")
    .replace(/\bcoleaje\b/g, "colaje")
    .replace(/\bcoleja\b/g, "colaje")
    .replace(/\bcolae?je\b/g, "colaje")
    .replace(/\bone piece one piece\b/g, "one piece")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = {
  normalizeText,
  normalizeRoleName,
  normalizeWhitespace,
  uniqueValues,
};
