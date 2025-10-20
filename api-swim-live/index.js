const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();
const PORT = 3000;

// 1. Añadir User-Agent identificable y respetuoso
const USER_AGENT = 'TFC-Natacion-Bot/1.0 (Proyecto universitario; contacto@email.com)';

// 2. Implementar rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 peticiones por ventana
  message: 'Demasiadas peticiones, por favor intenta más tarde'
});

// Habilitar CORS para todas las peticiones
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());
app.use('/api/', limiter);

// Cache de 1 hora
const cache = new NodeCache({ stdTTL: 3600 });

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'API de Web Scraping - Proyecto Académico',
    disclaimer: 'Este servicio extrae datos públicos con fines educativos. No afiliado con SwimRankings ni RFEN.',
    endpoints: {
      natacion: '/api/natacion',
      competicion: '/api/natacion/:id',
      nacionales: '/api/natacion-nacional'
    }
  });
});

// Endpoint para hacer scraping
app.get('/api/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: 'Por favor proporciona una URL',
        ejemplo: '/api/scrape?url=https://live.swimrankings.net/'
      });
    }

    // Hacer petición a la página web
    const response = await axios.get(url);
    const html = response.data;

    // Parsear el HTML con Cheerio
    const $ = cheerio.load(html);

    // AQUÍ PERSONALIZAS EL SCRAPING SEGÚN LA PÁGINA
    // Ejemplo: extraer títulos, párrafos, enlaces, etc.
    const datos = {
      titulo: $('title').text(),
      descripcion: $('meta[name="description"]').attr('content'),
      headings: [],
      enlaces: [],
      parrafos: []
    };

    // Extraer todos los h1
    $('h1').each((index, element) => {
      datos.headings.push($(element).text().trim());
    });

    // Extraer enlaces (máximo 10)
    $('a').slice(0, 10).each((index, element) => {
      datos.enlaces.push({
        texto: $(element).text().trim(),
        href: $(element).attr('href')
      });
    });

    // Extraer párrafos (máximo 5)
    $('p').slice(0, 5).each((index, element) => {
      const texto = $(element).text().trim();
      if (texto) {
        datos.parrafos.push(texto);
      }
    });

    // Devolver los datos como JSON
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

// Endpoint específico: scraping de competiciones de natación en vivo
app.get('/api/natacion', async (req, res) => {
  try {
    // Verificar cache primero
    const cacheKey = 'competiciones';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    // Si no hay cache, hacer scraping
    const url = 'https://live.swimrankings.net/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    const $ = cheerio.load(response.data);

    const competiciones = [];

    // Buscar la tabla con los resultados en vivo
    $('table tbody tr').each((index, element) => {
      const $row = $(element);
      const celdas = $row.find('td');
      
      if (celdas.length >= 4) {
        // Buscar el enlace en la fila (puede estar en cualquier celda)
        let enlace = $row.find('a').first().attr('href') || '';
        
        // Si no hay enlace en la fila, buscar específicamente en la celda del nombre (última celda)
        if (!enlace) {
          enlace = $(celdas[3]).find('a').attr('href') || '';
        }
        
        // Construir URL completa
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
          
          // Extraer el ID de la competición del enlace
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
        
        // Solo agregar si tiene datos válidos
        if (competicion.date || competicion.name) {
          competiciones.push(competicion);
        }
      }
    });

    // Si no encontramos con el selector anterior, intentar con clases específicas
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

    // Guardar en cache
    cache.set(cacheKey, {
      success: true,
      timestamp: new Date().toISOString(),
      total: competiciones.length,
      competiciones: competiciones
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total: competiciones.length,
      competiciones: competiciones
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos de natación',
      mensaje: error.message,
      detalles: error.stack
    });
  }
});

