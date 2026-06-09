const { app } = require("./app");
const { env } = require("./config/env");
const { ensureDatabaseSchema } = require("./db/bootstrap");

async function start() {
  await ensureDatabaseSchema();

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API:", error.message);
  process.exit(1);
});
