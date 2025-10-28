const express = require('express');
const puppeteer = require('puppeteer');
const cache = require('../lib/cache');
const { USER_AGENT } = require('../lib/constants');

const router = express.Router();

// /api/world-aquatics/rankings
router.get('/rankings', async (req, res) => {
  try {
    const { gender = 'F', distance = '100', stroke = 'BACKSTROKE', poolConfiguration = 'LCM', year = 'all', startDate = '', endDate = '', timesMode = 'ALL_TIMES', regionId = 'all', countryId = '' } = req.query;

    const cacheKey = `rankings-${gender}-${distance}-${stroke}-${poolConfiguration}-${year}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    const url = `https://www.worldaquatics.com/swimming/rankings?gender=${gender}&distance=${distance}&stroke=${stroke}&poolConfiguration=${poolConfiguration}&year=${year}&startDate=${startDate}&endDate=${endDate}&timesMode=${timesMode}&regionId=${regionId}&countryId=${countryId}`;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 8000));

    let clickCount = 0;
    const maxClicks = 100;
    let previousCount = 0;
    let sameCountAttempts = 0;

    while (clickCount < maxClicks) {
      const currentCount = await page.evaluate(() => {
        const tabla = document.querySelector('table');
        if (!tabla) return 0;
        return tabla.querySelectorAll('tbody tr').length;
      });

      if (currentCount === previousCount) {
        sameCountAttempts++;
        if (sameCountAttempts >= 3) break;
      } else {
        sameCountAttempts = 0;
        previousCount = currentCount;
      }

      const showMoreBtn = await page.$('.js-show-more-button, .load-more-button');
      if (showMoreBtn) {
        await showMoreBtn.evaluate(btn => btn.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await new Promise(resolve => setTimeout(resolve, 500));
        await showMoreBtn.click();
        clickCount++;
        await new Promise(resolve => setTimeout(resolve, 4000));
      } else {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(resolve => setTimeout(resolve, 1500));
        clickCount++;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    const datos = await page.evaluate(() => {
      const resultado = { filtros: {}, rankings: [] };
      resultado.filtros = {
        genero: document.querySelector('[name="gender"]')?.value || '',
        distancia: document.querySelector('[name="distance"]')?.value || '',
        estilo: document.querySelector('[name="stroke"]')?.value || '',
        piscina: document.querySelector('[name="poolConfiguration"]')?.value || ''
      };

      const tablas = document.querySelectorAll('table');
      let tablaRankings = null;
      tablas.forEach(tabla => {
        const headers = tabla.querySelectorAll('thead th, th');
        const headerTexts = Array.from(headers).map(h => h.textContent.trim());
        if (headerTexts.some(h => h.includes('Overall Rank') || (h.includes('Country') && headerTexts.some(t => t.includes('Name')) && headerTexts.some(t => t.includes('Time'))))) tablaRankings = tabla;
      });

      if (tablaRankings) {
        const filas = tablaRankings.querySelectorAll('tbody tr');
        filas.forEach((fila) => {
          const celdas = fila.querySelectorAll('td');
          if (celdas.length >= 10) {
            const nadador = {
              overallRank: celdas[0]?.textContent.trim() || '',
              country: celdas[1]?.textContent.trim() || '',
              name: celdas[2]?.textContent.trim() || '',
              age: celdas[3]?.textContent.trim() || '',
              time: celdas[4]?.textContent.trim() || '',
              points: celdas[5]?.textContent.trim() || '',
              tag: celdas[6]?.textContent.trim() || '',
              competition: celdas[7]?.textContent.trim() || '',
              location: celdas[8]?.textContent.trim() || '',
              date: celdas[9]?.textContent.trim() || ''
            };
            if (nadador.name && nadador.time) resultado.rankings.push(nadador);
          }
        });
      }
      return resultado;
    });

    await browser.close();

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url,
      fuente: 'World Aquatics Rankings (Puppeteer)',
      parametros: { gender, distance: `${distance}m`, stroke, poolConfiguration, year },
      total: datos.rankings.length,
      clicksRealizados: clickCount,
      ...datos
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error rankings:', error.message);
    res.status(500).json({ success: false, error: 'Error al scraping rankings de World Aquatics', mensaje: error.message });
  }
});

// /api/world-aquatics/athletes
router.get('/athletes', async (req, res) => {
  try {
    const { gender = '', discipline = 'SW', nationality = '', name = '' } = req.query;
    const cacheKey = `athletes-${gender}-${discipline}-${nationality}-${name}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    const url = `https://www.worldaquatics.com/swimming/athletes?gender=${gender}&discipline=${discipline}&nationality=${nationality}&name=${encodeURIComponent(name)}`;
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 6000));

    const atletas = await page.evaluate(() => {
      const resultado = [];
      const cards = document.querySelectorAll('.athlete-card, .athlete-list-card');
      cards.forEach(card => {
        const name = card.querySelector('.athlete-card__name, .athlete-list-card__name')?.textContent.trim() || '';
        const nationality = card.querySelector('.athlete-card__country, .athlete-list-card__country')?.textContent.trim() || '';
        const birth = card.querySelector('.athlete-card__birth, .athlete-list-card__birth')?.textContent.trim() || '';
        const profileUrl = card.querySelector('a')?.href || '';
        const imageUrl = card.querySelector('img')?.src || '';
        resultado.push({ name, nationality, birth, profileUrl, imageUrl });
      });
      return resultado;
    });

    await browser.close();
    const result = { success: true, timestamp: new Date().toISOString(), url, total: atletas.length, atletas };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener atletas de World Aquatics', mensaje: error.message });
  }
});

module.exports = router;
