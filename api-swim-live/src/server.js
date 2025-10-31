const app = require('./app');
const { PORT } = require('../lib/constants');

const PORTVAL = process.env.PORT || PORT || 3000;

app.listen(PORTVAL, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORTVAL}`);
  console.log(`📝 Endpoints:`);
  console.log(`   - GET /api/natacion`);
  console.log(`   - GET /api/natacion/:id`);
  console.log(`   - GET /api/world-aquatics/rankings`);
  console.log(`   - GET /api/world-aquatics/athletes`);
  console.log(`   - GET /api/scrape?url=...`);
});
