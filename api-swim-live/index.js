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
      ejemplo: '/api/scrape?url=https://live.swimrankings.net/'
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
    // Intentamos varios selectores posibles
    $('table tbody tr').each((index, element) => {
      const $row = $(element);
      const celdas = $row.find('td');
      
      if (celdas.length >= 4) {
        const competicion = {
          date: $(celdas[0]).text().trim(),
          course: $(celdas[1]).text().trim(),
          city: $(celdas[2]).text().trim(),
          name: $(celdas[3]).text().trim()
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
          competiciones.push({
            date: $(celdas[0]).text().trim(),
            course: $(celdas[1]).text().trim(),
            city: $(celdas[2]).text().trim(),
            name: $(celdas[3]).text().trim()
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

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 API de Web Scraping corriendo en http://localhost:${PORT}`);
  console.log(`📝 Endpoints disponibles:`);
  console.log(`   - GET http://localhost:${PORT}/`);
  console.log(`   - GET http://localhost:${PORT}/api/scrape?url=URL_AQUI`);
  console.log(`   - GET http://localhost:${PORT}/api/natacion`);
});

