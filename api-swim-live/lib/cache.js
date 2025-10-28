const NodeCache = require('node-cache');

// Instancia compartida de cache para usar en las rutas
module.exports = new NodeCache({ stdTTL: 3600 });
