const puppeteer = require('puppeteer');
const cache = require('../../lib/cache');
const { USER_AGENT } = require('../../lib/constants');

async function fetchRankings(params = {}) {
  let browser = null;
  try {
    const { gender = 'F', distance = '100', stroke = 'BACKSTROKE', poolConfiguration = 'LCM', year = 'all', startDate = '', endDate = '', timesMode = 'ALL_TIMES', regionId = 'all', countryId = '', limit = 100, clearCache = false } = params;
    const cacheKey = `rankings-${gender}-${distance}-${stroke}-${poolConfiguration}-${year}`;
    
    // Si se solicita limpiar caché, borrar todas las entradas relacionadas con estos filtros
    if (clearCache) {
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.startsWith(`rankings-${gender}-${distance}-${stroke}-${poolConfiguration}-${year}`)) {
          cache.del(key);
        }
      });
    }
    
    // Buscar datos en caché (sin límite en la clave)
    const cachedData = cache.get(cacheKey);
    let cachedLimit = 0;
    if (cachedData) {
      cachedLimit = cachedData.cachedLimit || cachedData.rankings?.length || 0;
      // Si el límite solicitado es menor o igual a lo que tenemos en caché, devolver slice
      if (limit <= cachedLimit) {
        return {
          ...cachedData,
          rankings: cachedData.rankings.slice(0, limit),
          total: limit,
          requestedLimit: limit,
          cachedLimit: cachedLimit
        };
      }
      // Si el límite es mayor que lo que tenemos en caché, necesitamos buscar más registros
      // Nota: Con Puppeteer, cuando hacemos scraping empezamos desde cero, así que 
      // haremos scraping completo pero solo necesitamos obtener hasta el nuevo límite
    }

    const url = `https://www.worldaquatics.com/swimming/rankings?gender=${gender}&distance=${distance}&stroke=${stroke}&poolConfiguration=${poolConfiguration}&year=${year}&startDate=${startDate}&endDate=${endDate}&timesMode=${timesMode}&regionId=${regionId}&countryId=${countryId}`;

    browser = await puppeteer.launch({ 
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    
    // Añadir timeout más largo y mejor manejo de errores
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    }).catch(err => {
      throw new Error(`Error navegando a la URL: ${err.message}`);
    });
    
    await new Promise(resolve => setTimeout(resolve, 8000));

    let clickCount = 0;
    // Buscar hasta el límite solicitado (o un poco más para tener margen)
    const neededLimit = Math.max(limit, cachedLimit); // Buscar al menos hasta el límite solicitado
    const maxClicks = Math.min(100, Math.ceil(neededLimit / 10)); // Aproximación: ~10 registros por click
    let previousCount = 0;
    let sameCountAttempts = 0;
    let errorCount = 0;
    const maxErrors = 3;

    while (clickCount < maxClicks && errorCount < maxErrors) {
      try {
        const currentCount = await page.evaluate(() => {
          const tabla = document.querySelector('table');
          if (!tabla) return 0;
          return tabla.querySelectorAll('tbody tr').length;
        });

        if (currentCount === previousCount) {
          sameCountAttempts++;
          if (sameCountAttempts >= 3) break;
        } else {
          sameCountAttempts = 0;
          previousCount = currentCount;
        }

        // Buscar el botón con múltiples selectores (intentar uno por uno)
        let showMoreBtn = await page.$('.js-show-more-button').catch(() => null);
        if (!showMoreBtn) showMoreBtn = await page.$('.load-more-button').catch(() => null);
        if (!showMoreBtn) showMoreBtn = await page.$('.show-more').catch(() => null);
        if (!showMoreBtn) {
          // Intentar buscar por texto del botón
          showMoreBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => 
              btn.textContent.toLowerCase().includes('more') || 
              btn.textContent.toLowerCase().includes('show')
            ) || null;
          }).catch(() => null);
        }
        
        if (showMoreBtn) {
          try {
            // Verificar que el elemento es visible y clickeable
            const isVisible = await showMoreBtn.evaluate(btn => {
              const style = window.getComputedStyle(btn);
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0' &&
                     !btn.disabled;
            });

            if (isVisible) {
              await showMoreBtn.evaluate(btn => btn.scrollIntoView({ behavior: 'smooth', block: 'center' }));
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Intentar hacer click de forma más robusta
              await Promise.race([
                showMoreBtn.click(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Click timeout')), 5000))
              ]).catch(async (err) => {
                // Si el click falla, intentar con JavaScript
                await page.evaluate((selector) => {
                  const btn = document.querySelector(selector);
                  if (btn && !btn.disabled) {
                    btn.click();
                  }
                }, '.js-show-more-button, .load-more-button').catch(() => {
                  throw new Error(`No se pudo hacer click en el botón: ${err.message}`);
                });
              });
              
              clickCount++;
              await new Promise(resolve => setTimeout(resolve, 4000));
              errorCount = 0; // Reset error count on success
            } else {
              // Botón no visible, intentar scroll
              await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
              await new Promise(resolve => setTimeout(resolve, 1500));
              clickCount++;
              sameCountAttempts++;
              if (sameCountAttempts >= 3) break;
            }
          } catch (clickError) {
            errorCount++;
            console.warn(`Error en click ${clickCount + 1}: ${clickError.message}`);
            // Intentar scroll como alternativa
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await new Promise(resolve => setTimeout(resolve, 1500));
            clickCount++;
            if (errorCount >= maxErrors) {
              console.warn('Demasiados errores en clicks, continuando con los datos disponibles');
              break;
            }
          }
        } else {
          // No hay botón, hacer scroll y verificar si hay más datos
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await new Promise(resolve => setTimeout(resolve, 1500));
          clickCount++;
          sameCountAttempts++;
          if (sameCountAttempts >= 3) break;
        }
      } catch (loopError) {
        errorCount++;
        console.warn(`Error en bucle de clicks: ${loopError.message}`);
        if (errorCount >= maxErrors) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    const datos = await page.evaluate(() => {
      const resultado = { filtros: {}, rankings: [] };
      resultado.filtros = {
        genero: document.querySelector('[name="gender"]')?.value || '',
        distancia: document.querySelector('[name="distance"]')?.value || '',
        estilo: document.querySelector('[name="stroke"]')?.value || '',
        piscina: document.querySelector('[name="poolConfiguration"]')?.value || ''
      };

      const tablas = document.querySelectorAll('table');
      let tablaRankings = null;
      tablas.forEach(tabla => {
        const headers = tabla.querySelectorAll('thead th, th');
        const headerTexts = Array.from(headers).map(h => h.textContent.trim());
        if (headerTexts.some(h => h.includes('Overall Rank') || (h.includes('Country') && headerTexts.some(t => t.includes('Name')) && headerTexts.some(t => t.includes('Time'))))) tablaRankings = tabla;
      });

      if (tablaRankings) {
        const filas = tablaRankings.querySelectorAll('tbody tr');
        filas.forEach((fila) => {
          const celdas = fila.querySelectorAll('td');
          if (celdas.length >= 3) { // Reducido a 3 mínimo para ser más flexible
            const nadador = {
              overallRank: celdas[0]?.textContent.trim() || '',
              country: celdas[1]?.textContent.trim() || '',
              name: celdas[2]?.textContent.trim() || '',
              age: celdas[3]?.textContent.trim() || '',
              time: celdas[4]?.textContent.trim() || '',
              points: celdas[5]?.textContent.trim() || '',
              tag: celdas[6]?.textContent.trim() || '',
              competition: celdas[7]?.textContent.trim() || '',
              location: celdas[8]?.textContent.trim() || '',
              date: celdas[9]?.textContent.trim() || ''
            };
            // Ser más flexible: solo requiere nombre o país
            if (nadador.name || nadador.country) resultado.rankings.push(nadador);
          }
        });
      }
      return resultado;
    });

    // Validar que tenemos datos
    if (!datos || !datos.rankings || datos.rankings.length === 0) {
      throw new Error('No se encontraron rankings en la página');
    }

    // NO aplicar slice aquí - guardamos TODOS los registros en caché
    const totalObtained = datos.rankings.length;
    const requestedLimitNum = parseInt(limit) || totalObtained;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url,
      fuente: 'World Aquatics Rankings (Puppeteer)',
      parametros: { gender, distance: `${distance}m`, stroke, poolConfiguration, year },
      total: totalObtained,
      clicksRealizados: clickCount,
      cachedLimit: totalObtained, // Guardar cuántos registros tenemos en caché
      ...datos // Incluye todos los rankings obtenidos
    };

    // Guardar en caché con TODOS los registros obtenidos (sin límite en la clave)
    cache.set(cacheKey, result);
    
    // Devolver solo los registros solicitados
    return {
      ...result,
      rankings: datos.rankings.slice(0, requestedLimitNum),
      total: Math.min(requestedLimitNum, totalObtained),
      requestedLimit: requestedLimitNum,
      cachedLimit: totalObtained
    };
  } catch (error) {
    console.error('Error en fetchRankings:', error);
    throw new Error(`Error al obtener rankings: ${error.message}`);
  } finally {
    // Asegurar que el browser se cierra siempre
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error cerrando browser:', closeError);
      }
    }
  }
}

