const scrapeService = require('../services/scrape.service');

async function scrape(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Por favor proporciona una URL', ejemplo: '/api/scrape?url=https://live.swimrankings.net/' });

    const result = await scrapeService.scrapeUrl(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al hacer scraping', mensaje: error.message });
  }
}

module.exports = { scrape };
