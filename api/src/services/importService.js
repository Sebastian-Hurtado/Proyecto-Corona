const XLSX = require("xlsx");
const { withTransaction, query } = require("../db");
const { normalizeRoleName, normalizeWhitespace } = require("../utils/normalize");
const {
  levelTextToValue,
  parseRequirementKind,
  parseRequirementRange,
  parseBooleanLike,
  excelSerialToISO,
} = require("../utils/levels");

const REQUIREMENT_SKILL_MAP = {
  "TEST DE PURDUE": "purdue",
  "TEST DE MINNESOTA": "minnesota",
  "TEST DE REACCION (BATAK)": "batak",
  "TEST SONDA ESPACIAL": "sonda_espacial",
  "TEST DE DEDOS SUELTOS": "dedos_sueltos",
};

const DIAGNOSTIC_SKILLS = [
  { key: "minnesota", sourceLabel: "Minnesota", column: "AM" },
  { key: "purdue", sourceLabel: "Purdue / Lumosity - Trenes", column: "BI" },
  { key: "sonda_espacial", sourceLabel: "Sonda Espacial", column: "BQ" },
  { key: "dedos_sueltos", sourceLabel: "Dedos Sueltos", column: "BU" },
  { key: "batak", sourceLabel: "Batak", column: "CA" },
];

const IGNORED_REQUIREMENT_SOURCE_ROLES = new Set(["formador"]);