async function fetchAthletes(params = {}) {
  const { gender = '', discipline = 'SW', nationality = '', name = '' } = params;
  const cacheKey = `athletes-${gender}-${discipline}-${nationality}-${name}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const url = `https://www.worldaquatics.com/swimming/athletes?gender=${gender}&discipline=${discipline}&nationality=${nationality}&name=${encodeURIComponent(name)}`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 6000));

  const atletas = await page.evaluate(() => {
    const resultado = [];
    const cards = document.querySelectorAll('.athlete-card, .athlete-list-card');
    cards.forEach(card => {
      const name = card.querySelector('.athlete-card__name, .athlete-list-card__name')?.textContent.trim() || '';
      const nationality = card.querySelector('.athlete-card__country, .athlete-list-card__country')?.textContent.trim() || '';
      const birth = card.querySelector('.athlete-card__birth, .athlete-list-card__birth')?.textContent.trim() || '';
      const profileUrl = card.querySelector('a')?.href || '';
      const imageUrl = card.querySelector('img')?.src || '';
      resultado.push({ name, nationality, birth, profileUrl, imageUrl });
    });
    return resultado;
  });

  await browser.close();
  const result = { success: true, timestamp: new Date().toISOString(), url, total: atletas.length, atletas };
  cache.set(cacheKey, result);
  return result;
}

module.exports = { fetchRankings, fetchAthletes };
