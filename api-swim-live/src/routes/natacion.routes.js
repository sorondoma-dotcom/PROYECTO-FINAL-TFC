const express = require('express');
const router = express.Router();
const natacionController = require('../controllers/natacion.controller');

router.get('/natacion', natacionController.list);
router.get('/natacion/:id', natacionController.detail);

module.exports = router;
