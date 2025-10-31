const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrape.controller');

router.get('/scrape', scrapeController.scrape);

module.exports = router;
