const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRoleName } = require("../src/utils/normalize");
const { parseRequirementRange } = require("../src/utils/levels");

test("normalizeRoleName removes accents and harmonizes obvious role variants", () => {
  assert.equal(
    normalizeRoleName("OPERADOR COLEJAE MECANIZADO OP"),
    "operador colaje mecanizado one piece"
  );
});

test("parseRequirementRange understands common requirement phrases", () => {
  assert.deepEqual(parseRequirementRange("Nivel medio a muy alto", ""), {
    minLevel: 3,
    maxLevel: 5,
    desiredLabel: "MEDIO - MUY ALTO",
  });
});
