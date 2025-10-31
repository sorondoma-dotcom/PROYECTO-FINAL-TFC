const natacionService = require('../services/natacion.service');

async function list(req, res) {
  try {
    const result = await natacionService.fetchCompetitions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener datos de natación', mensaje: error.message });
  }
}

async function detail(req, res) {
  try {
    const { id } = req.params;
    const result = await natacionService.fetchCompetitionById(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener resultados de la competición', mensaje: error.message });
  }
}

module.exports = { list, detail };
