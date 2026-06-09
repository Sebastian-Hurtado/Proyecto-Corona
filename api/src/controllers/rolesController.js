const { listRoles, createRoleAlias } = require("../services/roleService");

async function getRoles(req, res, next) {
  try {
    const payload = await listRoles();
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function postRoleAlias(req, res, next) {
  try {
    const { sourceName, roleId } = req.body || {};

    if (!sourceName || !roleId) {
      res.status(400).json({
        message: "sourceName y roleId son obligatorios para crear la homologacion.",
      });
      return;
    }

    const alias = await createRoleAlias(sourceName, Number(roleId));
    res.status(201).json(alias);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRoles,
  postRoleAlias,
};
