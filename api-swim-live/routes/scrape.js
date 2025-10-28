const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { USER_AGENT } = require('../lib/constants');

const router = express.Router();

router.get('/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: 'Por favor proporciona una URL',
        ejemplo: '/api/scrape?url=https://live.swimrankings.net/'
      });
    }

    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const html = response.data;
    const $ = cheerio.load(html);

    const datos = {
      titulo: $('title').text(),
      descripcion: $('meta[name="description"]').attr('content'),
      headings: [],
      enlaces: [],
      parrafos: []
    };

    $('h1').each((index, element) => {
      datos.headings.push($(element).text().trim());
    });

    $('a').slice(0, 10).each((index, element) => {
      datos.enlaces.push({
        texto: $(element).text().trim(),
        href: $(element).attr('href')
      });
    });

    $('p').slice(0, 5).each((index, element) => {
      const texto = $(element).text().trim();
      if (texto) datos.parrafos.push(texto);
    });

    res.json({ success: true, url, timestamp: new Date().toISOString(), datos });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al hacer scraping', mensaje: error.message });
  }
});

module.exports = router;