// Nuevo endpoint: obtener resultados de una competición específica
app.get('/api/natacion/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const baseHost = 'https://live.swimrankings.net';
    const baseUrl = `${baseHost}/${id}/`;
    const url = `${baseUrl}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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

    // Función auxiliar para normalizar y enriquecer los enlaces PDF
    const extraerEnlacesPDF = (celda) => {
      const enlaces = [];
      $(celda).find('a[href$=".pdf"]').each((i, link) => {
        const raw = ($(link).attr('href') || '').trim();
        if (!raw) return;

        // Normalizar a URL absoluta con el formato deseado
        const absUrl = raw.startsWith('http')
          ? raw
          : (raw.startsWith('/')
              ? `${baseHost}${raw}`
              : `${baseUrl}${raw}`); // ej: StartList_24.pdf -> https://live.swimrankings.net/{id}/StartList_24.pdf

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
      totalEstilos: eventosPorEstilo.length,
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

// Nuevo endpoint: scraping de rankings SwimSwam
app.get('/api/rankings', async (req, res) => {
  try {
    // Verificar cache primero
    const cacheKey = 'rankings-swimswam';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const url = 'https://swimswam.com/ranking/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    const $ = cheerio.load(response.data);

    const rankings = [];

    // Buscar todos los contenedores de rankings
    $('.ranking-block, .ranking-table, [class*="ranking"]').each((index, element) => {
      const $block = $(element);
      
      // Extraer título del ranking (ej: "2025-2026 LCM Men 100 FREE")
      let titulo = $block.find('h2, h3, h4, .title, .ranking-title').first().text().trim();
      
      // Si no encuentra título en el bloque, buscar el título anterior más cercano
      if (!titulo) {
        titulo = $block.prevAll('h2, h3, h4').first().text().trim();
      }

      // Parsear el título para extraer información
      const tituloMatch = titulo.match(/(\d{4}-\d{4})?\s*(LCM|SCM|SCY)?\s*(Men|Women|Mixed)?\s*(\d+)\s*(\w+)/i);
      
      let temporada = '';
      let piscina = '';
      let genero = '';
      let distancia = '';
      let estilo = '';

      if (tituloMatch) {
        temporada = tituloMatch[1] || '';
        piscina = tituloMatch[2] || '';
        genero = tituloMatch[3] || '';
        distancia = tituloMatch[4] || '';
        estilo = tituloMatch[5] || '';
      }

      const nadadores = [];

      // Buscar tabla dentro del bloque
      $block.find('table tbody tr, .ranking-row, [class*="athlete"]').each((idx, row) => {
        const $row = $(row);
        const celdas = $row.find('td, .cell, [class*="col"]');
        
        if (celdas.length >= 4) {
          // Formato típico: Posición | Nombre | País | Tiempo | Fecha
          const posicion = $(celdas[0]).text().trim();
          const nombre = $(celdas[1]).text().trim();
          const pais = $(celdas[2]).text().trim();
          const tiempo = $(celdas[3]).text().trim();
          const fecha = celdas.length > 4 ? $(celdas[4]).text().trim() : '';

          if (nombre && tiempo) {
            nadadores.push({
              posicion: posicion.replace(/\D/g, ''), // Eliminar caracteres no numéricos
              nombre: nombre,
              pais: pais,
              tiempo: tiempo,
              fecha: fecha
            });
          }
        } else {
          // Formato alternativo: buscar spans o divs con clases específicas
          const nombre = $row.find('.name, .athlete-name, [class*="name"]').text().trim();
          const pais = $row.find('.country, .nat, [class*="country"]').text().trim();
          const tiempo = $row.find('.time, .mark, [class*="time"]').text().trim();
          const fecha = $row.find('.date, [class*="date"]').text().trim();
          const posicion = $row.find('.rank, .pos, [class*="rank"]').text().trim();

          if (nombre && tiempo) {
            nadadores.push({
              posicion: posicion.replace(/\D/g, '') || (idx + 1).toString(),
              nombre: nombre,
              pais: pais,
              tiempo: tiempo,
              fecha: fecha
            });
          }
        }
      });

      // Buscar enlace "View Top X" o "Ver más"
      const verMasLink = $block.find('a[href*="ranking"], a:contains("View"), a:contains("Ver")').attr('href');
      let urlCompleta = '';
      
      if (verMasLink) {
        urlCompleta = verMasLink.startsWith('http') 
          ? verMasLink 
          : `https://swimswam.com${verMasLink}`;
      }

      if (nadadores.length > 0) {
        rankings.push({
          titulo: titulo,
          temporada: temporada,
          piscina: piscina, // LCM (50m), SCM (25m), SCY (25 yardas)
          genero: genero,
          distancia: distancia,
          estilo: estilo,
          totalMostrados: nadadores.length,
          nadadores: nadadores,
          urlCompleta: urlCompleta
        });
      }
    });

    // Si no encuentra con el método anterior, intentar scraping más agresivo del HTML raw
    if (rankings.length === 0) {
      const textoCompleto = $('body').text();
      const lineas = textoCompleto.split('\n').map(l => l.trim()).filter(l => l);
      
      let rankingActual = null;
      
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        
        // Detectar título de ranking
        const matchTitulo = linea.match(/(\d{4}-\d{4})?\s*(LCM|SCM|SCY)?\s*(Men|Women|Mixed)?\s*(\d+)\s*(FREE|BACK|BREAST|FLY|IM)/i);
        
        if (matchTitulo) {
          // Guardar ranking anterior si existe
          if (rankingActual && rankingActual.nadadores.length > 0) {
            rankings.push(rankingActual);
          }
          
          // Iniciar nuevo ranking
          rankingActual = {
            titulo: linea,
            temporada: matchTitulo[1] || '',
            piscina: matchTitulo[2] || '',
            genero: matchTitulo[3] || '',
            distancia: matchTitulo[4] || '',
            estilo: matchTitulo[5] || '',
            nadadores: [],
            urlCompleta: ''
          };
          continue;
        }
        
        // Detectar línea de nadador (formato: número + texto + país + tiempo)
        if (rankingActual) {
          const matchNadador = linea.match(/^(\d+)\s+(.+?)\s+([A-Z]{3})\s+(\d{1,2}:?\d{2}\.\d{2})\s+(\d{2}\/\d{2})?/);
          
          if (matchNadador) {
            rankingActual.nadadores.push({
              posicion: matchNadador[1],
              nombre: matchNadador[2].trim(),
              pais: matchNadador[3],
              tiempo: matchNadador[4],
              fecha: matchNadador[5] || ''
            });
          }
        }
      }
      
      // Agregar último ranking
      if (rankingActual && rankingActual.nadadores.length > 0) {
        rankings.push(rankingActual);
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url: url,
      totalRankings: rankings.length,
      rankings: rankings
    };

    // Guardar en cache
    cache.set(cacheKey, result);

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener rankings',
      mensaje: error.message,
      detalles: error.stack
    });
  }
});

