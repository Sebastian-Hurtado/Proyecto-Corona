const { query, withTransaction } = require("../db");
const { levelValueToText } = require("../utils/levels");
const { calculateManualSkillResult } = require("../utils/manualSkillScoring");
const { normalizeRoleName, normalizeWhitespace } = require("../utils/normalize");
const {
  SKILL_LABELS,
  STATUS_RANK,
  scoreWorkerAgainstRole,
} = require("../utils/recommendation");

const MANUAL_SKILLS = [
  { key: "batak", sourceLabel: "Batak" },
  { key: "dedos_sueltos", sourceLabel: "Dedos Sueltos" },
  { key: "minnesota", sourceLabel: "Minnesota" },
  { key: "purdue", sourceLabel: "Purdue / Lumosity - Trenes" },
  { key: "sonda_espacial", sourceLabel: "Sonda Espacial" },
];

async function listWorkers() {
  const result = await query(
    `
      SELECT
        w.id,
        w.document_number,
        w.full_name,
        w.gender,
        w.candidate_type,
        assessment.id AS latest_assessment_id,
        assessment.source_role_name,
        assessment.line_name,
        assessment.overall_level_text,
        assessment.complies,
        r.role_name AS matched_role_name,
        r.area_name AS matched_area_name
      FROM workers w
      LEFT JOIN LATERAL (
        SELECT *
        FROM worker_assessments wa
        WHERE wa.worker_id = w.id
        ORDER BY wa.assessment_date DESC NULLS LAST, wa.created_at DESC
        LIMIT 1
      ) assessment ON TRUE
      LEFT JOIN roles r ON r.id = assessment.role_id
      ORDER BY w.full_name
    `
  );

  return result.rows;
}

async function createManualWorker(payload) {
  const manualWorker = normalizeManualWorkerPayload(payload);

  const workerId = await withTransaction(async (client) => {
    const role = await getRoleForManualWorker(client, manualWorker.roleId);
    const savedWorkerId = await upsertManualWorker(client, manualWorker);
    const assessmentId = await insertManualAssessment(client, {
      workerId: savedWorkerId,
      role,
      assessmentDate: manualWorker.assessmentDate,
      sourceRecordNumber: `MANUAL-${manualWorker.documentNumber}-${Date.now()}`,
      overallLevelText: manualWorker.overallLevelText,
      overallLevelValue: manualWorker.overallLevelValue,
      complies: manualWorker.complies,
    });

    for (const skill of manualWorker.skills) {
      await insertManualSkillResult(client, assessmentId, skill);
    }

    return savedWorkerId;
  });

  return getWorkerById(workerId);
}

function normalizeManualWorkerPayload(payload = {}) {
  const documentNumber = normalizeWhitespace(payload.documentNumber);
  const fullName = normalizeWhitespace(payload.fullName);
  const gender = normalizeWhitespace(payload.gender);
  const dominantHand = normalizeWhitespace(payload.dominantHand);
  const candidateType = normalizeWhitespace(payload.candidateType);
  const roleId = Number(payload.roleId);

  if (!documentNumber) {
    throwValidationError("La cedula es obligatoria.");
  }

  if (!fullName) {
    throwValidationError("El nombre es obligatorio.");
  }

  if (!gender) {
    throwValidationError("Selecciona el genero.");
  }

  if (!dominantHand) {
    throwValidationError("Selecciona la mano dominante.");
  }

  if (!candidateType) {
    throwValidationError("El tipo de candidato es obligatorio.");
  }

  if (!Number.isInteger(roleId) || roleId <= 0) {
    throwValidationError("Selecciona un oficio.");
  }

  const skills = MANUAL_SKILLS.map((skill) => {
    const result = getManualSkillResult(payload, skill.key);

    return {
      skillKey: skill.key,
      sourceLabel: skill.sourceLabel,
      levelValue: result.levelValue,
      levelText: result.levelText,
      rawScore: result.rawScore,
    };
  });

  const overallLevelValue = getManualOverallLevel(payload, skills);
  const complies = parseManualComplies(payload.complies ?? payload.profileComplies);

  return {
    documentNumber,
    fullName,
    gender,
    dominantHand,
    candidateType,
    roleId,
    assessmentDate: normalizeAssessmentDate(payload.assessmentDate),
    complies: complies ?? true,
    overallLevelValue,
    overallLevelText: levelValueToText(overallLevelValue),
    skills,
  };
}

