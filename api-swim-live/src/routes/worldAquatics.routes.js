const express = require('express');
const router = express.Router();
const worldController = require('../controllers/worldAquatics.controller');

router.get('/rankings', worldController.rankings);
router.get('/athletes', worldController.athletes);

module.exports = router;
