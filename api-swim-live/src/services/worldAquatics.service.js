const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const cache = require("../../lib/cache");
const logger = require("../../lib/logger");
const { USER_AGENT } = require("../../lib/constants");

async function fetchRankings(params = {}) {
  let browser = null;
  try {
    const {
      gender = "F",
      distance = "100",
      stroke = "BACKSTROKE",
      poolConfiguration = "LCM",
      year = "all",
      startDate = "",
      endDate = "",
      timesMode = "ALL_TIMES",
      regionId = "all",
      countryId = "",
      limit = 100,
      clearCache = false,
    } = params;
    const cacheKey = `rankings-${gender}-${distance}-${stroke}-${poolConfiguration}-${year}`;

    // Si se solicita limpiar caché, borrar todas las entradas relacionadas con estos filtros
    if (clearCache) {
      const keys = cache.keys();
      keys.forEach((key) => {
        if (
          key.startsWith(
            `rankings-${gender}-${distance}-${stroke}-${poolConfiguration}-${year}`
          )
        ) {
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
          cachedLimit: cachedLimit,
        };
      }
      // Si el límite es mayor que lo que tenemos en caché, necesitamos buscar más registros
      // Nota: Con Puppeteer, cuando hacemos scraping empezamos desde cero, así que
      // haremos scraping completo pero solo necesitamos obtener hasta el nuevo límite
    }

    const url = `https://www.worldaquatics.com/swimming/rankings?gender=${gender}&distance=${distance}&stroke=${stroke}&poolConfiguration=${poolConfiguration}&year=${year}&startDate=${startDate}&endDate=${endDate}&timesMode=${timesMode}&regionId=${regionId}&countryId=${countryId}`;

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    // Añadir timeout más largo y mejor manejo de errores
    await page
      .goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      })
      .catch((err) => {
        throw new Error(`Error navegando a la URL: ${err.message}`);
      });

    await new Promise((resolve) => setTimeout(resolve, 8000));

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
          const tabla = document.querySelector("table");
          if (!tabla) return 0;
          return tabla.querySelectorAll("tbody tr").length;
        });

        if (currentCount === previousCount) {
          sameCountAttempts++;
          if (sameCountAttempts >= 3) break;
        } else {
          sameCountAttempts = 0;
          previousCount = currentCount;
        }

        // Buscar el botón con múltiples selectores (intentar uno por uno)
        let showMoreBtn = await page
          .$(".js-show-more-button")
          .catch(() => null);
        if (!showMoreBtn)
          showMoreBtn = await page.$(".load-more-button").catch(() => null);
        if (!showMoreBtn)
          showMoreBtn = await page.$(".show-more").catch(() => null);
        if (!showMoreBtn) {
          // Intentar buscar por texto del botón
          showMoreBtn = await page
            .evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll("button"));
              return (
                buttons.find(
                  (btn) =>
                    btn.textContent.toLowerCase().includes("more") ||
                    btn.textContent.toLowerCase().includes("show")
                ) || null
              );
            })
            .catch(() => null);
        }

        if (showMoreBtn) {
          try {
            // Verificar que el elemento es visible y clickeable
            const isVisible = await showMoreBtn.evaluate((btn) => {
              const style = window.getComputedStyle(btn);
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                !btn.disabled
              );
            });

            if (isVisible) {
              await showMoreBtn.evaluate((btn) =>
                btn.scrollIntoView({ behavior: "smooth", block: "center" })
              );
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Intentar hacer click de forma más robusta
              await Promise.race([
                showMoreBtn.click(),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("Click timeout")), 5000)
                ),
              ]).catch(async (err) => {
                // Si el click falla, intentar con JavaScript
                await page
                  .evaluate((selector) => {
                    const btn = document.querySelector(selector);
                    if (btn && !btn.disabled) {
                      btn.click();
                    }
                  }, ".js-show-more-button, .load-more-button")
                  .catch(() => {
                    throw new Error(
                      `No se pudo hacer click en el botón: ${err.message}`
                    );
                  });
              });

              clickCount++;
              await new Promise((resolve) => setTimeout(resolve, 4000));
              errorCount = 0; // Reset error count on success
            } else {
              // Botón no visible, intentar scroll
              await page.evaluate(
                "window.scrollTo(0, document.body.scrollHeight)"
              );
              await new Promise((resolve) => setTimeout(resolve, 1500));
              clickCount++;
              sameCountAttempts++;
              if (sameCountAttempts >= 3) break;
            }
          } catch (clickError) {
            errorCount++;
            console.warn(
              `Error en click ${clickCount + 1}: ${clickError.message}`
            );
            // Intentar scroll como alternativa
            await page.evaluate(
              "window.scrollTo(0, document.body.scrollHeight)"
            );
            await new Promise((resolve) => setTimeout(resolve, 1500));
            clickCount++;
            if (errorCount >= maxErrors) {
              console.warn(
                "Demasiados errores en clicks, continuando con los datos disponibles"
              );
              break;
            }
          }
        } else {
          // No hay botón, hacer scroll y verificar si hay más datos
          await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
          await new Promise((resolve) => setTimeout(resolve, 1500));
          clickCount++;
          sameCountAttempts++;
          if (sameCountAttempts >= 3) break;
        }
      } catch (loopError) {
        errorCount++;
        console.warn(`Error en bucle de clicks: ${loopError.message}`);
        if (errorCount >= maxErrors) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const datos = await page.evaluate(() => {
      const resultado = { filtros: {}, rankings: [] };
      resultado.filtros = {
        genero: document.querySelector('[name="gender"]')?.value || "",
        distancia: document.querySelector('[name="distance"]')?.value || "",
        estilo: document.querySelector('[name="stroke"]')?.value || "",
        piscina:
          document.querySelector('[name="poolConfiguration"]')?.value || "",
      };

      const tablas = document.querySelectorAll("table");
      let tablaRankings = null;
      tablas.forEach((tabla) => {
        const headers = tabla.querySelectorAll("thead th, th");
        const headerTexts = Array.from(headers).map((h) =>
          h.textContent.trim()
        );
        if (
          headerTexts.some(
            (h) =>
              h.includes("Overall Rank") ||
              (h.includes("Country") &&
                headerTexts.some((t) => t.includes("Name")) &&
                headerTexts.some((t) => t.includes("Time")))
          )
        )
          tablaRankings = tabla;
      });

      if (tablaRankings) {
        const filas = tablaRankings.querySelectorAll("tbody tr");
        filas.forEach((fila) => {
          const celdas = fila.querySelectorAll("td");
          if (celdas.length >= 3) {
            // Reducido a 3 mínimo para ser más flexible
            const nadador = {
              overallRank: celdas[0]?.textContent.trim() || "",
              country: celdas[1]?.textContent.trim() || "",
              name: celdas[2]?.textContent.trim() || "",
              age: celdas[3]?.textContent.trim() || "",
              time: celdas[4]?.textContent.trim() || "",
              points: celdas[5]?.textContent.trim() || "",
              tag: celdas[6]?.textContent.trim() || "",
              competition: celdas[7]?.textContent.trim() || "",
              location: celdas[8]?.textContent.trim() || "",
              date: celdas[9]?.textContent.trim() || "",
            };
            // Ser más flexible: solo requiere nombre o país
            if (nadador.name || nadador.country)
              resultado.rankings.push(nadador);
          }
        });
      }
      return resultado;
    });

    // Validar que tenemos datos
    if (!datos || !datos.rankings || datos.rankings.length === 0) {
      throw new Error("No se encontraron rankings en la página");
    }

    // NO aplicar slice aquí - guardamos TODOS los registros en caché
    const totalObtained = datos.rankings.length;
    const requestedLimitNum = parseInt(limit) || totalObtained;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url,
      fuente: "World Aquatics Rankings (Puppeteer)",
      parametros: {
        gender,
        distance: `${distance}m`,
        stroke,
        poolConfiguration,
        year,
      },
      total: totalObtained,
      clicksRealizados: clickCount,
      cachedLimit: totalObtained, // Guardar cuántos registros tenemos en caché
      ...datos, // Incluye todos los rankings obtenidos
    };

    // Guardar en caché con TODOS los registros obtenidos (sin límite en la clave)
    cache.set(cacheKey, result);

    // Devolver solo los registros solicitados
    return {
      ...result,
      rankings: datos.rankings.slice(0, requestedLimitNum),
      total: Math.min(requestedLimitNum, totalObtained),
      requestedLimit: requestedLimitNum,
      cachedLimit: totalObtained,
    };
  } catch (error) {
    console.error("Error en fetchRankings:", error);
    throw new Error(`Error al obtener rankings: ${error.message}`);
  } finally {
    // Asegurar que el browser se cierra siempre
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error cerrando browser:", closeError);
      }
    }
  }
}

