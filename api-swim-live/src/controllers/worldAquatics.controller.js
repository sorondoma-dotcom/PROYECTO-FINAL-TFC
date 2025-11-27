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

async function competitions(req, res) {
  try {
    const params = req.query || {};
    const cacheTtl = Number.isFinite(Number(params.cacheTtl))
      ? Number(params.cacheTtl)
      : Number.parseInt(process.env.WORLD_AQUATICS_COMP_TTL || "3600", 10);

    const result = await worldService.fetchCompetitionsList({
      ...params,
      cacheTtl,
    });

    if (cacheTtl > 0) {
      res.set('Cache-Control', `public, max-age=${cacheTtl}`);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener competiciones de World Aquatics', mensaje: error.message });
  }
}

async function competitionResults(req, res) {
  try {
    const { slug = '', url = '', refresh = 'false' } = req.query || {};
    if (!slug && !url) {
      return res.status(400).json({
        success: false,
        error: 'Debes proporcionar el slug o la URL de la competición',
      });
    }
    const result = await worldService.fetchCompetitionEvents({
      slug,
      url,
      refresh: refresh === 'true',
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener los eventos de resultados de World Aquatics',
      mensaje: error.message,
    });
  }
}

async function competitionEventResult(req, res) {
  try {
    const {
      slug = '',
      url = '',
      eventGuid = '',
      unitId = '',
      refresh = 'false',
    } = req.query || {};

    if (!eventGuid) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro eventGuid es obligatorio',
      });
    }
    if (!slug && !url) {
      return res.status(400).json({
        success: false,
        error: 'Debes proporcionar el slug o la URL de la competición',
      });
    }

    const result = await worldService.fetchCompetitionEventResults({
      slug,
      url,
      eventGuid,
      unitId,
      refresh: refresh === 'true',
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener la tabla de resultados solicitada',
      mensaje: error.message,
    });
  }
}

module.exports = {
  rankings,
  competitions,
  competitionResults,
  competitionEventResult,
};
