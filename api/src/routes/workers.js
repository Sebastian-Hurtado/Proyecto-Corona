const express = require("express");
const { getWorkers, getWorker } = require("../controllers/workersController");

const router = express.Router();

router.get("/", getWorkers);
router.get("/:id", getWorker);

module.exports = router;
