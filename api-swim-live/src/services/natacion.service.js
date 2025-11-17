const axios = require('axios');
const cheerio = require('cheerio');
const cache = require('../../lib/cache');
const { USER_AGENT } = require('../../lib/constants');
const logger = require('../../lib/logger');
const {
  CompetitionSummary,
  CompetitionDetail,
  EventItem,
  EventSchedule,
  PdfLink
} = require('../models/competition.model');

const BASE_HOST = 'https://live.swimrankings.net';
const DEFAULT_CACHE_TTL = Number.parseInt(process.env.NATACION_CACHE_TTL || '900', 10);
const DETAIL_CACHE_TTL = Number.parseInt(process.env.NATACION_DETAIL_CACHE_TTL || `${DEFAULT_CACHE_TTL}`, 10);
const HTTP_TIMEOUT = Number.parseInt(process.env.NATACION_HTTP_TIMEOUT || '15000', 10);

const client = axios.create({
  baseURL: BASE_HOST,
  timeout: HTTP_TIMEOUT,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  }
});

function createServiceError(message, statusCode, cause) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (cause) error.cause = cause;
  return error;
}

function buildAbsoluteUrl(href, base) {
  if (!href) return '';
  try {
    return new URL(href, base).href;
  } catch (err) {
    return '';
  }
}

function extractCompetitionLink(rawHref) {
  const href = buildAbsoluteUrl(rawHref, BASE_HOST);
  const match = (rawHref || '').match(/\/(\d{2,})/);
  const competitionId = match ? match[1] : '';
  return { href, competitionId };
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function toCacheMetadata(ttlSeconds) {
  const cachedAt = new Date();
  return {
    ttlSeconds,
    cachedAt: cachedAt.toISOString(),
    expiresAt: new Date(cachedAt.getTime() + ttlSeconds * 1000).toISOString()
  };
}

function cloneWithCacheHit(payload, hit) {
  return {
    ...payload,
    cacheHit: hit
  };
}

async function fetchHtml(path, traceId) {
  try {
    const response = await client.get(path, {
      headers: { 'User-Agent': USER_AGENT }
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status === 404 ? 404 : 502;
    logger.error({ err: error, traceId, path }, 'Fallo al descargar HTML desde SwimRankings');
    throw createServiceError('No se pudo obtener la información de natación', status, error);
  }
}

function parseCompetitionRows($, selector) {
  const items = [];
  $(selector).each((_, element) => {
    const $row = $(element);
    const cells = $row.find('td');
    if (cells.length < 4) return;

    const primaryLink = $row.find('a').first().attr('href');
    const fallbackLink = $(cells[3]).find('a').first().attr('href');
    const targetLink = primaryLink || fallbackLink || '';
    const { href, competitionId } = extractCompetitionLink(targetLink);

    const competition = CompetitionSummary.fromListing({
      id: competitionId,
      date: cleanText($(cells[0]).text()),
      course: cleanText($(cells[1]).text()),
      city: cleanText($(cells[2]).text()),
      name: cleanText($(cells[3]).text()),
      urlResultados: href || undefined,
      hasResults: Boolean(targetLink)
    });

    if (!competition.date && !competition.name) return;

    if (!competition.id && href) {
      const fallbackId = href.match(/\/(\d{2,})/);
      if (fallbackId) competition.id = fallbackId[1];
    }

    items.push(competition);
  });

  return items;
}

function mergeCompetitions(list) {
  const unique = new Map();
  list.forEach((item) => {
    const key = item.id || `${item.date}-${item.name}`;
    if (!unique.has(key)) unique.set(key, item);
  });
  return Array.from(unique.values());
}

function extractPdfLinks($, cell, baseUrl) {
  const links = [];
  $(cell).find('a[href$=".pdf"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href');
    const absoluteUrl = buildAbsoluteUrl(href, baseUrl);
    if (!absoluteUrl) return;

    const file = absoluteUrl.split('/').pop() || '';
    const typeMatch = file.match(/(StartList|Start|ResultList|Result|Results)/i);
    const indexMatch = file.match(/_(\d+)\.pdf$/i);

    links.push(new PdfLink({
      texto: cleanText($link.text()),
      url: absoluteUrl,
      file,
      tipo: typeMatch ? (typeMatch[1].toLowerCase().includes('start') ? 'salidas' : 'resultados') : undefined,
      index: indexMatch ? Number.parseInt(indexMatch[1], 10) : undefined
    }));
  });
  return links;
}

function parseCompetitionDetail($, id) {
  const baseUrl = `${BASE_HOST}/${id}/`;

  const infoCompeticion = {
    titulo: cleanText($('h1').first().text()),
    subtitulo: cleanText($('h2').first().text()),
    fecha: cleanText($('.date, [class*="date"]').first().text()),
    ciudad: cleanText($('.location, [class*="location"]').first().text())
  };

  const eventosPorEstilo = [];
  let estiloActual = null;

  $('table tbody tr').each((_, element) => {
    const $row = $(element);

    if ($row.hasClass('trTitle1')) return;

    if ($row.hasClass('trTitle2')) {
      const estilo = cleanText($row.find('td').eq(0).text());
      estiloActual = new EventSchedule({ estilo, masculino: [], femenino: [] });
      eventosPorEstilo.push(estiloActual);
      return;
    }

    const cells = $row.find('td');
    if (!estiloActual || cells.length < 11) return;

    const eventoMasc = new EventItem({
      distancia: cleanText($(cells[0]).text()),
      tipo: cleanText($(cells[1]).text()),
      categoria: cleanText($(cells[2]).text()),
      hora: cleanText($(cells[3]).text()),
      info: cleanText($(cells[4]).text()),
      pdfSalidas: extractPdfLinks($, cells[3], baseUrl),
      pdfResultados: extractPdfLinks($, cells[4], baseUrl)
    });

    const eventoFem = new EventItem({
      distancia: cleanText($(cells[6]).text()),
      tipo: cleanText($(cells[7]).text()),
      categoria: cleanText($(cells[8]).text()),
      hora: cleanText($(cells[9]).text()),
      info: cleanText($(cells[10]).text()),
      pdfSalidas: extractPdfLinks($, cells[9], baseUrl),
      pdfResultados: extractPdfLinks($, cells[10], baseUrl)
    });

    if (eventoMasc.distancia && eventoMasc.distancia !== '.........') estiloActual.masculino.push(eventoMasc);
    if (eventoFem.distancia && eventoFem.distancia !== '.........') estiloActual.femenino.push(eventoFem);
  });

  return new CompetitionDetail({ infoCompeticion, eventosPorEstilo });
}

async function fetchCompetitions(options = {}, traceId) {
  const { refresh = false, cacheTtl } = options;
  const cacheKey = 'competiciones';
  const ttlSeconds = Number.isFinite(cacheTtl) && cacheTtl > 0 ? cacheTtl : DEFAULT_CACHE_TTL;

  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug({ traceId }, 'Devolviendo competiciones desde caché');
      return cloneWithCacheHit(cached, true);
    }
  } else {
    cache.del(cacheKey);
    logger.debug({ traceId }, 'Caché de competiciones invalidada por petición');
  }

  const html = await fetchHtml('/', traceId);
  const $ = cheerio.load(html);

  const primary = parseCompetitionRows($, 'table tbody tr');
  const secondary = primary.length > 0 ? [] : parseCompetitionRows($, '.table tr, .results tr, [class*="result"] tr');
  const competiciones = mergeCompetitions([...primary, ...secondary]);
  const timestamp = new Date().toISOString();

  const payload = {
    success: true,
    timestamp,
    total: competiciones.length,
    competiciones,
    cache: {
      ...toCacheMetadata(ttlSeconds)
    },
    cacheHit: false
  };

  cache.set(cacheKey, payload, ttlSeconds);
  logger.info({ traceId, total: payload.total }, 'Competencias obtenidas desde origen');

  return payload;
}

