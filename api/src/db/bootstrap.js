const fs = require("fs/promises");
const path = require("path");
const { pool } = require("./index");
const { FIXED_ROLES } = require("./fixedRoles");

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
