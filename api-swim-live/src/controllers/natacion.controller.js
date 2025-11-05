const crypto = require('crypto');
const natacionService = require('../services/natacion.service');
const logger = require('../../lib/logger');

function createTraceId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function sendError(res, status, errorCode, message, traceId) {
  res.status(status).json({ success: false, errorCode, message, traceId });
}

function setCacheHeaders(res, result = {}) {
  if (typeof result.cacheHit === 'boolean') {
    res.setHeader('x-cache-hit', result.cacheHit ? '1' : '0');
  }
  if (result.cache?.cachedAt) res.setHeader('x-cache-cached-at', result.cache.cachedAt);
  if (result.cache?.expiresAt) res.setHeader('x-cache-expires-at', result.cache.expiresAt);
  if (result.cache?.ttlSeconds) res.setHeader('x-cache-ttl', String(result.cache.ttlSeconds));
}

function parseCacheOptions(query) {
  const refresh = query.refresh === 'true';
  const cacheTtl = Number.parseInt(query.cacheTtl, 10);
  return {
    refresh,
    cacheTtl: Number.isFinite(cacheTtl) && cacheTtl > 0 ? cacheTtl : undefined
  };
}

async function list(req, res) {
  const traceId = createTraceId();
  res.setHeader('x-trace-id', traceId);

  const options = parseCacheOptions(req.query || {});

  try {
    const result = await natacionService.fetchCompetitions(options, traceId);

    if (!result.success) {
      logger.warn({ traceId }, 'fetchCompetitions devolvió un resultado sin éxito');
      return sendError(res, 502, 'NATACION_UPSTREAM_ERROR', 'No se pudieron obtener las competiciones', traceId);
    }

    setCacheHeaders(res, result);

    if (result.total === 0) {
      logger.warn({ traceId }, 'No se encontraron competiciones');
      return res.status(204).send();
    }

    return res.json({ ...result, traceId });
  } catch (error) {
    logger.error({ err: error, traceId }, 'Error al obtener competiciones de natación');
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Error al obtener datos de natación' : error.message;
    return sendError(res, statusCode, 'NATACION_FETCH_ERROR', message, traceId);
  }
}

async function detail(req, res) {
  const traceId = createTraceId();
  res.setHeader('x-trace-id', traceId);

  const { id } = req.params;
  if (!id || !/^\d+$/.test(id)) {
    logger.warn({ traceId, id }, 'Parámetro id inválido');
    return sendError(res, 400, 'NATACION_BAD_REQUEST', 'El parámetro id debe ser numérico', traceId);
  }

  const options = parseCacheOptions(req.query || {});

  try {
    const result = await natacionService.fetchCompetitionById(id, traceId, options);

    if (!result) {
      return sendError(res, 404, 'NATACION_NOT_FOUND', `No se encontró la competición con id ${id}`, traceId);
    }

    if (!result.success) {
      logger.warn({ traceId, id }, 'fetchCompetitionById devolvió un resultado sin éxito');
      return sendError(res, 502, 'NATACION_UPSTREAM_ERROR', 'No se pudo obtener el detalle de la competición', traceId);
    }

    setCacheHeaders(res, result);

    if (result.total === 0) {
      logger.warn({ traceId, id }, 'Competición sin eventos asociados');
    }

    return res.json({ ...result, traceId });
  } catch (error) {
    logger.error({ err: error, traceId, id }, 'Error al obtener el detalle de una competición');
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Error al obtener resultados de la competición' : error.message;
    return sendError(res, statusCode, 'NATACION_DETAIL_ERROR', message, traceId);
  }
}

module.exports = { list, detail };
