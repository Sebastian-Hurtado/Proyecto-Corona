const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreWorkerAgainstRole } = require("../src/utils/recommendation");

test("scoreWorkerAgainstRole returns apto when all master skills meet target", () => {
  const requirements = [
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
  ];
  const skillMap = {
    minnesota: { levelValue: 5, levelText: "MUY ALTO" },
    batak: { levelValue: 4, levelText: "ALTO" },
  };

  const result = scoreWorkerAgainstRole(requirements, skillMap, true);

  assert.equal(result.status, "apto");
  assert.ok(result.score >= 75);
});

test("scoreWorkerAgainstRole flags retraining when a master skill is below target", () => {
  const requirements = [
    {
      skillKey: "minnesota",
      weight: 0.3,
      requirementKind: "maestra",
      minLevel: 3,
      maxLevel: 5,
      desiredLabel: "MEDIO - MUY ALTO",
    },
  ];
  const skillMap = {
    minnesota: { levelValue: 2, levelText: "BAJO" },
  };

  const result = scoreWorkerAgainstRole(requirements, skillMap, true);

  assert.equal(result.status, "requiere reentrenamiento");
  assert.equal(result.criticalFailures.length, 1);
});

test("scoreWorkerAgainstRole returns all skill comparisons for charting", () => {
  const requirements = [
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
      minLevel: 4,
      maxLevel: 5,
      desiredLabel: "ALTO - MUY ALTO",
    },
    {
      skillKey: "dedos_sueltos",
      weight: 0.15,
      requirementKind: "complementaria",
      minLevel: 2,
      maxLevel: 3,
      desiredLabel: "BAJO - MEDIO",
    },
  ];
  const skillMap = {
    minnesota: { levelValue: 5, levelText: "MUY ALTO" },
    batak: { levelValue: 3, levelText: "MEDIO" },
  };

  const result = scoreWorkerAgainstRole(requirements, skillMap, true);

  assert.equal(result.skillComparisons.length, requirements.length);
  assert.deepEqual(result.skillComparisons.map((item) => item.skillKey), [
    "minnesota",
    "batak",
    "dedos_sueltos",
  ]);
  assert.equal(result.skillComparisons[0].expectedLevel, 3);
  assert.equal(result.skillComparisons[1].currentLevel, 3);
  assert.equal(result.skillComparisons[2].currentLevel, 0);
  assert.equal(result.skillComparisons[2].currentLevelText, "SIN DATO");
});
