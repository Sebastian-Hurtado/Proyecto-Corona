const { query, withTransaction } = require("../db");
const { normalizeRoleName } = require("../utils/normalize");

function nestRequirements(roles, requirements) {
  const byRoleId = new Map();

  for (const requirement of requirements) {
    if (!byRoleId.has(requirement.role_id)) {
      byRoleId.set(requirement.role_id, []);
    }

    byRoleId.get(requirement.role_id).push(requirement);
  }

  return roles.map((role) => ({
    ...role,
    requirements: byRoleId.get(role.id) || [],
  }));
}

async function listRoles() {
  const [rolesResult, requirementsResult, unresolvedResult, aliasesResult] =
    await Promise.all([
      query(
        `
          SELECT
            r.id,
            r.line_name,
            r.cargo_name,
            r.area_name,
            r.role_name,
            COUNT(rr.id) AS requirement_count
          FROM roles r
          LEFT JOIN role_requirements rr ON rr.role_id = r.id
          WHERE r.role_name ~ '[[:alpha:]]'
          GROUP BY r.id
          ORDER BY r.line_name NULLS LAST, r.area_name NULLS LAST, r.role_name
        `
      ),
      query(
        `
          SELECT
            id,
            role_id,
            source_role_name,
            skill_key,
            weight,
            requirement_kind,
            min_level,
            max_level,
            desired_label,
            expected_text
          FROM role_requirements
          WHERE role_id IS NOT NULL
          ORDER BY source_role_name, skill_key
        `
      ),
      query(
        `
          SELECT
            source_role_name,
            normalized_source_role_name,
            origin,
            usage_count
          FROM (
            SELECT
              source_role_name,
              normalized_source_role_name,
              'requirements' AS origin,
              COUNT(*) AS usage_count
            FROM role_requirements
            WHERE role_id IS NULL
              AND normalized_source_role_name <> 'formador'
            GROUP BY source_role_name, normalized_source_role_name
            UNION ALL
            SELECT
              source_role_name,
              normalized_source_role_name,
              'assessments' AS origin,
              COUNT(*) AS usage_count
            FROM worker_assessments
            WHERE role_id IS NULL
              AND normalized_source_role_name <> 'formador'
            GROUP BY source_role_name, normalized_source_role_name
          ) unresolved
          ORDER BY origin, source_role_name
        `
      ),
      query(
        `
          SELECT
            ra.id,
            ra.source_name,
            ra.normalized_source_name,
            r.id AS role_id,
            r.role_name
          FROM role_aliases ra
          JOIN roles r ON r.id = ra.role_id
          ORDER BY ra.source_name
        `
      ),
    ]);

  return {
    roles: nestRequirements(rolesResult.rows, requirementsResult.rows),
    unresolvedSources: unresolvedResult.rows,
    aliases: aliasesResult.rows,
  };
}

async function createRoleAlias(sourceName, roleId) {
  const normalizedSourceName = normalizeRoleName(sourceName);

  if (!normalizedSourceName) {
    throw new Error("El nombre origen de la homologacion es obligatorio.");
  }

  return withTransaction(async (client) => {
    const roleResult = await client.query(
      `SELECT id, role_name FROM roles WHERE id = $1 LIMIT 1`,
      [roleId]
    );
    const role = roleResult.rows[0];

    if (!role) {
      throw new Error("No se encontro el oficio canonico seleccionado.");
    }

    const aliasResult = await client.query(
      `
        INSERT INTO role_aliases (source_name, normalized_source_name, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (normalized_source_name)
        DO UPDATE SET role_id = EXCLUDED.role_id
        RETURNING id, source_name, normalized_source_name, role_id
      `,
      [sourceName, normalizedSourceName, roleId]
    );

    await client.query(
      `
        UPDATE role_requirements
        SET role_id = $2, updated_at = NOW()
        WHERE normalized_source_role_name = $1
      `,
      [normalizedSourceName, roleId]
    );

    await client.query(
      `
        UPDATE worker_assessments
        SET role_id = $2, updated_at = NOW()
        WHERE normalized_source_role_name = $1
      `,
      [normalizedSourceName, roleId]
    );

    await client.query(
      `
        UPDATE import_issues
        SET resolved = TRUE
        WHERE normalized_value = $1
      `,
      [normalizedSourceName]
    );

    return {
      ...aliasResult.rows[0],
      role_name: role.role_name,
    };
  });
}

module.exports = {
  listRoles,
  createRoleAlias,
};
