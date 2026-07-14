const {
  createManualWorker,
  listWorkers,
  getWorkerById,
} = require("../services/workerService");

async function getWorkers(req, res, next) {
  try {
    const workers = await listWorkers();
    res.json({ workers });
  } catch (error) {
    next(error);
  }
}

async function getWorker(req, res, next) {
  try {
    const worker = await getWorkerById(Number(req.params.id));

    if (!worker) {
      res.status(404).json({ message: "No se encontro el trabajador solicitado." });
      return;
    }

    res.json(worker);
  } catch (error) {
    next(error);
  }
}

async function postManualWorker(req, res, next) {
  try {
    const worker = await createManualWorker(req.body);
    res.status(201).json(worker);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postManualWorker,
  getWorkers,
  getWorker,
};
