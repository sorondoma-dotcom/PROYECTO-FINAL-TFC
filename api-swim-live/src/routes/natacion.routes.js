const express = require('express');
// Reuse the existing logic from original routes, adapted path to lib
const axios = require('axios');
const cheerio = require('cheerio');
const cache = require('../../lib/cache');
const { USER_AGENT } = require('../../lib/constants');

const router = express.Router();

// GET /api/natacion
router.get('/natacion', async (req, res) => {
  try {
    const cacheKey = 'competiciones';
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    const url = 'https://live.swimrankings.net/';
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(response.data);
    const competiciones = [];

    $('table tbody tr').each((index, element) => {
      const $row = $(element);
      const celdas = $row.find('td');
      if (celdas.length >= 4) {
        let enlace = $row.find('a').first().attr('href') || '';
        if (!enlace) enlace = $(celdas[3]).find('a').attr('href') || '';

        let urlResultados = '';
        let competicionId = '';
        if (enlace) {
          if (enlace.startsWith('http')) urlResultados = enlace;
          else if (enlace.startsWith('/')) urlResultados = `https://live.swimrankings.net${enlace}`;
          else urlResultados = `https://live.swimrankings.net/${enlace}`;

          const match = enlace.match(/\/(\d+)\/?/);
          if (match) competicionId = match[1];
        }

        const competicion = {
          id: competicionId,
          date: $(celdas[0]).text().trim(),
          course: $(celdas[1]).text().trim(),
          city: $(celdas[2]).text().trim(),
          name: $(celdas[3]).text().trim(),
          urlResultados,
          hasResults: !!enlace
        };

        if (competicion.date || competicion.name) competiciones.push(competicion);
      }
    });

    if (competiciones.length === 0) {
      $('.table tr, .results tr, [class*="result"] tr').each((index, element) => {
        const $row = $(element);
        const celdas = $row.find('td');
        if (celdas.length >= 4) {
          let enlace = $row.find('a').first().attr('href') || '';
          if (!enlace) enlace = $(celdas[3]).find('a').attr('href') || '';

          let urlResultados = '';
          let competicionId = '';
          if (enlace) {
            if (enlace.startsWith('http')) urlResultados = enlace;
            else if (enlace.startsWith('/')) urlResultados = `https://live.swimrankings.net${enlace}`;
            else urlResultados = `https://live.swimrankings.net/${enlace}`;

            const match = enlace.match(/\/(\d+)\/?/);
            if (match) competicionId = match[1];
          }

          competiciones.push({
            id: competicionId,
            date: $(celdas[0]).text().trim(),
            course: $(celdas[1]).text().trim(),
            city: $(celdas[2]).text().trim(),
            name: $(celdas[3]).text().trim(),
            urlResultados,
            hasResults: !!enlace
          });
        }
      });
    }

    const result = { success: true, timestamp: new Date().toISOString(), total: competiciones.length, competiciones };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener datos de natación', mensaje: error.message, detalles: error.stack });
  }
});

// GET /api/natacion/:id
router.get('/natacion/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const baseHost = 'https://live.swimrankings.net';
    const baseUrl = `${baseHost}/${id}/`;
    const url = `${baseUrl}`;

    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(response.data);

    const infoCompeticion = {
      titulo: $('h1').first().text().trim(),
      subtitulo: $('h2').first().text().trim(),
      fecha: $('.date, [class*="date"]').first().text().trim(),
      ciudad: $('.location, [class*="location"]').first().text().trim()
    };

    const eventosPorEstilo = [];
    let estiloActual = null;

    const extraerEnlacesPDF = (celda) => {
      const enlaces = [];
      $(celda).find('a[href$=".pdf"]').each((i, link) => {
        const raw = ($(link).attr('href') || '').trim();
        if (!raw) return;

        const absUrl = raw.startsWith('http') ? raw : (raw.startsWith('/') ? `${baseHost}${raw}` : `${baseUrl}${raw}`);
        const file = absUrl.split('/').pop() || '';
        const m = file.match(/(StartList|ResultList|Results|Result)_(\d+)\.pdf/i);

        enlaces.push({
          texto: ($(link).text() || '').trim() || undefined,
          url: absUrl,
          file,
          tipo: m ? (m[1].toLowerCase().includes('start') ? 'salidas' : 'resultados') : undefined,
          index: m ? parseInt(m[2], 10) : undefined
        });
      });
      return enlaces;
    };

    $('table tbody tr').each((index, element) => {
      const $row = $(element);
      if ($row.hasClass('trTitle1')) return;
      if ($row.hasClass('trTitle2')) {
        const estiloMasc = $row.find('td').eq(0).text().trim();
        estiloActual = { estilo: estiloMasc, masculino: [], femenino: [] };
        eventosPorEstilo.push(estiloActual);
        return;
      }

      const celdas = $row.find('td');
      if (celdas.length === 0 || $row.text().trim() === '') return;

      if (estiloActual && celdas.length >= 11) {
        const eventoMasc = {
          distancia: $(celdas[0]).text().trim(),
          tipo: $(celdas[1]).text().trim(),
          categoria: $(celdas[2]).text().trim(),
          hora: $(celdas[3]).text().trim().replace(/\s+/g, ' '),
          info: $(celdas[4]).text().trim(),
          pdfSalidas: extraerEnlacesPDF(celdas[3]),
          pdfResultados: extraerEnlacesPDF(celdas[4])
        };

        const eventoFem = {
          distancia: $(celdas[6]).text().trim(),
          tipo: $(celdas[7]).text().trim(),
          categoria: $(celdas[8]).text().trim(),
          hora: $(celdas[9]).text().trim().replace(/\s+/g, ' '),
          info: $(celdas[10]).text().trim(),
          pdfSalidas: extraerEnlacesPDF(celdas[9]),
          pdfResultados: extraerEnlacesPDF(celdas[10])
        };

        if (eventoMasc.distancia && eventoMasc.distancia !== '.........') estiloActual.masculino.push(eventoMasc);
        if (eventoFem.distancia && eventoFem.distancia !== '.........') estiloActual.femenino.push(eventoFem);
      }
    });

    res.json({ success: true, timestamp: new Date().toISOString(), competicionId: id, url, informacion: infoCompeticion, total: eventosPorEstilo.length, eventosPorEstilo });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener resultados de la competición', mensaje: error.message, detalles: error.stack });
  }
});

module.exports = router;
