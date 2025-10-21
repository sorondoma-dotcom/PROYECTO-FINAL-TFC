const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

const USER_AGENT = 'TFC-Natacion-Bot/1.0 (Proyecto universitario; contacto@email.com)';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones, por favor intenta más tarde'
});

app.use(cors());
app.use(express.json());
app.use('/api/', limiter);

const cache = new NodeCache({ stdTTL: 3600 });

app.get('/', (req, res) => {
  res.json({
    message: 'API de Web Scraping - Proyecto Académico',
    disclaimer: 'Este servicio extrae datos públicos con fines educativos.',
    endpoints: {
      natacion: '/api/natacion',
      competicion: '/api/natacion/:id',
      worldAquaticsRankings: '/api/world-aquatics/rankings?gender=F&distance=100&stroke=BACKSTROKE&poolConfiguration=LCM'
    }
  });
});

app.get('/api/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: 'Por favor proporciona una URL',
        ejemplo: '/api/scrape?url=https://live.swimrankings.net/'
      });
    }

    const response = await axios.get(url);
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
      if (texto) {
        datos.parrafos.push(texto);
      }
    });

    res.json({
      success: true,
      url: url,
      timestamp: new Date().toISOString(),
      datos: datos
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al hacer scraping',
      mensaje: error.message
    });
  }
});

app.get('/api/natacion', async (req, res) => {
  try {
    const cacheKey = 'competiciones';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const url = 'https://live.swimrankings.net/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    const $ = cheerio.load(response.data);
    const competiciones = [];

    $('table tbody tr').each((index, element) => {
      const $row = $(element);
      const celdas = $row.find('td');
      
      if (celdas.length >= 4) {
        let enlace = $row.find('a').first().attr('href') || '';
        
        if (!enlace) {
          enlace = $(celdas[3]).find('a').attr('href') || '';
        }
        
        let urlResultados = '';
        let competicionId = '';
        
        if (enlace) {
          if (enlace.startsWith('http')) {
            urlResultados = enlace;
          } else if (enlace.startsWith('/')) {
            urlResultados = `https://live.swimrankings.net${enlace}`;
          } else {
            urlResultados = `https://live.swimrankings.net/${enlace}`;
          }
          
          const match = enlace.match(/\/(\d+)\/?/);
          if (match) {
            competicionId = match[1];
          }
        }

        const competicion = {
          id: competicionId,
          date: $(celdas[0]).text().trim(),
          course: $(celdas[1]).text().trim(),
          city: $(celdas[2]).text().trim(),
          name: $(celdas[3]).text().trim(),
          urlResultados: urlResultados,
          hasResults: !!enlace
        };
        
        if (competicion.date || competicion.name) {
          competiciones.push(competicion);
        }
      }
    });

    if (competiciones.length === 0) {
      $('.table tr, .results tr, [class*="result"] tr').each((index, element) => {
        const $row = $(element);
        const celdas = $row.find('td');
        
        if (celdas.length >= 4) {
          let enlace = $row.find('a').first().attr('href') || '';
          
          if (!enlace) {
            enlace = $(celdas[3]).find('a').attr('href') || '';
          }
          
          let urlResultados = '';
          let competicionId = '';
          
          if (enlace) {
            if (enlace.startsWith('http')) {
              urlResultados = enlace;
            } else if (enlace.startsWith('/')) {
              urlResultados = `https://live.swimrankings.net${enlace}`;
            } else {
              urlResultados = `https://live.swimrankings.net/${enlace}`;
            }
            
            const match = enlace.match(/\/(\d+)\/?/);
            if (match) {
              competicionId = match[1];
            }
          }

          competiciones.push({
            id: competicionId,
            date: $(celdas[0]).text().trim(),
            course: $(celdas[1]).text().trim(),
            city: $(celdas[2]).text().trim(),
            name: $(celdas[3]).text().trim(),
            urlResultados: urlResultados,
            hasResults: !!enlace
          });
        }
      });
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      total: competiciones.length,
      competiciones: competiciones
    };

    cache.set(cacheKey, result);
    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos de natación',
      mensaje: error.message,
      detalles: error.stack
    });
  }
});