async function fetchCompetitionById(id, traceId, options = {}) {
  const { refresh = false, cacheTtl } = options;
  const cacheKey = `competicion-${id}`;
  const ttlSeconds = Number.isFinite(cacheTtl) && cacheTtl > 0 ? cacheTtl : DETAIL_CACHE_TTL;

  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug({ traceId, id }, 'Detalle de competición desde caché');
      return cloneWithCacheHit(cached, true);
    }
  } else {
    cache.del(cacheKey);
    logger.debug({ traceId, id }, 'Caché de detalle invalidada por petición');
  }

  const path = `/${id}/`;
  const html = await fetchHtml(path, traceId);
  const $ = cheerio.load(html);

  const { infoCompeticion, eventosPorEstilo } = parseCompetitionDetail($, id);
  if (!infoCompeticion.titulo) {
    logger.warn({ traceId, id }, 'No se encontró el título de la competición');
  }

  const timestamp = new Date().toISOString();
  const payload = {
    success: true,
    timestamp,
    competicionId: id,
    url: `${BASE_HOST}/${id}/`,
    informacion: infoCompeticion,
    total: eventosPorEstilo.length,
    eventosPorEstilo,
    cache: {
      ...toCacheMetadata(ttlSeconds)
    },
    cacheHit: false
  };

  cache.set(cacheKey, payload, ttlSeconds);
  logger.info({ traceId, id, total: payload.total }, 'Detalle de competición obtenido desde origen');

  return payload;
}

module.exports = { fetchCompetitions, fetchCompetitionById };
