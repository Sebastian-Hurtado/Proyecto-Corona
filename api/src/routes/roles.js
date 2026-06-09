const express = require("express");
const { getRoles, postRoleAlias } = require("../controllers/rolesController");

const router = express.Router();

router.get("/", getRoles);
router.post("/role-aliases", postRoleAlias);

module.exports = router;
