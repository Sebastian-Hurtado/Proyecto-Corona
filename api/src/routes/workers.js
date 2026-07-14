const express = require("express");
const {
  postManualWorker,
  getWorkers,
  getWorker,
} = require("../controllers/workersController");

const router = express.Router();

router.post("/manual", postManualWorker);
router.get("/", getWorkers);
router.get("/:id", getWorker);

module.exports = router;