async function fetchAthletes(params = {}) {
  const {
    gender = "",
    discipline = "SW",
    nationality = "",
    name = "",
  } = params;
  const cacheKey = `athletes-${gender}-${discipline}-${nationality}-${name}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const url = `https://www.worldaquatics.com/swimming/athletes?gender=${gender}&discipline=${discipline}&nationality=${nationality}&name=${encodeURIComponent(
    name
  )}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 6000));

  const atletas = await page.evaluate(() => {
    const resultado = [];
    const cards = document.querySelectorAll(
      ".athlete-card, .athlete-list-card"
    );
    cards.forEach((card) => {
      const name =
        card
          .querySelector(".athlete-card__name, .athlete-list-card__name")
          ?.textContent.trim() || "";
      const nationality =
        card
          .querySelector(".athlete-card__country, .athlete-list-card__country")
          ?.textContent.trim() || "";
      const birth =
        card
          .querySelector(".athlete-card__birth, .athlete-list-card__birth")
          ?.textContent.trim() || "";
      const profileUrl = card.querySelector("a")?.href || "";
      const imageUrl = card.querySelector("img")?.src || "";
      resultado.push({ name, nationality, birth, profileUrl, imageUrl });
    });
    return resultado;
  });

  await browser.close();
  const result = {
    success: true,
    timestamp: new Date().toISOString(),
    url,
    total: atletas.length,
    atletas,
  };
  cache.set(cacheKey, result);
  return result;
}

