const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Habilitar CORS para todas las peticiones
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'API de Web Scraping',
    endpoints: {
      ejemplo: '/api/scrape?url=https://live.swimrankings.net/',
      natacion: '/api/natacion',
      competicion: '/api/natacion/:id'
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
    const url = 'https://live.swimrankings.net/';

    // Configurar headers para simular un navegador
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 API de Web Scraping corriendo en http://localhost:${PORT}`);
  console.log(`📝 Endpoints disponibles:`);
  console.log(`   - GET http://localhost:${PORT}/`);
  console.log(`   - GET http://localhost:${PORT}/api/scrape?url=URL_AQUI`);
  console.log(`   - GET http://localhost:${PORT}/api/natacion`);
  console.log(`   - GET http://localhost:${PORT}/api/natacion/:id (ej: /api/natacion/47807)`);
});

