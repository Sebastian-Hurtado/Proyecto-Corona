const SKILL_LABELS = {
  minnesota: "Minnesota",
  purdue: "Purdue",
  batak: "Batak",
  sonda_espacial: "Sonda Espacial",
  dedos_sueltos: "Dedos Sueltos",
};

const STATUS_RANK = {
  apto: 4,
  "requiere reentrenamiento": 3,
  "no recomendado": 2,
  "pendiente homologacion": 1,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreSkill(levelValue, requirement) {
  if (!levelValue) {
    return 0;
  }

  if (levelValue >= requirement.minLevel && levelValue <= requirement.maxLevel) {
    return 1;
  }

  const distance =
    levelValue < requirement.minLevel
      ? requirement.minLevel - levelValue
      : levelValue - requirement.maxLevel;

  return clamp(1 - distance / 4, 0, 1);
}

function scoreWorkerAgainstRole(requirements, skillMap, roleResolved = true) {
  if (!roleResolved || !requirements.length) {
    return {
      score: 0,
      status: "pendiente homologacion",
      strengths: [],
      gaps: [],
      criticalFailures: [],
      skillComparisons: [],
    };
  }

  let weightedScore = 0;
  let totalWeight = 0;
  const strengths = [];
  const gaps = [];
  const criticalFailures = [];
  const skillComparisons = [];

  for (const requirement of requirements) {
    const workerSkill = skillMap[requirement.skillKey] || {};
    const workerLevel = workerSkill.levelValue || 0;
    const contribution = scoreSkill(workerLevel, requirement);
    const weight = Number(requirement.weight || 0);
    totalWeight += weight;
    weightedScore += contribution * weight;

    const label = SKILL_LABELS[requirement.skillKey] || requirement.skillKey;
    const detail = {
      skillKey: requirement.skillKey,
      label,
      currentLevel: workerLevel,
      currentLevelText: workerSkill.levelText || "SIN DATO",
      expectedLabel: requirement.desiredLabel,
      weight,
    };

    skillComparisons.push({
      ...detail,
      expectedLevel: requirement.minLevel,
      minLevel: requirement.minLevel,
      maxLevel: requirement.maxLevel,
      requirementKind: requirement.requirementKind,
    });

    if (workerLevel < requirement.minLevel) {
      gaps.push({
        ...detail,
        gapSize: requirement.minLevel - workerLevel,
      });

      if (requirement.requirementKind === "maestra") {
        criticalFailures.push(detail);
      }
    } else {
      strengths.push({
        ...detail,
        fitScore: contribution,
      });
    }
  }

  const score = totalWeight ? Math.round((weightedScore / totalWeight) * 100) : 0;
  let status = "no recomendado";

  if (criticalFailures.length > 0) {
    status = "requiere reentrenamiento";
  } else if (score >= 75) {
    status = "apto";
  } else if (score >= 45) {
    status = "requiere reentrenamiento";
  }

  strengths.sort((left, right) => right.fitScore - left.fitScore);
  gaps.sort((left, right) => right.gapSize - left.gapSize);

  return {
    score,
    status,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    criticalFailures,
    skillComparisons,
  };
}

module.exports = {
  SKILL_LABELS,
  STATUS_RANK,
  scoreWorkerAgainstRole,
};
