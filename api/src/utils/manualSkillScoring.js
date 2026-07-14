const { levelTextToValue, levelValueToText } = require("./levels");

const RANGE_SETS = {
  minnesotaPlacing: [
    { min: 100, max: 107, label: "MUY ALTO" },
    { min: 108, max: 117, label: "ALTO" },
    { min: 118, max: 128, label: "MEDIO" },
    { min: 129, max: 136, label: "BAJO" },
  ],
  minnesotaDisplacing: [
    { min: 40, max: 84, label: "MUY ALTO" },
    { min: 85, max: 90, label: "ALTO" },
    { min: 91, max: 98, label: "MEDIO" },
    { min: 99, max: 103, label: "BAJO" },
  ],
  purdueRightHand: [
    { min: 21, max: 23, label: "MUY ALTO" },
    { min: 20, max: 20, label: "ALTO" },
    { min: 19, max: 19, label: "MEDIO" },
    { min: 17, max: 18, label: "BAJO" },
  ],
  purdueLeftHand: [
    { min: 20, max: 21, label: "MUY ALTO" },
    { min: 19, max: 19, label: "ALTO" },
    { min: 17, max: 18, label: "MEDIO" },
    { min: 15, max: 16, label: "BAJO" },
  ],
  purdueBothHands: [
    { min: 19, max: 25, label: "MUY ALTO" },
    { min: 17, max: 18, label: "ALTO" },
    { min: 15, max: 16, label: "MEDIO" },
    { min: 14, max: 14, label: "BAJO" },
  ],
  purdueAssembly: [
    { min: 52, max: 54, label: "MUY ALTO" },
    { min: 47, max: 51, label: "ALTO" },
    { min: 43, max: 46, label: "MEDIO" },
    { min: 37, max: 42, label: "BAJO" },
  ],
  batak: [
    { min: 70, max: 140, label: "ALTO" },
    { min: 51, max: 69, label: "MEDIO" },
  ],
  dedosSueltos: [
    { min: 400, max: 400, label: "MUY ALTO" },
    { min: 300, max: 350, label: "ALTO" },
    { min: 200, max: 250, label: "MEDIO" },
  ],
  sondaEspacial: [
    { min: 5000, max: 5000, label: "MUY ALTO" },
    { min: 2000, max: 2000, label: "ALTO" },
    { min: 500, max: 1000, label: "MEDIO" },
  ],
};

function calculateManualSkillResult(skillKey, inputs) {
  if (skillKey === "minnesota") {
    return calculateMinnesota(inputs);
  }

  if (skillKey === "purdue") {
    return calculatePurdue(inputs);
  }

  if (skillKey === "batak") {
    return calculateSingleScore(inputs, RANGE_SETS.batak, "BAJO", "Batak");
  }

  if (skillKey === "dedos_sueltos") {
    return calculateSingleScore(
      inputs,
      RANGE_SETS.dedosSueltos,
      "BAJO",
      "Dedos Sueltos"
    );
  }

  if (skillKey === "sonda_espacial") {
    return calculateSingleScore(
      inputs,
      RANGE_SETS.sondaEspacial,
      "BAJO",
      "Sonda Espacial"
    );
  }

  throw new Error("Prueba manual no soportada.");
}

function calculateMinnesota(inputs) {
  const values = {
    placingDominant: calculateTotal(inputs, "placingDominant"),
    placingNonDominant: calculateTotal(inputs, "placingNonDominant"),
    displacingDominant: calculateTotal(inputs, "displacingDominant"),
    displacingNonDominant: calculateTotal(inputs, "displacingNonDominant"),
    rotation: calculateTotal(inputs, "rotation"),
  };

  const valuation = Math.floor(
    average([
      labelToValue(
        findRangeLabel(values.placingDominant, RANGE_SETS.minnesotaPlacing, "MUY BAJO")
      ),
      labelToValue(
        findRangeLabel(
          values.placingNonDominant,
          RANGE_SETS.minnesotaPlacing,
          "MUY BAJO"
        )
      ),
      labelToValue(
        findRangeLabel(
          values.displacingDominant,
          RANGE_SETS.minnesotaDisplacing,
          "MUY BAJO"
        )
      ),
      labelToValue(
        findRangeLabel(
          values.displacingNonDominant,
          RANGE_SETS.minnesotaDisplacing,
          "MUY BAJO"
        )
      ),
    ])
  );

  return buildResult(valuation, [
    buildRoundRaw("Colocacion mano dominante", inputs, "placingDominant", values.placingDominant),
    buildRoundRaw(
      "Colocacion mano no dominante",
      inputs,
      "placingNonDominant",
      values.placingNonDominant
    ),
    buildRoundRaw(
      "Desplazamiento mano dominante",
      inputs,
      "displacingDominant",
      values.displacingDominant
    ),
    buildRoundRaw(
      "Desplazamiento mano no dominante",
      inputs,
      "displacingNonDominant",
      values.displacingNonDominant
    ),
    buildRoundRaw("Rotacion", inputs, "rotation", values.rotation),
  ]);
}

