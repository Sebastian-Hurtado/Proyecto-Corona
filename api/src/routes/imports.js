const express = require("express");
const multer = require("multer");
const {
  uploadExcel,
  listImportIssues,
} = require("../controllers/importsController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/excel", upload.single("file"), uploadExcel);
router.get("/:id/issues", listImportIssues);

module.exports = router;
