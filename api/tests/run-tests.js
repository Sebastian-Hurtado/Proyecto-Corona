const assert = require("node:assert/strict");
const { normalizeRoleName } = require("../src/utils/normalize");
const { parseRequirementRange } = require("../src/utils/levels");
const { scoreWorkerAgainstRole } = require("../src/utils/recommendation");

function run() {
  assert.equal(
    normalizeRoleName("OPERADOR COLEJAE MECANIZADO OP"),
    "operador colaje mecanizado one piece"
  );

  assert.deepEqual(parseRequirementRange("Nivel medio a muy alto", ""), {
    minLevel: 3,
    maxLevel: 5,
    desiredLabel: "MEDIO - MUY ALTO",
  });

  const apto = scoreWorkerAgainstRole(
    [
      {
        skillKey: "minnesota",
        weight: 0.3,
        requirementKind: "maestra",
        minLevel: 3,
        maxLevel: 5,
        desiredLabel: "MEDIO - MUY ALTO",
      },
      {
        skillKey: "batak",
        weight: 0.25,
        requirementKind: "maestra",
        minLevel: 3,
        maxLevel: 4,
        desiredLabel: "MEDIO - ALTO",
      },
    ],
    {
      minnesota: { levelValue: 5, levelText: "MUY ALTO" },
      batak: { levelValue: 4, levelText: "ALTO" },
    },
    true
  );

  assert.equal(apto.status, "apto");
  assert.ok(apto.score >= 75);

  const retraining = scoreWorkerAgainstRole(
    [
      {
        skillKey: "minnesota",
        weight: 0.3,
        requirementKind: "maestra",
        minLevel: 3,
        maxLevel: 5,
        desiredLabel: "MEDIO - MUY ALTO",
      },
    ],
    {
      minnesota: { levelValue: 2, levelText: "BAJO" },
    },
    true
  );

  assert.equal(retraining.status, "requiere reentrenamiento");
  assert.equal(retraining.criticalFailures.length, 1);

  console.log("All tests passed.");
}

run();
