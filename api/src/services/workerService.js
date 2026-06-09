const { query } = require("../db");

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
        wa.source_role_name,
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

  for (const skill of skillsResult.rows) {
    if (!skillsByAssessment.has(skill.assessment_id)) {
      skillsByAssessment.set(skill.assessment_id, []);
    }

    skillsByAssessment.get(skill.assessment_id).push(skill);
  }

  return {
    ...worker,
    assessments: assessmentsResult.rows.map((assessment) => ({
      ...assessment,
      skills: skillsByAssessment.get(assessment.id) || [],
    })),
  };
}

module.exports = {
  listWorkers,
  getWorkerById,
};