function parseManualComplies(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  const normalized = normalizeWhitespace(value).toUpperCase();

  if (normalized === "SI" || normalized === "SÍ" || normalized === "TRUE" || normalized === "CUMPLE") {
    return true;
  }

  if (normalized === "NO" || normalized === "FALSE" || normalized === "NO CUMPLE") {
    return false;
  }

  return null;
}

function getManualSkillResult(payload, skillKey) {
  const legacyLevelValue = getManualSkillLevel(payload, skillKey);

  if (legacyLevelValue) {
    return {
      levelValue: legacyLevelValue,
      levelText: levelValueToText(legacyLevelValue),
      rawScore: levelValueToText(legacyLevelValue),
    };
  }

  try {
    return calculateManualSkillResult(skillKey, payload.skillInputs?.[skillKey]);
  } catch (error) {
    throwValidationError("Completa los resultados numericos de las pruebas.");
  }
}

function getManualSkillLevel(payload, skillKey) {
  const fromObject = payload.skills?.[skillKey];
  const fromList = Array.isArray(payload.skillResults)
    ? payload.skillResults.find((item) => item.skillKey === skillKey)?.levelValue
    : null;

  return parseLevelValue(fromObject ?? fromList);
}

function getManualOverallLevel(payload, skills) {
  const providedLevel = parseLevelValue(payload.overallLevel ?? payload.overallLevelValue);

  if (providedLevel) {
    return providedLevel;
  }

  const total = skills.reduce((sum, skill) => sum + skill.levelValue, 0);
  return Math.round(total / skills.length);
}

function parseLevelValue(value) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 5) {
    return null;
  }

  return numericValue;
}

