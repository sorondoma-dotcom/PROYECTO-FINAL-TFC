const worldService = require('../services/worldAquatics.service');

async function rankings(req, res) {
  try {
    const params = req.query || {};
    const result = await worldService.fetchRankings(params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al scraping rankings de World Aquatics', mensaje: error.message });
  }
}

async function athletes(req, res) {
  try {
    const params = req.query || {};
    const result = await worldService.fetchAthletes(params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener atletas de World Aquatics', mensaje: error.message });
  }
}

module.exports = { rankings, athletes };
