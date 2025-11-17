const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const cache = require("../../lib/cache");
const logger = require("../../lib/logger");
const { USER_AGENT } = require("../../lib/constants");
const { RankingEntry } = require("../models/ranking.model");

const delay = (ms = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
              console.log(`✓ Click ${clickCount} en "Show More" realizado`);
              
              // CRUCIAL: Esperar a que se rendericen las nuevas filas
              await new Promise((resolve) => setTimeout(resolve, 3000));
              
              // INMEDIATAMENTE hacer scroll por las filas nuevas para activar lazy loading
              console.log(`🔄 Haciendo scroll de las filas recién cargadas...`);
              await page.evaluate(async () => {
                const tabla = document.querySelector("table");
                if (tabla) {
                  const filas = tabla.querySelectorAll("tbody tr");
                  // Scroll rápido por TODAS las filas actuales
                  for (let i = 0; i < filas.length; i++) {
                    filas[i]?.scrollIntoView({ behavior: "auto", block: "center" });
                    // Solo 50ms por fila en esta pasada rápida
                    if (i % 5 === 0) {
                      await new Promise(r => setTimeout(r, 50));
                    }
                  }
                }
              });
              
              console.log(`✅ Scroll post-click completado, esperando carga...`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
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

    
    // Scroll FINAL más ligero (ya hicimos scroll después de cada "Show More")
    console.log("📸 Scroll final para asegurar carga de todas las imágenes...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Contar filas totales
    const totalFilas = await page.evaluate(() => {
      const tabla = document.querySelector("table");
      return tabla ? tabla.querySelectorAll("tbody tr").length : 0;
    });
    
    console.log(`🔄 Pasada final por ${totalFilas} filas...`);
    
    // Pasada FINAL más rápida (ya hicimos pre-scroll)
    await page.evaluate(async () => {
      const tabla = document.querySelector("table");
      if (!tabla) return;
      
      const filas = tabla.querySelectorAll("tbody tr");
      
      // Scroll moderado cada 2 filas con menos espera
      for (let i = 0; i < filas.length; i += 2) {
        filas[i]?.scrollIntoView({ 
          behavior: "auto", 
          block: "center"
        });
        
        // Menos espera: solo 100ms cada 2 filas
        await new Promise(r => setTimeout(r, 100));
        
        // Log cada 20 filas
        if (i % 20 === 0 && i > 0) {
          console.log(`  → ${i}/${filas.length} filas procesadas`);
        }
      }
      
      // Scroll final: arriba -> abajo
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 1000));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 1000));
    });
    
    console.log(`✅ Scroll final completado`);
    
    // Esperar AGRESIVAMENTE a que las imágenes se carguen
    console.log("⏳ Esperando carga de todas las imágenes...");
    
    // Espera inicial para que empiecen a cargar
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    try {
      await page.waitForFunction(() => {
        const images = document.querySelectorAll(
          "img.object-fit-cover-picture__img"
        );
        let loadedCount = 0;
        let totalImages = images.length;
        
        images.forEach((img) => {
          // Verificar si la imagen está cargada Y no es un placeholder
          const src = img.getAttribute("src") || img.src;
          const isLoaded = img.complete && img.naturalHeight > 0;
          const isReal = src && !src.includes("data:") && src.includes("resources.fina.org");
          
          if (isLoaded && isReal) {
            loadedCount++;
          }
        });
        
        const percentage = totalImages > 0 ? Math.round(loadedCount/totalImages*100) : 0;
        console.log(`📊 Imágenes: ${loadedCount}/${totalImages} (${percentage}%) cargadas`);
        
        // Umbral MUY bajo (30%) pero con más tiempo
        return loadedCount >= totalImages * 0.3 || totalImages === 0;
      }, { timeout: 30000 }); // Timeout aumentado a 30s
      
      console.log("✅ Suficientes imágenes cargadas, extrayendo datos...");
    } catch (error) {
      console.warn("⚠️ Timeout esperando imágenes - extrayendo lo que hay disponible");
    }
    
    // Espera adicional final para estabilidad
    await new Promise((resolve) => setTimeout(resolve, 5000));

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
        filas.forEach((fila, index) => {
          const celdas = fila.querySelectorAll("td");
          if (celdas.length >= 3) {
            // Extraer imagen del nadador - Búsqueda mejorada con múltiples fallbacks
            let imageUrl = "";
            let hasPhoto = false;
            
            // Buscar el contenedor del headshot
            const headshotWrapper = celdas[2]?.querySelector(".athlete-headshot");

            if (headshotWrapper) {
              // Verificar si tiene foto real o es avatar genérico
              const picture = headshotWrapper.querySelector("picture");
              
              if (picture) {
                hasPhoto = true;
                
                // Método 1: Buscar en <source srcset> (mejor calidad)
                const sourceElement = picture.querySelector("source[srcset]");
                if (sourceElement) {
                  const srcset = sourceElement.getAttribute("srcset") || "";
                  if (srcset) {
                    // Extraer URLs del srcset: "url1?width=80, url2?width=160 2x"
                    const srcsetUrls = srcset.split(",").map(s => s.trim());
                    
                    // Priorizar la URL de alta resolución (con "2x")
                    const highRes = srcsetUrls.find(s => s.includes("2x"));
                    if (highRes) {
                      imageUrl = highRes.split(" ")[0];
                    } else if (srcsetUrls[0]) {
                      imageUrl = srcsetUrls[0].split(" ")[0];
                    }
                  }
                }
                
                // Método 2: Si no hay srcset, buscar en <img src>
                if (!imageUrl) {
                  const imgElement = picture.querySelector("img.object-fit-cover-picture__img");
                  if (imgElement) {
                    imageUrl = imgElement.getAttribute("src") || imgElement.src || "";
                  }
                }
              }
            }
            
            // Normalizar URL si existe
            if (imageUrl && !imageUrl.startsWith("data:")) {
              // Convertir URLs relativas a absolutas
              if (imageUrl.startsWith("//")) {
                imageUrl = "https:" + imageUrl;
              } else if (imageUrl.startsWith("/")) {
                imageUrl = "https://www.worldaquatics.com" + imageUrl;
              }
              
              // Mejorar resolución: cambiar width=80 por width=160
              if (imageUrl.includes("?width=80")) {
                imageUrl = imageUrl.replace("?width=80", "?width=160");
              } else if (imageUrl.includes("?width=") && !imageUrl.includes("width=160")) {
                imageUrl = imageUrl.split("?")[0] + "?width=160";
              } else if (!imageUrl.includes("?width=")) {
                const separator = imageUrl.includes("?") ? "&" : "?";
                imageUrl = imageUrl + separator + "width=160";
              }
            } else {
              // Limpiar si es data: o vacío
              imageUrl = "";
            }

            // Extraer enlace al perfil del nadador
            let profileUrl = "";
            const linkElement = celdas[2]?.querySelector("a.rankings-table__person-link");
            if (linkElement) {
              const href = linkElement.getAttribute("href") || "";
              if (href) {
                profileUrl = href.startsWith("//") ? "https:" + href : 
                            href.startsWith("/") ? "https://www.worldaquatics.com" + href : href;
              }
            }

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
              imageUrl: imageUrl,
              profileUrl: profileUrl,
              hasPhoto: hasPhoto, // Indica si existe un headshot (aunque no se haya cargado)
              rowIndex: index,
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

    // Normalizar rankings a la capa de modelo
    const rankingEntries = (datos.rankings || []).map(
      (entry) =>
        RankingEntry.fromRaw({
          position: entry.overallRank,
          overallRank: entry.overallRank,
          athlete: entry.name,
          name: entry.name,
          country: entry.country,
          time: entry.time,
          points: entry.points,
          age: entry.age,
          reactionTime: entry.tag,
          competition: entry.competition,
          location: entry.location,
          date: entry.date,
          imageUrl: entry.imageUrl,
          profileUrl: entry.profileUrl,
          hasPhoto: entry.hasPhoto,
          extra: { tag: entry.tag }
        })
    );

    // Estadísticas detalladas
    const imagesCount = rankingEntries.filter(r => r.imageUrl && r.imageUrl.length > 0).length;
    const hasPhotoCount = rankingEntries.filter(r => r.hasPhoto).length;
    const percentage = Math.round(imagesCount/rankingEntries.length*100);
    
    console.log(`📊 Estadísticas de scraping:`);
    console.log(`   Total nadadores: ${rankingEntries.length}`);
    console.log(`   Con headshot disponible: ${hasPhotoCount} (${Math.round(hasPhotoCount/rankingEntries.length*100)}%)`);
    console.log(`   Imágenes extraídas: ${imagesCount} (${percentage}%)`);
    console.log(`   Avatares genéricos: ${rankingEntries.length - hasPhotoCount}`);

    // NO aplicar slice aquí - guardamos TODOS los registros en caché
    const totalObtained = rankingEntries.length;
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
    rankings: rankingEntries,
  };

    // Guardar en caché con TODOS los registros obtenidos (sin límite en la clave)
    cache.set(cacheKey, result);

    // Devolver solo los registros solicitados
    return {
      ...result,
      rankings: rankingEntries.slice(0, requestedLimitNum),
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

async function fetchCompetitionEvents(options = {}) {
  const { slug = "", url = "", refresh = false } = options;

  const parts = parseCompetitionPath(slug || url);
  if (!parts?.competitionId) {
    throw new Error("No se pudo determinar el identificador de la competición");
  }

  const requestUrl = buildCompetitionResultsUrl(parts);
  console.log("🌐 URL de competición:", requestUrl);
  
  const cacheKey = `world-aquatics-competition-events-${buildCompetitionCacheKey(parts)}`;
  
  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, "Eventos de competición obtenidos desde caché");
      return cached;
    }
  }

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
    
    console.log("📄 Navegando a la página...");
    await page.goto(requestUrl, {
      waitUntil: "networkidle2",
      timeout: 120000,
    });
    console.log("✅ Página cargada");

    // Esperar a que se renderice el contenido
    await delay(5000);

    // NUEVO: Expandir TODOS los eventos progresivamente
    console.log("🔄 Expandiendo eventos en la página...");
    const expandedCount = await page.evaluate(async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      let count = 0;
      
      // Buscar todos los botones de eventos colapsados
      const eventButtons = document.querySelectorAll('.results-table__event[data-expanded="false"]');
      
      for (const btn of eventButtons) {
        try {
          btn.scrollIntoView({ behavior: 'instant', block: 'center' });
          await delay(300);
          btn.click();
          await delay(800);
          count++;
        } catch (e) {
          console.error('Error expandiendo evento:', e);
        }
      }
      
      return count;
    });

    console.log(`✅ ${expandedCount} eventos expandidos`);
    await delay(2000);

    // CAMBIO: Extraer eventos con datos reales de la página
    const events = await page.evaluate(() => {
      const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
      const result = [];

      // ESTRATEGIA 1: Buscar .results-table__event (estructura de World Aquatics)
      const eventElements = document.querySelectorAll(".results-table__event");
      console.log(`📊 Encontrados ${eventElements.length} eventos con .results-table__event`);

      eventElements.forEach((el, index) => {
        try {
          // IMPORTANTE: Extraer el GUID real del atributo data-event-guid
          const eventGuid = el.getAttribute("data-event-guid");
          
          // Si no tiene GUID, saltar este evento
          if (!eventGuid) {
            console.warn(`⚠️ Evento ${index} sin data-event-guid`);
            return;
          }

          // Buscar título en el elemento padre más cercano
          const scheduleItem = el.closest(".schedule__item");
          
          let title = clean(
            scheduleItem?.querySelector(".schedule__item-title")?.textContent || ""
          );

          let subtitle = clean(
            scheduleItem?.querySelector(".schedule__item-subtitle")?.textContent || ""
          );

          // Extraer disciplina si está disponible
          let discipline = el.getAttribute("data-discipline") || "SW";

          // Extraer unidades (series) disponibles
          const unitButtons = scheduleItem?.querySelectorAll(".js-results-unit") || [];
          const units = Array.from(unitButtons).map((unitBtn, idx) => ({
            unitId: unitBtn.getAttribute("data-unit-id") || null,
            name: clean(unitBtn.getAttribute("data-unit-name") || 
                       unitBtn.querySelector(".unit-selector__unit-name")?.textContent || ""),
            status: clean(unitBtn.querySelector(".status-tag")?.textContent || ""),
            datetime: clean(unitBtn.querySelector(".unit-selector__unit-datetime")?.textContent || ""),
            isActive: unitBtn.classList.contains("is-active"),
            order: idx,
          }));

          if (title) {
            result.push({
              eventGuid,
              title,
              subtitle: subtitle || null,
              discipline,
              units: units.length > 0 ? units : null,
            });
            
            console.log(`✅ Evento ${index + 1}: ${title} (GUID: ${eventGuid})`);
          }
        } catch (err) {
          console.error(`❌ Error procesando evento ${index}:`, err.message);
        }
      });

      console.log(`📊 Total eventos extraídos: ${result.length}`);
      return result;
    });

    console.log("🎯 Eventos encontrados:", events.length);

    if (events.length === 0) {
      // Guardar HTML para debugging
      const htmlContent = await page.content();
      const fs = require('fs');
      const path = require('path');
      const debugDir = path.join(__dirname, '../../debug-screenshots');
      
      // Crear directorio si no existe
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const debugPath = path.join(debugDir, `debug-page-${Date.now()}.html`);
      fs.writeFileSync(debugPath, htmlContent);
      console.log(`💾 HTML guardado en: ${debugPath}`);
      
      throw new Error("No se encontraron eventos en la página de resultados");
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url: requestUrl,
      competition: {
        id: parts.competitionId,
        slug: parts.slug || null,
      },
      events,
      total: events.length,
    };

    cache.set(
      cacheKey,
      result,
      Number.parseInt(process.env.WORLD_AQUATICS_EVENTS_TTL || "3600", 10)
    );

    console.log("✅ Resultado guardado en caché");
    return result;

  } catch (error) {
    console.error("❌ Error en fetchCompetitionEvents:", error.message);
    logger.error(
      { err: error.message, url: requestUrl },
      "Error obteniendo eventos de competición"
    );
    throw new Error(
      `No se pudieron obtener los eventos solicitados: ${error.message}`
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

async function fetchCompetitionEventResults(options = {}) {
  const {
    slug = "",
    url = "",
    eventGuid = "",
    unitId = "",
    refresh = false,
  } = options;

  if (!eventGuid) {
    throw new Error("El parámetro eventGuid es obligatorio");
  }

  const parts = parseCompetitionPath(slug || url);
  if (!parts?.competitionId) {
    throw new Error("No se pudo determinar el identificador de la competición");
  }

  // 🔴 CAMBIO: Pasar eventGuid a buildCompetitionResultsUrl
  const requestUrl = buildCompetitionResultsUrl(parts, eventGuid);
  
  console.log("🌐 URL de petición:", requestUrl);
  
  const cacheKey = `world-aquatics-event-result-${buildCompetitionCacheKey(
    parts
  )}-${eventGuid}-${unitId || "active"}`;
  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, "Resultado de prueba desde caché");
      return cached;
    }
  }

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
    await page.goto(requestUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    const eventSelector = `.results-table__event[data-event-guid="${eventGuid}"]`;
    await page.waitForSelector(eventSelector, { timeout: 60000 });

    await page.evaluate((selector) => {
      const button = document.querySelector(selector);
      if (!button) return;
      button.scrollIntoView({ behavior: "instant", block: "center" });
      if (button.getAttribute("data-expanded") !== "true") {
        button.click();
      }
    }, eventSelector);

    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const item = el.closest(".schedule__item");
        if (!item) return false;
        return !!item.querySelector(".results-table__unit-selector-container");
      },
      { timeout: 60000 },
      eventSelector
    );

    if (unitId) {
      await page.evaluate(
        (selector, desiredUnit) => {
          const item = document.querySelector(selector)?.closest(
            ".schedule__item"
          );
          if (!item) return;
          const unitButton = Array.from(
            item.querySelectorAll(".js-results-unit")
          ).find(
            (unit) => unit.getAttribute("data-unit-id") === desiredUnit
          );
          if (unitButton) {
            unitButton.click();
          }
        },
        eventSelector,
        unitId
      );
      await delay(1200);
    }

    await page
      .waitForFunction(
        (selector) => {
          const item = document.querySelector(selector)?.closest(
            ".schedule__item"
          );
          if (!item) return false;
          const table = item.querySelector(
            ".results-table__table-container table"
          );
          return !!table && table.querySelectorAll("tbody tr").length > 0;
        },
        { timeout: 60000 },
        eventSelector
      )
      .catch(() => {});

    const data = await page.evaluate((selector) => {
      const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
      const item = document.querySelector(selector)?.closest(".schedule__item");
      if (!item) return null;

      const eventTitle =
        clean(
          item.querySelector(".schedule__item-title")?.textContent || ""
        ) || null;

      // ============= EXTRAER UNIDADES =============
      const units = Array.from(item.querySelectorAll(".js-results-unit")).map(
        (unitBtn, idx) => ({
          unitId: unitBtn.getAttribute("data-unit-id") || null,
          name:
            clean(
              unitBtn.getAttribute("data-unit-name") ||
                unitBtn.querySelector(".unit-selector__unit-name")?.textContent ||
                ""
            ) || null,
          status:
            clean(unitBtn.querySelector(".status-tag")?.textContent || "") ||
            null,
          datetime:
            clean(
              unitBtn.querySelector(".unit-selector__unit-datetime")?.textContent || ""
            ) || null,
          isActive: unitBtn.classList.contains("is-active"),
          order: idx,
        })
      );

      const selectedUnit = units.find((unit) => unit.isActive) || units[0] || null;

      const tableNode = item.querySelector(".results-table__table-container table");
      
      if (!tableNode) {
        console.log("❌ No se encontró tabla de resultados");
        return {
          eventTitle,
          units,
          selectedUnit,
          table: { headers: [], rows: [] },
        };
      }

      // ============= EXTRAER HEADERS =============
      const headerRow = tableNode.querySelector("thead tr:first-child");
      const allHeaders = headerRow 
        ? Array.from(headerRow.querySelectorAll("th")).map((th) => clean(th.textContent))
        : [];
      
      const mainHeaders = [];
      const seenHeaders = new Set();
      
      for (const header of allHeaders) {
        if (!header || header.match(/^(Distance|Split Time|Cumulative Time|Col \d+)$/i)) {
          continue;
        }
        
        const normalizedHeader = header.toLowerCase().trim();
        if (seenHeaders.has(normalizedHeader)) {
          continue;
        }
        
        seenHeaders.add(normalizedHeader);
        mainHeaders.push(header);
      }

      console.log("✅ Headers extraídos:", mainHeaders);

      // ============= EXTRAER FILAS DE NADADORES =============
      // Selector preciso: .results-table__row (contiene los datos del nadador)
      const athleteRows = Array.from(tableNode.querySelectorAll("tbody > tr.results-table__row"));
      console.log(`📊 Encontradas ${athleteRows.length} filas de nadadores`);

      const rows = [];

      athleteRows.forEach((athleteRow, athleteIdx) => {
        // ============= EXTRAER DATOS DEL NADADOR =============
        const cells = Array.from(athleteRow.querySelectorAll("td.results-table__cell"));
        
        const athleteData = [];

        cells.forEach((cell, cellIdx) => {
          // Saltar celdas especiales
          if (cell.classList.contains("results-table__cell--no-padding")) {
            return; // Botón de expansión, ignorar
          }

          let cellText = "";

          // 🔴 CELDA 0: Posición con medalla
          if (cellIdx === 0) {
            cellText = clean(cell.textContent); // "1"
          }
          // 🔴 CELDA 1: Calle (Lane)
          else if (cellIdx === 1) {
            cellText = clean(cell.textContent); // "1"
          }
          // 🔴 CELDA 2: País (Country)
          else if (cellIdx === 2) {
            const countryDiv = cell.querySelector(".results-table__country");
            cellText = clean(countryDiv?.textContent || ""); // "HKG"
          }
          // 🔴 CELDA 3: Nombre del atleta
          else if (cellIdx === 3) {
            const firstNameSpan = cell.querySelector(".results-table__athlete-first");
            const lastNameSpan = cell.querySelector(".results-table__athlete-last");
            const firstName = clean(firstNameSpan?.textContent || "");
            const lastName = clean(lastNameSpan?.textContent || "");
            cellText = `${firstName} ${lastName}`.trim(); // "Siobhan HAUGHEY"
          }
          // 🔴 CELDA 4: Edad (Age)
          else if (cellIdx === 4) {
            cellText = clean(cell.textContent); // "22"
          }
          // 🔴 CELDA 5: RT (Reaction Time)
          else if (cellIdx === 5) {
            cellText = clean(cell.textContent); // "0.71"
          }
          // 🔴 CELDA 6: Tiempo (Time)
          else if (cellIdx === 6) {
            cellText = clean(cell.textContent); // "53.33"
          }
          // 🔴 CELDA 7: Time Behind
          else if (cellIdx === 7) {
            cellText = clean(cell.textContent); // "-" o "+00.10"
          }
          // 🔴 CELDA 8: Puntos (Points)
          else if (cellIdx === 8) {
            cellText = clean(cell.textContent); // "911"
          }

          if (cellText) {
            athleteData.push(cellText);
          }
        });

        console.log(`   Nadador ${athleteIdx + 1}: ${athleteData.join(" | ")}`);

        // ============= EXTRAER SPLITS =============
        // Buscar la fila expandible siguiente
        const expandableRow = athleteRow.nextElementSibling;
        const splits = [];

        if (expandableRow && expandableRow.classList.contains("results-table__expandable")) {
          // Dentro hay una tabla con splits
          const splitTable = expandableRow.querySelector(".results-table__sub-table");
          
          if (splitTable) {
            const splitRows = Array.from(splitTable.querySelectorAll("tbody tr.results-table__sub-row"));
            
            splitRows.forEach((splitRow) => {
              const splitCells = Array.from(splitRow.querySelectorAll("td.results-table__sub-cell"));
              
              if (splitCells.length >= 3) {
                // Celda 0: Distancia (50m, 100m, etc.)
                const distanceDiv = splitCells[0].querySelector(".results-table__split");
                const distance = clean(distanceDiv?.textContent || "");
                
                // Celda 1: Split Time
                const splitTime = clean(splitCells[1].textContent || "");
                
                // Celda 2: Cumulative Time
                const cumulativeTime = clean(splitCells[2].textContent || "");

                if (distance && splitTime && cumulativeTime) {
                  splits.push({
                    distance,
                    splitTime,
                    cumulativeTime
                  });
                  console.log(`      Split: ${distance} | ${splitTime} | ${cumulativeTime}`);
                }
              }
            });
          }
        }

        // ============= CREAR OBJETO DE FILA =============
        rows.push({
          data: athleteData,
          splits: splits.length > 0 ? splits : [],
          hasSplits: splits.length > 0,
          expanded: false,
        });
      });

      console.log(`✅ ${rows.length} nadadores procesados`);

      return {
        success: true,
        eventTitle,
        units,
        selectedUnit,
        table: {
          headers: mainHeaders,
          rows,
        },
        stats: {
          totalAthletes: rows.length,
          athletesWithSplits: rows.filter(r => r.hasSplits).length,
          totalUnits: units.length,
        }
      };
    }, eventSelector);

    console.log("📦 Datos extraídos:", {
      eventTitle: data?.eventTitle,
      unitsCount: data?.units?.length || 0,
      headersCount: data?.table?.headers?.length || 0,
      rowsCount: data?.table?.rows?.length || 0,
    });

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      url: requestUrl,
      competition: {
        id: parts.competitionId,
        slug: parts.slug || null,
      },
      event: {
        eventGuid,
        title: data?.eventTitle || null,
      },
      units: data?.units || [],
      selectedUnit:
        (data?.units || []).find((unit) => unit.isActive) || null,
      table: data?.table || { headers: [], rows: [] },
    };

    cache.set(
      cacheKey,
      result,
      Number.parseInt(
        process.env.WORLD_AQUATICS_EVENT_RESULT_TTL || "900",
        10
      )
    );
    return result;
  } catch (error) {
    logger.error(
      { err: error.message, url: requestUrl, eventGuid },
      "Error obteniendo resultados de una prueba"
    );
    throw new Error(
      `No se pudieron obtener los resultados solicitados: ${error.message}`
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

function parseCompetitionPath(input = "") {
  if (!input) return null;
  let working = String(input).trim();
  if (!working) return null;

  const stripQuery = working.split("?")[0].split("#")[0];
  if (!stripQuery) return null;

  let path = stripQuery;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch (_) {
      path = stripQuery;
    }
  }

  const segments = path.split("/").filter(Boolean);
  const idx = segments.indexOf("competitions");
  if (idx === -1) {
    return {
      competitionId: segments[0] || null,
      slug: segments.slice(1).join("/") || null,
    };
  }

  const competitionId = segments[idx + 1] || null;
  const slug = segments.slice(idx + 2).join("/") || null;
  return { competitionId, slug };
}

function buildCompetitionResultsUrl(parts, eventGuid = "") {
  const safeId = parts.competitionId || "95";
  const suffix = parts.slug ? `/${parts.slug}` : "";
  const eventParam = eventGuid ? `?event=${eventGuid}` : "?disciplines=";
  return `https://www.worldaquatics.com/competitions/${safeId}${suffix}/results${eventParam}`;
}

function buildCompetitionCacheKey(parts) {
  return `${parts.competitionId || "unknown"}-${(parts.slug || "default")
    .replace(/[^a-z0-9\-]+/gi, "_")
    .toLowerCase()}`;
}

module.exports = {
  fetchRankings,
  fetchAthletes,
  fetchCompetitionsList,
  fetchCompetitionEvents,
  fetchCompetitionEventResults,
};

