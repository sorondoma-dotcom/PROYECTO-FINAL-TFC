const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { USER_AGENT } = require('../lib/constants');

const app = express();

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

// Mount organized routes
app.use('/api', routes);

module.exports = app;
