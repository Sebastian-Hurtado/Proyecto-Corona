const { getRecommendations } = require("../services/recommendationService");

async function getRoleRecommendations(req, res, next) {
  try {
    const roleId = Number(req.query.roleId);

    if (!roleId) {
      res.status(400).json({ message: "roleId es obligatorio." });
      return;
    }

    const payload = await getRecommendations(roleId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRoleRecommendations,
};