// Nuevo endpoint: obtener ranking específico con más detalle
app.get('/api/rankings/:temporada/:piscina/:genero/:distancia/:estilo', async (req, res) => {
  try {
    const { temporada, piscina, genero, distancia, estilo } = req.params;
    
    // Construir URL específica si SwimSwam tiene ese patrón
    // Ejemplo: https://swimswam.com/ranking/2025-2026-lcm-men-100-free/
    const urlSlug = `${temporada}-${piscina}-${genero}-${distancia}-${estilo}`.toLowerCase();
    const url = `https://swimswam.com/ranking/${urlSlug}/`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    const $ = cheerio.load(response.data);

    const ranking = {
      temporada,
      piscina: piscina.toUpperCase(),
      genero: genero.charAt(0).toUpperCase() + genero.slice(1),
      distancia,
      estilo: estilo.toUpperCase(),
      nadadores: []
    };

    // Extraer tabla completa
    $('table tbody tr').each((idx, row) => {
      const $row = $(row);
      const celdas = $row.find('td');
      
      if (celdas.length >= 4) {
        ranking.nadadores.push({
          posicion: $(celdas[0]).text().trim().replace(/\D/g, ''),
          nombre: $(celdas[1]).text().trim(),
          pais: $(celdas[2]).text().trim(),
          tiempo: $(celdas[3]).text().trim(),
          fecha: celdas.length > 4 ? $(celdas[4]).text().trim() : '',
          club: celdas.length > 5 ? $(celdas[5]).text().trim() : ''
        });
      }
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      url: url,
      ranking: ranking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener ranking específico',
      mensaje: error.message
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 API de Web Scraping corriendo en http://localhost:${PORT}`);
  console.log(`📝 Endpoints disponibles:`);
  console.log(`   - GET http://localhost:${PORT}/`);
  console.log(`   - GET http://localhost:${PORT}/api/scrape?url=URL_AQUI`);
  console.log(`   - GET http://localhost:${PORT}/api/natacion`);
  console.log(`   - GET http://localhost:${PORT}/api/natacion/:id`);
  console.log(`   - GET http://localhost:${PORT}/api/natacion-nacional`);
  console.log(`   - GET http://localhost:${PORT}/api/rankings`);
  console.log(`   - GET http://localhost:${PORT}/api/rankings/:temporada/:piscina/:genero/:distancia/:estilo`);
});

