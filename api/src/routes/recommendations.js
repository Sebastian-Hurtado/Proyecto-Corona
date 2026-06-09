const express = require("express");
const {
  getRoleRecommendations,
} = require("../controllers/recommendationsController");

const router = express.Router();

router.get("/", getRoleRecommendations);

module.exports = router;
