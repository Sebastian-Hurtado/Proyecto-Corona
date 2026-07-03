const { query } = require("../db");
const {
  SKILL_LABELS,
  STATUS_RANK,
  scoreWorkerAgainstRole,
} = require("../utils/recommendation");

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
        latestAssessment.id,
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

async function getWorkerRoleMatches(assessmentId, skillMap) {
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

      return {
        roleId: role.id,
        assessmentId,
        roleName: role.role_name,
        areaName: role.area_name,
        lineName: role.line_name,
        score: scored.score,
        status: scored.status,
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
  listWorkers,
  getWorkerById,
};
