const assert = require("node:assert/strict");
const { normalizeRoleName } = require("../src/utils/normalize");
const { parseRequirementRange } = require("../src/utils/levels");
const { calculateManualSkillResult } = require("../src/utils/manualSkillScoring");
const { STATUS_RANK, scoreWorkerAgainstRole } = require("../src/utils/recommendation");

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
  assert.ok(STATUS_RANK["no cumple perfil"] < STATUS_RANK["pendiente homologacion"]);

  assert.equal(
    calculateManualSkillResult("batak", {
      practice: 70,
      round1: 80,
      round2: 85,
    }).levelText,
    "ALTO"
  );
  assert.equal(
    calculateManualSkillResult("dedos_sueltos", {
      goalMet: "SI",
      score: 400,
    }).levelText,
    "MUY ALTO"
  );
  assert.equal(
    calculateManualSkillResult("sonda_espacial", {
      practice: 1000,
      round1: 200,
      round2: 200,
      round3: 1000,
      round4: 1000,
      round5: 2000,
    }).levelText,
    "MEDIO"
  );
  assert.equal(
    calculateManualSkillResult("minnesota", {
      placingDominantRound1: 45,
      placingDominantRound2: 60,
      placingNonDominantRound1: 50,
      placingNonDominantRound2: 50,
      displacingDominantRound1: 35,
      displacingDominantRound2: 47,
      displacingNonDominantRound1: 40,
      displacingNonDominantRound2: 40,
      rotationRound1: 40,
      rotationRound2: 40,
    }).levelText,
    "MUY ALTO"
  );
  assert.equal(
    calculateManualSkillResult("purdue", {
      rightHandRound1: 18,
      rightHandRound2: 20,
      leftHandRound1: 15,
      leftHandRound2: 21,
      bothHandsRound1: 15,
      bothHandsRound2: 16,
      assemblyRound1: 35,
      assemblyRound2: 55,
    }).levelText,
    "MEDIO"
  );

  console.log("All tests passed.");
}

run();
