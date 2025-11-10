const express = require('express');
const router = express.Router();
const worldController = require('../controllers/worldAquatics.controller');

router.get('/rankings', worldController.rankings);
router.get('/athletes', worldController.athletes);
router.get('/competitions', worldController.competitions);
router.get('/competitions/results', worldController.competitionResults);
router.get('/competitions/results/event', worldController.competitionEventResult);

module.exports = router;
