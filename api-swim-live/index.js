const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { PORT, USER_AGENT } = require('./lib/constants');
const cache = require('./lib/cache');
const natacionRoutes = require('./routes/natacion');
const worldRoutes = require('./routes/worldAquatics');
const scrapeRoutes = require('./routes/scrape');

const app = express();
const PORTVAL = PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones, por favor intenta más tarde'
});

app.use(cors());
app.use(express.json());
app.use('/api/', limiter);

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

// Routers
app.use('/api', natacionRoutes);
app.use('/api/world-aquatics', worldRoutes);
app.use('/api', scrapeRoutes);

app.listen(PORTVAL, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORTVAL}`);
  console.log(`📝 Endpoints:`);
  console.log(`   - GET /api/natacion`);
  console.log(`   - GET /api/natacion/:id`);
  console.log(`   - GET /api/world-aquatics/rankings`);
  console.log(`   - GET /api/world-aquatics/athletes`);
  console.log(`   - GET /api/scrape?url=...`);
});