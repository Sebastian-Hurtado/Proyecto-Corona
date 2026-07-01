const express = require("express");
const {
  getRoles,
  postRoleAlias,
  removeRoleAlias,
} = require("../controllers/rolesController");

const router = express.Router();

router.get("/", getRoles);
router.post("/role-aliases", postRoleAlias);
router.delete("/role-aliases/:id", removeRoleAlias);

module.exports = router;