app.get('/api/natacion/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const baseHost = 'https://live.swimrankings.net';
    const baseUrl = `${baseHost}/${id}/`;
    const url = `${baseUrl}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    const $ = cheerio.load(response.data);

    const infoCompeticion = {
      titulo: $('h1').first().text().trim(),
      subtitulo: $('h2').first().text().trim(),
      fecha: $('.date, [class*="date"]').first().text().trim(),
      ciudad: $('.location, [class*="location"]').first().text().trim(),
    };

    const eventosPorEstilo = [];
    let estiloActual = null;

    const extraerEnlacesPDF = (celda) => {
      const enlaces = [];
      $(celda).find('a[href$=".pdf"]').each((i, link) => {
        const raw = ($(link).attr('href') || '').trim();
        if (!raw) return;

        const absUrl = raw.startsWith('http')
          ? raw
          : (raw.startsWith('/')
              ? `${baseHost}${raw}`
              : `${baseUrl}${raw}`);

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

        if (eventoMasc.distancia && eventoMasc.distancia !== '.........') {
          estiloActual.masculino.push(eventoMasc);
        }
        if (eventoFem.distancia && eventoFem.distancia !== '.........') {
          estiloActual.femenino.push(eventoFem);
        }
      }
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      competicionId: id,
      url,
      informacion: infoCompeticion,
      total: eventosPorEstilo.length,
      eventosPorEstilo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener resultados de la competición',
      mensaje: error.message,
      detalles: error.stack
    });
  }
});

// ENDPOINT: World Aquatics Rankings
app.get('/api/world-aquatics/rankings', async (req, res) => {
  try {
    const { 
      gender = 'F', 
      distance = '100', 
      stroke = 'BACKSTROKE', 
      poolConfiguration = 'LCM',
      year = 'all',
      startDate = '',
      endDate = '',
      timesMode = 'ALL_TIMES',
      regionId = 'all',
      countryId = ''
    } = req.query;

    console.log(`📡 Scraping World Aquatics Rankings`);
    console.log(`   Gender: ${gender}, Distance: ${distance}m, Stroke: ${stroke}, Pool: ${poolConfiguration}`);
    
    const cacheKey = `rankings-${gender}-${distance}-${stroke}-${poolConfiguration}-${year}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log('✅ Devolviendo desde cache');
      return res.json(cachedData);
    }

    const url = `https://www.worldaquatics.com/swimming/rankings?gender=${gender}&distance=${distance}&stroke=${stroke}&poolConfiguration=${poolConfiguration}&year=${year}&startDate=${startDate}&endDate=${endDate}&timesMode=${timesMode}&regionId=${regionId}&countryId=${countryId}`;
    
    console.log('🌐 Lanzando navegador para:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    
    console.log('🔄 Navegando...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // Aumentado a 60s
    
    console.log('⏳ Esperando que cargue la tabla inicial...');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Aumentado a 8s
    
    console.log('🔘 Haciendo clic en botón "Show More" repetidamente...');
    
    // Hacer clic en el botón "Show More" hasta cargar todos
    let clickCount = 0;
    const maxClicks = 100; // Aumentado a 100 para asegurar
    let previousCount = 0;
    let sameCountAttempts = 0;
    
    while (clickCount < maxClicks) {
      // Contar cuántas filas hay ahora
      const currentCount = await page.evaluate(() => {
        const tabla = document.querySelector('table');
        if (!tabla) return 0;
        return tabla.querySelectorAll('tbody tr').length;
      });
      
      console.log(`   Filas actuales: ${currentCount}`);
      
      // Si el contador no cambia después de 3 intentos, probablemente ya no hay más
      if (currentCount === previousCount) {
        sameCountAttempts++;
        if (sameCountAttempts >= 3) {
          console.log(`✅ No hay más datos (contador estable en ${currentCount} filas)`);
          break;
        }
      } else {
        sameCountAttempts = 0;
        previousCount = currentCount;
      }
      
      // Intentar hacer clic en "Show More"
      const hasMoreButton = await page.evaluate(() => {
        const showMoreBtn = document.querySelector('.js-show-more-button, button.load-more-button, button.js-show-more-button, .load-more-button');
        
        if (showMoreBtn && !showMoreBtn.disabled && showMoreBtn.offsetParent !== null) {
          // Hacer scroll al botón por si está fuera de vista
          showMoreBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Esperar un momento antes de hacer clic
          setTimeout(() => {
            showMoreBtn.click();
          }, 500);
          
          return true;
        }
        
        return false;
      });
      
      if (!hasMoreButton) {
        console.log(`✅ Botón "Show More" no encontrado o deshabilitado (después de ${clickCount} clics)`);
        break;
      }
      
      clickCount++;
      console.log(`   Clic #${clickCount} en "Show More"`);
      
      // Esperar más tiempo para que carguen los datos (aumentado)
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos
    }
    
    if (clickCount >= maxClicks) {
      console.log(`⚠️  Se alcanzó el límite de ${maxClicks} clics`);
    }
    
    console.log('⏳ Esperando carga final de datos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Extrayendo todos los rankings...');
    
    const datos = await page.evaluate(() => {
      const resultado = {
        filtros: {},
        rankings: []
      };

      // Extraer información de los filtros aplicados
      resultado.filtros = {
        genero: document.querySelector('[name="gender"]')?.value || '',
        distancia: document.querySelector('[name="distance"]')?.value || '',
        estilo: document.querySelector('[name="stroke"]')?.value || '',
        piscina: document.querySelector('[name="poolConfiguration"]')?.value || ''
      };

      // Buscar la tabla de rankings
      const tablas = document.querySelectorAll('table');
      let tablaRankings = null;

      tablas.forEach(tabla => {
        const headers = tabla.querySelectorAll('thead th, th');
        const headerTexts = Array.from(headers).map(h => h.textContent.trim());
        
        if (headerTexts.some(h => h.includes('Overall Rank') || (h.includes('Country') && headerTexts.some(t => t.includes('Name')) && headerTexts.some(t => t.includes('Time'))))) {
          tablaRankings = tabla;
        }
      });

      if (tablaRankings) {
        const filas = tablaRankings.querySelectorAll('tbody tr');
        
        console.log(`Total de filas en tbody: ${filas.length}`);
        
        filas.forEach((fila, idx) => {
          const celdas = fila.querySelectorAll('td');
          
          // Verificar que tenga las 10 columnas esperadas
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

            // Solo añadir si tiene al menos nombre y tiempo
            if (nadador.name && nadador.time) {
              resultado.rankings.push(nadador);
            }
          } else if (celdas.length > 0) {
            // Debug: mostrar filas con número diferente de columnas
            console.log(`Fila ${idx} tiene ${celdas.length} columnas`);
          }
        });
      }

      return resultado;
    });

    await browser.close();
    console.log(`🎯 TOTAL FINAL: ${datos.rankings.length} nadadores en el ranking (después de ${clickCount} clics)`);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url: url,
      fuente: 'World Aquatics Rankings (Puppeteer)',
      parametros: {
        gender,
        distance: `${distance}m`,
        stroke,
        poolConfiguration,
        year
      },
      total: datos.rankings.length,
      clicksRealizados: clickCount,
      ...datos
    };

    cache.set(cacheKey, result);
    res.json(result);

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al scraping rankings de World Aquatics',
      mensaje: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
  console.log(`📝 Endpoints:`);
  console.log(`   - GET /api/natacion`);
  console.log(`   - GET /api/natacion/:id`);
  console.log(`   - GET /api/world-aquatics/rankings`);
  console.log(`       Parámetros: ?gender=F|M&distance=50-1500&stroke=BACKSTROKE|BREASTSTROKE|etc&poolConfiguration=LCM|SCM`);
});