function columnIndex(columnName) {
  let index = 0;

  for (const char of columnName.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return index - 1;
}

function cleanCell(value) {
  return normalizeWhitespace(value);
}

function normalizeRequirementTestName(value) {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function shouldIgnoreRequirementSourceRole(sourceRoleName) {
  return IGNORED_REQUIREMENT_SOURCE_ROLES.has(normalizeRoleName(sourceRoleName));
}

function detectImportType(fileName, workbook) {
  const normalizedFileName = String(fileName || "").toLowerCase();
  const sheetNames = workbook.SheetNames.join(" ").toLowerCase();

  if (
    normalizedFileName.includes("diagnost") ||
    sheetNames.includes("base de datos")
  ) {
    return "diagnostics";
  }

  if (
    normalizedFileName.includes("pruebas de sele") ||
    sheetNames.includes("resumen pruebas vs oficios")
  ) {
    return "requirements";
  }

  if (
    normalizedFileName.includes("oficios de planta") ||
    sheetNames.includes("cargos - oficios")
  ) {
    return "role_catalog";
  }

  if (
    normalizedFileName.includes("antropometric") ||
    normalizedFileName.includes("perfil antropometrico") ||
    sheetNames.includes("perfil biof")
  ) {
    return "anthropometric";
  }

  return "unknown";
}

async function runExecutorQuery(executor, text, params) {
  if (typeof executor === "function") {
    return executor(text, params);
  }

  return executor.query(text, params);
}

async function insertImportBatch(executor, fileName, importType) {
  const result = await runExecutorQuery(
    executor,
    `
      INSERT INTO import_batches (file_name, import_type, status)
      VALUES ($1, $2, 'processing')
      RETURNING id
    `,
    [fileName, importType]
  );

  return result.rows[0].id;
}

async function updateImportBatch(executor, batchId, status, summary) {
  await runExecutorQuery(
    executor,
    `
      UPDATE import_batches
      SET status = $2,
          summary_json = $3::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `,
    [batchId, status, JSON.stringify(summary)]
  );
}

async function logImportIssue(client, payload) {
  await client.query(
    `
      INSERT INTO import_issues (
        batch_id,
        issue_type,
        sheet_name,
        row_number,
        source_value,
        normalized_value,
        message,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      payload.batchId,
      payload.issueType,
      payload.sheetName || null,
      payload.rowNumber || null,
      payload.sourceValue || null,
      payload.normalizedValue || null,
      payload.message,
      JSON.stringify(payload.metadata || {}),
    ]
  );
}

async function resolveRoleId(client, sourceRoleName) {
  const normalized = normalizeRoleName(sourceRoleName);

  if (!normalized) {
    return null;
  }

  const exactMatch = await client.query(
    `SELECT id FROM roles WHERE normalized_name = $1 LIMIT 1`,
    [normalized]
  );

  if (exactMatch.rows[0]) {
    return exactMatch.rows[0].id;
  }

  const aliasMatch = await client.query(
    `SELECT role_id FROM role_aliases WHERE normalized_source_name = $1 LIMIT 1`,
    [normalized]
  );

  return aliasMatch.rows[0]?.role_id || null;
}

async function importRoleRequirements(client, workbook, batchId) {
  const sheet =
    workbook.Sheets["Resumen Pruebas Vs Oficios"] ||
    workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const roleHeaderRow = rows[3] || [];
  const unresolvedSources = new Set();
  let importedRequirements = 0;

  for (let index = 4; index < rows.length; index += 1) {
    const row = rows[index];
    const testName = normalizeRequirementTestName(row[0]);
    const skillKey = REQUIREMENT_SKILL_MAP[testName];

    if (!skillKey) {
      continue;
    }

    const weight = Number.parseFloat(String(row[7]).replace(",", ".")) || 0;
    const fallbackLabel = cleanCell(row[8]);

    for (let column = 3; column <= 6; column += 1) {
      const sourceRoleName = cleanCell(roleHeaderRow[column]);
      const expectedText = cleanCell(row[column]);

      if (
        !sourceRoleName ||
        !expectedText ||
        shouldIgnoreRequirementSourceRole(sourceRoleName)
      ) {
        continue;
      }

      const normalizedSourceRoleName = normalizeRoleName(sourceRoleName);
      const roleId = await resolveRoleId(client, sourceRoleName);
      const requirementKind = parseRequirementKind(expectedText);
      const range = parseRequirementRange(expectedText, fallbackLabel);

      await client.query(
        `
          INSERT INTO role_requirements (
            role_id,
            source_role_name,
            normalized_source_role_name,
            skill_key,
            weight,
            requirement_kind,
            min_level,
            max_level,
            desired_label,
            expected_text
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (normalized_source_role_name, skill_key)
          DO UPDATE SET
            role_id = EXCLUDED.role_id,
            weight = EXCLUDED.weight,
            requirement_kind = EXCLUDED.requirement_kind,
            min_level = EXCLUDED.min_level,
            max_level = EXCLUDED.max_level,
            desired_label = EXCLUDED.desired_label,
            expected_text = EXCLUDED.expected_text,
            updated_at = NOW()
        `,
        [
          roleId,
          sourceRoleName,
          normalizedSourceRoleName,
          skillKey,
          weight,
          requirementKind,
          range.minLevel,
          range.maxLevel,
          range.desiredLabel,
          expectedText,
        ]
      );

      if (!roleId && !unresolvedSources.has(normalizedSourceRoleName)) {
        unresolvedSources.add(normalizedSourceRoleName);
        await logImportIssue(client, {
          batchId,
          issueType: "unmatched_requirement_role",
          sheetName: "Resumen Pruebas Vs Oficios",
          rowNumber: index + 1,
          sourceValue: sourceRoleName,
          normalizedValue: normalizedSourceRoleName,
          message: `No se encontro un oficio canonico para "${sourceRoleName}".`,
          metadata: { sourceRoleName },
        });
      }

      importedRequirements += 1;
    }
  }

  return {
    importedRequirements,
    unresolvedRoles: unresolvedSources.size,
  };
}

async function upsertWorker(client, worker) {
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
      worker.firstName,
      worker.lastName,
      worker.fullName,
      worker.gender,
      worker.dominantHand,
      worker.candidateType,
    ]
  );

  return result.rows[0].id;
}

async function upsertWorkerAssessment(client, assessment) {
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
      ON CONFLICT (worker_id, source_record_number)
      DO UPDATE SET
        role_id = EXCLUDED.role_id,
        source_role_name = EXCLUDED.source_role_name,
        normalized_source_role_name = EXCLUDED.normalized_source_role_name,
        line_name = EXCLUDED.line_name,
        assessment_date = EXCLUDED.assessment_date,
        raw_assessment_date = EXCLUDED.raw_assessment_date,
        overall_level_text = EXCLUDED.overall_level_text,
        overall_level_value = EXCLUDED.overall_level_value,
        final_score = EXCLUDED.final_score,
        complies = EXCLUDED.complies,
        updated_at = NOW()
      RETURNING id
    `,
    [
      assessment.workerId,
      assessment.roleId,
      assessment.sourceRoleName,
      assessment.normalizedSourceRoleName,
      assessment.lineName,
      assessment.sourceRecordNumber,
      assessment.assessmentDate,
      assessment.rawAssessmentDate,
      assessment.overallLevelText,
      assessment.overallLevelValue,
      assessment.finalScore,
      assessment.complies,
    ]
  );

  return result.rows[0].id;
}

async function upsertSkillResult(client, skillResult) {
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
      ON CONFLICT (assessment_id, skill_key)
      DO UPDATE SET
        source_label = EXCLUDED.source_label,
        level_text = EXCLUDED.level_text,
        level_value = EXCLUDED.level_value,
        raw_score = EXCLUDED.raw_score
    `,
    [
      skillResult.assessmentId,
      skillResult.skillKey,
      skillResult.sourceLabel,
      skillResult.levelText,
      skillResult.levelValue,
      skillResult.rawScore,
    ]
  );
}

async function importDiagnostics(client, workbook, batchId) {
  const sheet =
    workbook.Sheets.Plantilla || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const unresolvedSources = new Set();
  let importedWorkers = 0;
  let importedAssessments = 0;
  let importedSkills = 0;

  for (let index = 5; index < rows.length; index += 1) {
    const row = rows[index];
    const sourceRecordNumber = cleanCell(row[columnIndex("A")]);
    const sourceRoleName = cleanCell(row[columnIndex("D")]);
    const documentNumber = cleanCell(row[columnIndex("F")]);
    const firstName = cleanCell(row[columnIndex("G")]);
    const lastName = cleanCell(row[columnIndex("H")]);

    if (!sourceRecordNumber || !documentNumber || !firstName) {
      continue;
    }

    const normalizedSourceRoleName = normalizeRoleName(sourceRoleName);
    const workerId = await upsertWorker(client, {
      documentNumber,
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
      gender: cleanCell(row[columnIndex("J")]),
      dominantHand: cleanCell(row[columnIndex("K")]),
      candidateType: cleanCell(row[columnIndex("L")]),
    });
    const roleId = await resolveRoleId(client, sourceRoleName);
    const overallLevelText = cleanCell(row[columnIndex("CD")]);
    const assessmentId = await upsertWorkerAssessment(client, {
      workerId,
      roleId,
      sourceRoleName,
      normalizedSourceRoleName,
      lineName: cleanCell(row[columnIndex("E")]),
      sourceRecordNumber,
      assessmentDate: excelSerialToISO(row[columnIndex("C")]),
      rawAssessmentDate: cleanCell(row[columnIndex("C")]),
      overallLevelText,
      overallLevelValue: levelTextToValue(overallLevelText),
      finalScore: Number.parseFloat(cleanCell(row[columnIndex("CC")])) || null,
      complies: parseBooleanLike(row[columnIndex("CE")]),
    });

    for (const skill of DIAGNOSTIC_SKILLS) {
      const levelText = cleanCell(row[columnIndex(skill.column)]);

      await upsertSkillResult(client, {
        assessmentId,
        skillKey: skill.key,
        sourceLabel: skill.sourceLabel,
        levelText,
        levelValue: levelTextToValue(levelText),
        rawScore: levelText,
      });

      importedSkills += 1;
    }

    if (!roleId && !unresolvedSources.has(normalizedSourceRoleName)) {
      unresolvedSources.add(normalizedSourceRoleName);
      await logImportIssue(client, {
        batchId,
        issueType: "unmatched_assessment_role",
        sheetName: "Plantilla",
        rowNumber: index + 1,
        sourceValue: sourceRoleName,
        normalizedValue: normalizedSourceRoleName,
        message: `No se encontro un oficio canonico para el cargo evaluado "${sourceRoleName}".`,
        metadata: { sourceRoleName, documentNumber },
      });
    }

    importedWorkers += 1;
    importedAssessments += 1;
  }

  return {
    importedWorkers,
    importedAssessments,
    importedSkills,
    unresolvedRoles: unresolvedSources.size,
  };
}

async function importAnthropometricProfiles(client, workbook) {
  const sheet = workbook.Sheets.OP || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const lineName = cleanCell(rows[1]?.[5]) || "Linea OP";
  let importedProfiles = 0;

  for (let index = 4; index < rows.length; index += 1) {
    const row = rows[index];
    const leftLabel = cleanCell(row[0]);
    const detailLabel = cleanCell(row[3]);
    const idealRange = cleanCell(row[4]);
    const exclusion = cleanCell(row[7]);
    const variableName = leftLabel || detailLabel;
    const idealProfile = [detailLabel !== variableName ? detailLabel : "", idealRange]
      .filter(Boolean)
      .join(" | ");

    if (!variableName || (!idealProfile && !exclusion)) {
      continue;
    }

    await client.query(
      `
        INSERT INTO anthropometric_profiles (
          line_name,
          variable_name,
          ideal_profile,
          exclusion_criteria
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (line_name, variable_name)
        DO UPDATE SET
          ideal_profile = EXCLUDED.ideal_profile,
          exclusion_criteria = EXCLUDED.exclusion_criteria
      `,
      [lineName, variableName, idealProfile || null, exclusion || null]
    );

    importedProfiles += 1;
  }

  return { importedProfiles };
}

async function importWorkbook(buffer, fileName) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const importType = detectImportType(fileName, workbook);

  if (importType === "unknown") {
    throw new Error(
      "No se pudo identificar el tipo de archivo. Verifica que sea uno de los Excel del piloto."
    );
  }

  const batchId = await insertImportBatch(query, fileName, importType);

  try {
    const summary = await withTransaction(async (client) => {
      if (importType === "role_catalog") {
        return {
          skipped: true,
          message:
            "Los puestos de trabajo son fijos en el sistema. Este Excel ya no se usa para cargar oficios.",
        };
      }

      if (importType === "requirements") {
        return importRoleRequirements(client, workbook, batchId);
      }

      if (importType === "diagnostics") {
        return importDiagnostics(client, workbook, batchId);
      }

      return importAnthropometricProfiles(client, workbook);
    });

    await updateImportBatch(query, batchId, "completed", summary);

    return {
      batchId,
      importType,
      status: "completed",
      summary,
    };
  } catch (error) {
    await updateImportBatch(query, batchId, "failed", {
      error: error.message,
    });
    throw error;
  }
}

async function getImportIssues(batchId) {
  const result = await query(
    `
      SELECT
        id,
        issue_type,
        sheet_name,
        row_number,
        source_value,
        normalized_value,
        message,
        metadata_json,
        resolved,
        created_at
      FROM import_issues
      WHERE batch_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [batchId]
  );

  return result.rows;
}

module.exports = {
  importWorkbook,
  getImportIssues,
};
