const fs = require("fs/promises");
const path = require("path");
const { pool } = require("./index");
const { FIXED_ROLES, FIXED_ROLE_ALIASES } = require("./fixedRoles");

async function ensureDatabaseSchema() {
  const schemaPath = path.resolve(__dirname, "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);

  for (const role of FIXED_ROLES) {
    await pool.query(
      `
        INSERT INTO roles (line_name, cargo_name, area_name, role_name, normalized_name)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (normalized_name)
        DO UPDATE SET
          line_name = EXCLUDED.line_name,
          cargo_name = EXCLUDED.cargo_name,
          area_name = EXCLUDED.area_name,
          role_name = EXCLUDED.role_name,
          updated_at = NOW()
      `,
      [
        role.lineName,
        role.cargoName,
        role.areaName,
        role.roleName,
        role.normalizedName,
      ]
    );
  }

  for (const alias of FIXED_ROLE_ALIASES) {
    const roleResult = await pool.query(
      `SELECT id FROM roles WHERE normalized_name = $1 LIMIT 1`,
      [alias.targetNormalizedName]
    );
    const roleId = roleResult.rows[0]?.id;

    if (!roleId) {
      continue;
    }

    await pool.query(
      `
        INSERT INTO role_aliases (source_name, normalized_source_name, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (normalized_source_name)
        DO UPDATE SET role_id = EXCLUDED.role_id
      `,
      [alias.sourceName, alias.normalizedSourceName, roleId]
    );

    await pool.query(
      `
        UPDATE role_requirements
        SET role_id = $2, updated_at = NOW()
        WHERE normalized_source_role_name = $1
      `,
      [alias.normalizedSourceName, roleId]
    );

    await pool.query(
      `
        UPDATE worker_assessments
        SET role_id = $2, updated_at = NOW()
        WHERE normalized_source_role_name = $1
      `,
      [alias.normalizedSourceName, roleId]
    );

    await pool.query(
      `
        UPDATE import_issues
        SET resolved = TRUE
        WHERE normalized_value = $1
      `,
      [alias.normalizedSourceName]
    );
  }

  await pool.query(
    `
      DELETE FROM roles
      WHERE normalized_name <> ALL($1::text[])
    `,
    [FIXED_ROLES.map((role) => role.normalizedName)]
  );
}

if (require.main === module) {
  ensureDatabaseSchema()
    .then(() => {
      console.log("Database schema is ready.");
      return pool.end();
    })
    .catch((error) => {
      console.error("Failed to initialize database schema:", error.message);
      process.exitCode = 1;
      return pool.end();
    });
}

module.exports = { ensureDatabaseSchema };
