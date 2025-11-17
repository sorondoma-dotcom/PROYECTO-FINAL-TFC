const express = require('express');
const router = express.Router();

const world = require('./worldAquatics.routes');
const scrape = require('./scrape.routes');

// Mount route modules

router.use('/world-aquatics', world);
router.use('/', scrape);

module.exports = router;