function resolveWorldAquaticsUrl(raw = "") {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://www.worldaquatics.com${
    raw.startsWith("/") ? raw : `/${raw}`
  }`;
}

function sanitizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function parseLocationText(text) {
  const clean = sanitizeText(text);
  if (!clean) return { countryCode: null, city: null, poolName: null };
  const parts = clean
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const [countryCode = null, city = null, ...rest] = parts;
  const poolName = rest.length > 0 ? rest.join(", ") : city;
  return { countryCode, city, poolName };
}

function extractMonthInfo($header) {
  if (!$header || $header.length === 0) {
    return { month: null, year: null, monthNumber: null };
  }

  const monthNumber = $header.attr("data-month") || null;
  const yearLabel = sanitizeText(
    $header.find(".competition-calendar__year").text()
  );

  const $clone = $header.clone();
  $clone.find(".competition-calendar__year").remove();
  const monthLabel = sanitizeText($clone.text());

  return {
    month: monthLabel || null,
    year: yearLabel || null,
    monthNumber: monthNumber ? Number.parseInt(monthNumber, 10) : null,
  };
}

async function fetchCompetitionsList(params = {}) {
  const {
    group = "FINA",
    year = new Date().getFullYear(),
    month = "latest",
    discipline = "SW",
    cacheTtl = Number.parseInt(
      process.env.WORLD_AQUATICS_COMP_TTL || "3600",
      10
    ),
    refresh = false,
  } = params;

  const cacheKey = `world-aquatics-competitions-${group}-${year}-${month}-${discipline}`;
  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, "Competencias de World Aquatics desde cache");
      return cached;
    }
  } else {
    cache.del(cacheKey);
  }

  const url = `https://www.worldaquatics.com/competitions?group=${encodeURIComponent(
    group
  )}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(
    month
  )}&disciplines=${encodeURIComponent(discipline)}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    // Acepta cookies si aparece el banner (no siempre sale, por eso try/catch)
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Intento rápido de cerrar banner de cookies (clases pueden variar con el tiempo)
    try {
      await page.waitForSelector(
        'button[aria-label*="Accept"],button:has-text("Accept")',
        { timeout: 3000 }
      );
      const btns = await page.$$('button[aria-label*="Accept"],button');
      for (const b of btns) {
        const txt = (
          await page.evaluate((el) => el.textContent || "", b)
        ).toLowerCase();
        if (txt.includes("accept")) {
          await b.click();
          break;
        }
      }
    } catch (_) {}

    // Espera a que el frontend pinte la lista (al menos un item)
    await page.waitForFunction(
      () => {
        const listing = document.querySelector(
          ".competition-calendar__listing"
        );
        const items = listing
          ? listing.querySelectorAll(
              ".competition-calendar__item a.competition-item__link"
            ).length
          : 0;
        return items > 0;
      },
      { timeout: 20000 }
    );

    // (Opcional) pulsa “Show More” unas cuantas veces por si hay paginación infinita
    // (Opcional) pulsa “Show More” unas cuantas veces por si hay paginación infinita
    for (let i = 0; i < 5; i++) {
      // 1) Intento por clase conocida
      let btn = await page.$(
        ".js-show-more-button, .load-more-button, .show-more"
      );

      // 2) Si no lo encontramos por clases, probamos por texto:
      if (!btn) {
        // a) XPath por texto en button o a
        const xBtns = await page.$x(
          `//button[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show more')
                or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load more')
                or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'ver más')
                or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'ver mas')]
        | //a[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show more')
             or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load more')
             or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'ver más')
             or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'ver mas')]`
        );
        if (xBtns && xBtns.length) btn = xBtns[0];

        // b) Como último recurso, filtramos todos los botones/links por texto
        if (!btn) {
          const candidates = await page.$$('button, a, .btn, [role="button"]');
          for (const c of candidates) {
            const txt = (
              await page.evaluate(
                (el) => (el.textContent || "").toLowerCase(),
                c
              )
            ).trim();
            if (
              txt.includes("show more") ||
              txt.includes("load more") ||
              txt.includes("ver más") ||
              txt.includes("ver mas")
            ) {
              btn = c;
              break;
            }
          }
        }
      }

      if (!btn) break;

      // Comprobamos visibilidad/habilitado
      const visible = await page.evaluate((el) => {
        const s = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const inViewport = rect.width > 0 && rect.height > 0;
        return (
          inViewport &&
          s.display !== "none" &&
          s.visibility !== "hidden" &&
          !el.disabled
        );
      }, btn);
      if (!visible) break;

      await btn.evaluate((el) =>
        el.scrollIntoView({ behavior: "instant", block: "center" })
      );
      await btn.click().catch(() => {});
      await page.waitForTimeout(1500);

      // Si ya no aparecen más items nuevos, rompemos
      const hadMore = await page.evaluate(() => {
        const listing = document.querySelector(
          ".competition-calendar__listing"
        );
        if (!listing) return false;
        // Heurística: si ya hay 100+ items, probablemente no haya más
        return (
          listing.querySelectorAll(".competition-calendar__item").length < 1000
        );
      });
      if (!hadMore) break;
    }

    const competitions = await page.evaluate(() => {
      const sanitize = (v) => (v || "").replace(/\s+/g, " ").trim();
      const resolve = (raw) => {
        if (!raw) return null;
        if (raw.startsWith("http")) return raw;
        if (raw.startsWith("//")) return `https:${raw}`;
        return `https://www.worldaquatics.com${
          raw.startsWith("/") ? raw : `/${raw}`
        }`;
      };
      const parseLoc = (text) => {
        const clean = sanitize(text);
        if (!clean) return { countryCode: null, city: null, poolName: null };
        const parts = clean
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        const [countryCode = null, city = null, ...rest] = parts;
        const poolName = rest.length > 0 ? rest.join(", ") : city;
        return { countryCode, city, poolName };
      };
      const extractMonthInfo = ($header) => {
        if (!$header) return { month: null, year: null, monthNumber: null };
        const monthNumber = $header.getAttribute("data-month") || null;
        const yearEl = $header.querySelector(".competition-calendar__year");
        const yearLabel = sanitize(yearEl ? yearEl.textContent : "");
        const clone = $header.cloneNode(true);
        if (clone.querySelector(".competition-calendar__year"))
          clone.querySelector(".competition-calendar__year").remove();
        const monthLabel = sanitize(clone.textContent);
        return {
          month: monthLabel || null,
          year: yearLabel || null,
          monthNumber: monthNumber ? parseInt(monthNumber, 10) : null,
        };
      };

      const out = [];
      const listing = document.querySelector(".competition-calendar__listing");
      if (!listing) return out;

      // Recorre cada item
      const items = listing.querySelectorAll(".competition-calendar__item");
      items.forEach((item, idx) => {
        const link = item.querySelector("a.competition-item__link");
        if (!link) return;

        // Header más cercano hacia arriba para mes/año
        let header = item.previousElementSibling;
        while (
          header &&
          !header.classList.contains("competition-calendar__date-wrapper")
        ) {
          header = header.previousElementSibling;
        }
        const monthInfo = extractMonthInfo(header);

        const name = sanitize(
          (link.querySelector(".competition-item__name") || {}).textContent
        );
        if (!name) return;

        const dateText = sanitize(
          (link.querySelector(".competition-item__date") || {}).textContent
        );
        const startDateIso = item.getAttribute("data-from") || null;
        const endDateIso = item.getAttribute("data-to") || null;

        const locNode = link.querySelector(".competition-item__location");
        const locationText = locNode ? locNode.textContent : "";
        const { countryCode, city, poolName } = parseLoc(locationText);
        const flagImage = locNode
          ? resolve(
              (locNode.querySelector("img.flag__img") || {}).getAttribute?.(
                "src"
              )
            )
          : null;

        const logo = resolve(
          (
            link.querySelector(".competition-item__logo img") || {}
          ).getAttribute?.("src") || null
        );
        const stage = sanitize(
          (link.querySelector(".competition-item__stage") || {}).textContent
        );
        const href = resolve(link.getAttribute("href"));

        out.push({
          name,
          stage: stage || null,
          date: dateText || null,
          startDate: startDateIso,
          endDate: endDateIso,
          poolName: poolName || null,
          city: city || null,
          countryCode: countryCode || null,
          flagImage: flagImage || null,
          logo: logo || null,
          url: href,
          month: monthInfo.month,
          year: monthInfo.year,
          monthNumber: monthInfo.monthNumber,
          index: idx,
        });
      });
      return out;
    });

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url,
      filters: { group, year, month, discipline },
      total: competitions.length,
      competitions,
    };

    cache.set(cacheKey, result, cacheTtl);
    if (!competitions || competitions.length === 0) {
      logger.warn(
        { url },
        "No se extrajeron competiciones de World Aquatics (DOM vacío tras render)"
      );
    } else {
      logger.info(
        { total: competitions.length, url },
        "Competiciones obtenidas de World Aquatics (Puppeteer)"
      );
    }
    return result;
  } catch (err) {
    logger.error({ err: err.message, url }, "Error obteniendo competiciones");
    throw new Error(`Error al obtener competiciones: ${err.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

module.exports = { fetchRankings, fetchAthletes, fetchCompetitionsList };