function normalizeAssessmentDate(value) {
  const dateText = normalizeWhitespace(value);

  if (!dateText) {
    throwValidationError("La fecha de evaluacion es obligatoria.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throwValidationError("La fecha de evaluacion no es valida.");
  }

  return dateText;
}

async function getRoleForManualWorker(client, roleId) {
  const result = await client.query(
    `
      SELECT id, role_name, normalized_name, line_name
      FROM roles
      WHERE id = $1
    `,
    [roleId]
  );

  const role = result.rows[0];

  if (!role) {
    throwValidationError("Selecciona un oficio.");
  }

  return role;
}

async function upsertManualWorker(client, worker) {
  const result = await client.query(
    `
      INSERT INTO workers (
        document_number,
        first_name,
        last_name,
        full_name,
        gender,
        dominant_hand,
        candidate_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (document_number)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        gender = EXCLUDED.gender,
        dominant_hand = EXCLUDED.dominant_hand,
        candidate_type = EXCLUDED.candidate_type,
        updated_at = NOW()
      RETURNING id
    `,
    [
      worker.documentNumber,
      worker.fullName,
      null,
      worker.fullName,
      worker.gender,
      worker.dominantHand,
      worker.candidateType,
    ]
  );

  return result.rows[0].id;
}

async function insertManualAssessment(client, assessment) {
  const normalizedRoleName =
    assessment.role.normalized_name || normalizeRoleName(assessment.role.role_name);

  const result = await client.query(
    `
      INSERT INTO worker_assessments (
        worker_id,
        role_id,
        source_role_name,
        normalized_source_role_name,
        line_name,
        source_record_number,
        assessment_date,
        raw_assessment_date,
        overall_level_text,
        overall_level_value,
        final_score,
        complies
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      assessment.workerId,
      assessment.role.id,
      assessment.role.role_name,
      normalizedRoleName,
      assessment.role.line_name,
      assessment.sourceRecordNumber,
      assessment.assessmentDate,
      assessment.assessmentDate,
      assessment.overallLevelText,
      assessment.overallLevelValue,
      null,
      assessment.complies,
    ]
  );

  return result.rows[0].id;
}

async function insertManualSkillResult(client, assessmentId, skill) {
  await client.query(
    `
      INSERT INTO skill_results (
        assessment_id,
        skill_key,
        source_label,
        level_text,
        level_value,
        raw_score
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      assessmentId,
      skill.skillKey,
      skill.sourceLabel,
      skill.levelText,
      skill.levelValue,
      skill.rawScore || skill.levelText,
    ]
  );
}

function throwValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

async function getWorkerById(workerId) {
  const workerResult = await query(
    `
      SELECT
        id,
        document_number,
        first_name,
        last_name,
        full_name,
        gender,
        dominant_hand,
        candidate_type
      FROM workers
      WHERE id = $1
    `,
    [workerId]
  );

  const worker = workerResult.rows[0];

  if (!worker) {
    return null;
  }

  const assessmentsResult = await query(
    `
      SELECT
        wa.id,
        wa.role_id,
        wa.source_role_name,
        wa.normalized_source_role_name,
        wa.line_name,
        wa.assessment_date,
        wa.overall_level_text,
        wa.final_score,
        wa.complies,
        r.role_name AS matched_role_name,
        r.area_name AS matched_area_name
      FROM worker_assessments wa
      LEFT JOIN roles r ON r.id = wa.role_id
      WHERE wa.worker_id = $1
      ORDER BY wa.assessment_date DESC NULLS LAST, wa.created_at DESC
    `,
    [workerId]
  );

  const assessmentIds = assessmentsResult.rows.map((assessment) => assessment.id);
  const skillsResult = assessmentIds.length
    ? await query(
        `
          SELECT
            assessment_id,
            skill_key,
            source_label,
            level_text,
            level_value
          FROM skill_results
          WHERE assessment_id = ANY($1::int[])
          ORDER BY assessment_id, skill_key
        `,
        [assessmentIds]
      )
    : { rows: [] };

  const skillsByAssessment = new Map();
  const skillMapsByAssessment = new Map();

  for (const skill of skillsResult.rows) {
    if (!skillsByAssessment.has(skill.assessment_id)) {
      skillsByAssessment.set(skill.assessment_id, []);
    }

    skillsByAssessment.get(skill.assessment_id).push(skill);

    if (!skillMapsByAssessment.has(skill.assessment_id)) {
      skillMapsByAssessment.set(skill.assessment_id, {});
    }

    skillMapsByAssessment.get(skill.assessment_id)[skill.skill_key] = {
      levelText: skill.level_text,
      levelValue: skill.level_value,
    };
  }

  const latestAssessment = assessmentsResult.rows[0];
  const roleMatches = latestAssessment
    ? await getWorkerRoleMatches(
        latestAssessment,
        skillMapsByAssessment.get(latestAssessment.id) || {}
      )
    : [];
  const assessmentComparisons = await getAssessmentRoleComparisons(
    assessmentsResult.rows,
    skillMapsByAssessment
  );

  return {
    ...worker,
    assessments: assessmentsResult.rows.map((assessment) => ({
      ...assessment,
      skills: skillsByAssessment.get(assessment.id) || [],
      skillComparisons: assessmentComparisons.get(assessment.id) || [],
    })),
    roleMatches,
  };
}

async function getAssessmentRoleComparisons(assessments, skillMapsByAssessment) {
  const roleIds = [
    ...new Set(assessments.map((assessment) => assessment.role_id).filter(Boolean)),
  ];
  const normalizedSourceNames = [
    ...new Set(
      assessments
        .map((assessment) => assessment.normalized_source_role_name)
        .filter(Boolean)
    ),
  ];

  if (!roleIds.length && !normalizedSourceNames.length) {
    return new Map();
  }

  const requirementsResult = await query(
    `
      SELECT
        role_id AS "roleId",
        skill_key AS "skillKey",
        weight,
        requirement_kind AS "requirementKind",
        min_level AS "minLevel",
        max_level AS "maxLevel",
        desired_label AS "desiredLabel",
        expected_text AS "expectedText",
        normalized_source_role_name AS "normalizedSourceRoleName"
      FROM role_requirements
      WHERE role_id = ANY($1::int[])
        OR normalized_source_role_name = ANY($2::text[])
      ORDER BY role_id, skill_key
    `,
    [roleIds, normalizedSourceNames]
  );

  const requirementsByRole = new Map();
  const requirementsBySource = new Map();

  for (const requirement of requirementsResult.rows) {
    if (requirement.roleId && !requirementsByRole.has(requirement.roleId)) {
      requirementsByRole.set(requirement.roleId, []);
    }

    if (requirement.roleId) {
      requirementsByRole.get(requirement.roleId).push(requirement);
    }

    if (requirement.normalizedSourceRoleName) {
      if (!requirementsBySource.has(requirement.normalizedSourceRoleName)) {
        requirementsBySource.set(requirement.normalizedSourceRoleName, []);
      }

      requirementsBySource.get(requirement.normalizedSourceRoleName).push(requirement);
    }
  }

  const comparisonsByAssessment = new Map();

  for (const assessment of assessments) {
    const requirements =
      requirementsByRole.get(assessment.role_id) ||
      requirementsBySource.get(assessment.normalized_source_role_name) ||
      [];

    if (!requirements.length) {
      continue;
    }

    const scored = scoreWorkerAgainstRole(
      requirements,
      skillMapsByAssessment.get(assessment.id) || {},
      true
    );

    comparisonsByAssessment.set(
      assessment.id,
      scored.skillComparisons.map((item) => ({
        skillKey: item.skillKey,
        label: SKILL_LABELS[item.skillKey] || item.label,
        currentLevel: item.currentLevel,
        currentLevelText: item.currentLevelText,
        expectedLevel: item.expectedLevel,
        expectedLabel: item.expectedLabel,
        minLevel: item.minLevel,
        maxLevel: item.maxLevel,
        weight: item.weight,
        requirementKind: item.requirementKind,
      }))
    );
  }

  return comparisonsByAssessment;
}

async function getWorkerRoleMatches(assessment, skillMap) {
  const rolesResult = await query(
    `
      SELECT
        r.id,
        r.line_name,
        r.area_name,
        r.role_name
      FROM roles r
      WHERE r.role_name ~ '[[:alpha:]]'
      ORDER BY r.line_name NULLS LAST, r.area_name NULLS LAST, r.role_name
    `
  );

  const roleIds = rolesResult.rows.map((role) => role.id);
  const requirementsResult = roleIds.length
    ? await query(
        `
          SELECT
            role_id AS "roleId",
            skill_key AS "skillKey",
            weight,
            requirement_kind AS "requirementKind",
            min_level AS "minLevel",
            max_level AS "maxLevel",
            desired_label AS "desiredLabel",
            expected_text AS "expectedText"
          FROM role_requirements
          WHERE role_id = ANY($1::int[])
          ORDER BY role_id, skill_key
        `,
        [roleIds]
      )
    : { rows: [] };

  const requirementsByRole = new Map();

  for (const requirement of requirementsResult.rows) {
    if (!requirementsByRole.has(requirement.roleId)) {
      requirementsByRole.set(requirement.roleId, []);
    }

    requirementsByRole.get(requirement.roleId).push(requirement);
  }

  return rolesResult.rows
    .map((role) => {
      const requirements = requirementsByRole.get(role.id) || [];
      const scored = scoreWorkerAgainstRole(requirements, skillMap, requirements.length > 0);
      const status =
        assessment.complies === false ? "no cumple perfil" : scored.status;

      return {
        roleId: role.id,
        assessmentId: assessment.id,
        roleName: role.role_name,
        areaName: role.area_name,
        lineName: role.line_name,
        profileComplies: assessment.complies,
        score: scored.score,
        status,
        requirementCount: requirements.length,
        strengths: scored.strengths.map((item) => ({
          label: SKILL_LABELS[item.skillKey] || item.label,
          currentLevelText: item.currentLevelText,
          expectedLabel: item.expectedLabel,
        })),
        gaps: scored.gaps.map((item) => ({
          label: SKILL_LABELS[item.skillKey] || item.label,
          currentLevelText: item.currentLevelText,
          expectedLabel: item.expectedLabel,
        })),
        skillComparisons: scored.skillComparisons.map((item) => ({
          skillKey: item.skillKey,
          label: SKILL_LABELS[item.skillKey] || item.label,
          currentLevel: item.currentLevel,
          currentLevelText: item.currentLevelText,
          expectedLevel: item.expectedLevel,
          expectedLabel: item.expectedLabel,
          minLevel: item.minLevel,
          maxLevel: item.maxLevel,
          weight: item.weight,
          requirementKind: item.requirementKind,
        })),
      };
    })
    .filter((match) => match.requirementCount > 0)
    .sort((left, right) => {
      const statusDiff = STATUS_RANK[right.status] - STATUS_RANK[left.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return right.score - left.score;
    });
}

module.exports = {
  createManualWorker,
  listWorkers,
  getWorkerById,
};