function calculatePurdue(inputs) {
  const values = {
    rightHand: calculateAverage(inputs, "rightHand"),
    leftHand: calculateAverage(inputs, "leftHand"),
    bothHands: calculateAverage(inputs, "bothHands"),
    assembly: calculateAverage(inputs, "assembly"),
  };

  const valuation = Math.round(
    average([
      labelToValue(findRangeLabel(values.rightHand, RANGE_SETS.purdueRightHand, "MUY BAJO")),
      labelToValue(findRangeLabel(values.leftHand, RANGE_SETS.purdueLeftHand, "MUY BAJO")),
      labelToValue(findRangeLabel(values.bothHands, RANGE_SETS.purdueBothHands, "MUY BAJO")),
      labelToValue(findRangeLabel(values.assembly, RANGE_SETS.purdueAssembly, "MUY BAJO")),
    ])
  );

  return buildResult(valuation, [
    buildAverageRaw("Mano derecha", inputs, "rightHand", values.rightHand),
    buildAverageRaw("Mano izquierda", inputs, "leftHand", values.leftHand),
    buildAverageRaw("Ambas manos", inputs, "bothHands", values.bothHands),
    buildAverageRaw("Ensamble", inputs, "assembly", values.assembly),
  ]);
}

function calculateSingleScore(inputs, ranges, fallbackLabel, rawLabel) {
  const explicitScore =
    inputs && typeof inputs === "object"
      ? parseOptionalManualNumber(inputs.score)
      : parseOptionalManualNumber(inputs);
  const score = explicitScore ?? calculateDerivedSingleScore(inputs, rawLabel);
  const levelText = findRangeLabel(score, ranges, fallbackLabel);

  return {
    levelText,
    levelValue: labelToValue(levelText),
    rawScore: buildSingleRaw(rawLabel, inputs, score),
  };
}

function calculateTotal(inputs, prefix) {
  const explicitTotal = parseOptionalManualNumber(inputs?.[`${prefix}Total`]);

  if (explicitTotal !== null) {
    return explicitTotal;
  }

  return (
    parseManualNumber(inputs?.[`${prefix}Round1`]) +
    parseManualNumber(inputs?.[`${prefix}Round2`])
  );
}

function calculateAverage(inputs, prefix) {
  const explicitAverage = parseOptionalManualNumber(inputs?.[`${prefix}Average`]);

  if (explicitAverage !== null) {
    return explicitAverage;
  }

  return Math.floor(
    average([
      parseManualNumber(inputs?.[`${prefix}Round1`]),
      parseManualNumber(inputs?.[`${prefix}Round2`]),
    ])
  );
}

function calculateDerivedSingleScore(inputs, rawLabel) {
  if (rawLabel === "Batak") {
    return Math.max(
      parseManualNumber(inputs?.practice),
      parseManualNumber(inputs?.round1),
      parseManualNumber(inputs?.round2)
    );
  }

  if (rawLabel === "Sonda Espacial") {
    return mode([
      parseManualNumber(inputs?.practice),
      parseManualNumber(inputs?.round1),
      parseManualNumber(inputs?.round2),
      parseManualNumber(inputs?.round3),
      parseManualNumber(inputs?.round4),
      parseManualNumber(inputs?.round5),
    ]);
  }

  throw new Error("Resultado numerico no valido.");
}

function findRangeLabel(value, ranges, fallbackLabel) {
  const range = ranges.find((item) => value >= item.min && value <= item.max);
  return range?.label || fallbackLabel;
}

function buildResult(valuation, rawParts) {
  const levelText = levelValueToText(valuation);

  if (!levelText) {
    throw new Error("No se pudo calcular el nivel de la prueba.");
  }

  return {
    levelText,
    levelValue: valuation,
    rawScore: rawParts.filter(Boolean).join("; "),
  };
}

function buildRoundRaw(label, inputs, prefix, total) {
  return `${label}: R1 ${inputs?.[`${prefix}Round1`]}, R2 ${
    inputs?.[`${prefix}Round2`]
  }, total ${total}`;
}

function buildAverageRaw(label, inputs, prefix, averageValue) {
  return `${label}: R1 ${inputs?.[`${prefix}Round1`]}, R2 ${
    inputs?.[`${prefix}Round2`]
  }, promedio ${averageValue}`;
}

function buildSingleRaw(rawLabel, inputs, score) {
  if (rawLabel === "Batak") {
    return `Practica: ${inputs?.practice}; Ronda 1: ${inputs?.round1}; Ronda 2: ${inputs?.round2}; Puntuacion: ${score}`;
  }

  if (rawLabel === "Sonda Espacial") {
    return `Practica: ${inputs?.practice}; Ronda 1: ${inputs?.round1}; Ronda 2: ${inputs?.round2}; Ronda 3: ${inputs?.round3}; Ronda 4: ${inputs?.round4}; Ronda 5: ${inputs?.round5}; Puntuacion: ${score}`;
  }

  return `Logra la meta: ${inputs?.goalMet || "N/A"}; Puntuacion: ${score}`;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mode(values) {
  const counts = new Map();
  let bestValue = values[0];
  let bestCount = 0;

  for (const value of values) {
    const count = (counts.get(value) || 0) + 1;
    counts.set(value, count);

    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  }

  if (bestCount < 2) {
    throw new Error("No se pudo calcular la moda.");
  }

  return bestValue;
}

function labelToValue(label) {
  const value = levelTextToValue(label);

  if (!value) {
    throw new Error("Nivel de prueba no valido.");
  }

  return value;
}

function parseManualNumber(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    throw new Error("Resultado numerico no valido.");
  }

  const numericValue = Number(rawValue.replace(",", "."));

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("Resultado numerico no valido.");
  }

  return numericValue;
}

function parseOptionalManualNumber(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return null;
  }

  return parseManualNumber(rawValue);
}

module.exports = {
  calculateManualSkillResult,
};
