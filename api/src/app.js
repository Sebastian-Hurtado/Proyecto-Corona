const express = require("express");
const cors = require("cors");
const { env } = require("./config/env");
const {
  postRoleAlias,
  removeRoleAlias,
} = require("./controllers/rolesController");
const importRoutes = require("./routes/imports");
const roleRoutes = require("./routes/roles");
const workerRoutes = require("./routes/workers");
const recommendationRoutes = require("./routes/recommendations");

const app = express();

app.use(
  cors({
    origin: env.webOrigin,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/imports", importRoutes);
app.post("/api/role-aliases", postRoleAlias);
app.delete("/api/role-aliases/:id", removeRoleAlias);
app.use("/api/roles", roleRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/recommendations", recommendationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada." });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    message: error.message || "Ocurrio un error inesperado.",
  });
});

module.exports = { app };
