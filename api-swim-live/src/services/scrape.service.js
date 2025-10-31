const axios = require('axios');
const cheerio = require('cheerio');
const { USER_AGENT } = require('../../lib/constants');

async function scrapeUrl(url) {
  if (!url) throw new Error('URL requerida');

  const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
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

  return { success: true, url, timestamp: new Date().toISOString(), datos };
}

module.exports = { scrapeUrl };
