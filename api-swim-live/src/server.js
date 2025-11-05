const app = require('./app');
const { PORT } = require('../lib/constants');
const logger = require('../lib/logger');

const port = Number(process.env.PORT || PORT || 3000);

app.listen(port, () => {
  logger.info({ port }, 'API corriendo');
  logger.info({
    endpoints: [
      'GET /api/natacion',
      'GET /api/natacion/:id',
      'GET /api/world-aquatics/rankings',
      'GET /api/world-aquatics/athletes',
      'GET /api/scrape?url=...'
    ]
  }, 'Endpoints disponibles');
});
