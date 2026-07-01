const {
  listRoles,
  createRoleAlias,
  deleteRoleAlias,
} = require("../services/roleService");

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

async function removeRoleAlias(req, res, next) {
  try {
    const aliasId = Number(req.params.id);

    if (!aliasId) {
      res.status(400).json({
        message: "El id de la homologacion es obligatorio.",
      });
      return;
    }

    const alias = await deleteRoleAlias(aliasId);
    res.json(alias);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRoles,
  postRoleAlias,
  removeRoleAlias,
};
