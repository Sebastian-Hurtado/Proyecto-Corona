const { importWorkbook, getImportIssues } = require("../services/importService");

async function uploadExcel(req, res, next) {
  try {
    if (!req.file) {
      res.status(400).json({ message: "Debes adjuntar un archivo Excel." });
      return;
    }

    const result = await importWorkbook(req.file.buffer, req.file.originalname);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function listImportIssues(req, res, next) {
  try {
    const issues = await getImportIssues(Number(req.params.id));
    res.json({ issues });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadExcel,
  listImportIssues,
};
