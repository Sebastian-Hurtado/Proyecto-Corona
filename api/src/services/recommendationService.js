const { query } = require("../db");
const {
  SKILL_LABELS,
  STATUS_RANK,
  scoreWorkerAgainstRole,
} = require("../utils/recommendation");

async function getRecommendations(roleId) {
  const roleResult = await query(
    `
      SELECT id, line_name, cargo_name, area_name, role_name
      FROM roles
      WHERE id = $1
      LIMIT 1
    `,
    [roleId]
  );

  const role = roleResult.rows[0];

  if (!role) {
    throw new Error("No se encontro el oficio solicitado.");
  }

  const requirementsResult = await query(
    `
      SELECT
        skill_key AS "skillKey",
        weight,
        requirement_kind AS "requirementKind",
        min_level AS "minLevel",
        max_level AS "maxLevel",
        desired_label AS "desiredLabel",
        expected_text AS "expectedText"
      FROM role_requirements
      WHERE role_id = $1
      ORDER BY skill_key
    `,
    [roleId]
  );

  const assessmentsResult = await query(
    `
      SELECT DISTINCT ON (wa.worker_id)
        wa.id AS assessment_id,
        wa.worker_id,
        wa.source_role_name,
        wa.line_name,
        wa.overall_level_text,
        wa.complies,
        w.full_name,
        w.document_number,
        w.gender,
        w.candidate_type
      FROM worker_assessments wa
      JOIN workers w ON w.id = wa.worker_id
      ORDER BY wa.worker_id, wa.assessment_date DESC NULLS LAST, wa.created_at DESC
    `
  );

  const assessmentIds = assessmentsResult.rows.map((assessment) => assessment.assessment_id);
  const skillsResult = assessmentIds.length
    ? await query(
        `
          SELECT
            assessment_id,
            skill_key,
            level_text,
            level_value
          FROM skill_results
          WHERE assessment_id = ANY($1::int[])
        `,
        [assessmentIds]
      )
    : { rows: [] };

  const skillsByAssessment = new Map();

  for (const skill of skillsResult.rows) {
    if (!skillsByAssessment.has(skill.assessment_id)) {
      skillsByAssessment.set(skill.assessment_id, {});
    }

    skillsByAssessment.get(skill.assessment_id)[skill.skill_key] = {
      levelText: skill.level_text,
      levelValue: skill.level_value,
    };
  }

  const roleResolved = requirementsResult.rows.length > 0;
  const ranking = assessmentsResult.rows
    .map((assessment) => {
      const skillMap = skillsByAssessment.get(assessment.assessment_id) || {};
      const scored = scoreWorkerAgainstRole(
        requirementsResult.rows,
        skillMap,
        roleResolved
      );

      return {
        workerId: assessment.worker_id,
        assessmentId: assessment.assessment_id,
        fullName: assessment.full_name,
        documentNumber: assessment.document_number,
        gender: assessment.gender,
        candidateType: assessment.candidate_type,
        sourceRoleName: assessment.source_role_name,
        score: scored.score,
        status: scored.status,
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
        criticalFailures: scored.criticalFailures.map((item) => ({
          label: SKILL_LABELS[item.skillKey] || item.label,
          currentLevelText: item.currentLevelText,
          expectedLabel: item.expectedLabel,
        })),
      };
    })
    .sort((left, right) => {
      const statusDiff = STATUS_RANK[right.status] - STATUS_RANK[left.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return right.score - left.score;
    });

  return {
    role,
    requirements: requirementsResult.rows,
    roleResolved,
    ranking,
  };
}

module.exports = {
  getRecommendations,
};
