const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const cache = require("../../lib/cache");
const logger = require("../../lib/logger");
const { USER_AGENT } = require("../../lib/constants");
const { RankingEntry } = require("../models/ranking.model");

const DEFAULT_COMP_TTL = Number.parseInt(
  process.env.WORLD_AQUATICS_COMP_TTL || "3600",
  10
);

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

async function fetchCompetitionsList(options = {}) {
  const {
    group = "FINA",
    year = new Date().getFullYear(),
    month = "latest",
    discipline,
    disciplines,
    refresh = false,
    cacheTtl = DEFAULT_COMP_TTL,
  } = options;

  const disciplineParam = disciplines || discipline || "SW";

  const normalizedCacheKey = `world-aquatics-competitions-${group}-${year}-${month}-${disciplineParam}`;

  if (!refresh) {
    const cached = cache.get(normalizedCacheKey);
    if (cached) {
      logger.debug({ cacheKey: normalizedCacheKey }, "Competencias obtenidas desde caché");
      return cached;
    }
  }

  const query = new URLSearchParams({
    group: group || "",
    year: String(year || ""),
    month: month || "",
    disciplines: disciplineParam || "",
  });

  const requestUrl = `https://www.worldaquatics.com/results?${query.toString()}`;

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
      timeout: 120000,
    });

    // Intentar aceptar banner de cookies si aparece
    await page
      .evaluate(() => {
        const selectors = [
          '[data-cookie-accept]',
          '.cookie-banner__accept',
          '.js-accept-cookies',
          '.cookie-consent__accept',
        ];

        for (const selector of selectors) {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            return true;
          }
        }

        const fallback = Array.from(document.querySelectorAll("button"))
          .filter((btn) => btn && btn.textContent)
          .find((btn) => /accept|consent/i.test(btn.textContent));

        if (fallback) {
          fallback.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          return true;
        }

        return false;
      })
      .catch(() => false);

    await delay(3000);

    await page.waitForSelector(
      ".results-competition-listing__list .results-competition-listing__item",
      { timeout: 45000 }
    );

    const competitions = await page.evaluate(() => {
      const cleanText = (value) =>
        value && typeof value === "string"
          ? value.replace(/\s+/g, " ").trim()
          : null;

      const normalizeUrl = (href) => {
        if (!href) return null;
        try {
          const url = new URL(href, window.location.origin);
          return url.toString();
        } catch (_) {
          return href;
        }
      };

      const absolutize = (src) => {
        if (!src) return null;
        if (src.startsWith("//")) {
          return `${window.location.protocol}${src}`;
        }
        if (src.startsWith("/")) {
          return `${window.location.origin}${src}`;
        }
        return src;
      };

      const listing = document.querySelector(
        ".results-competition-listing"
      );
      if (!listing) return [];

      const results = [];

      const monthWrappers = listing.querySelectorAll(
        ".results-competition-listing__date-wrapper"
      );

      monthWrappers.forEach((monthWrapper) => {
        const monthNameNode = monthWrapper.childNodes?.[0] || null;
        const monthName = cleanText(monthNameNode?.textContent || "");
        const yearNode = monthWrapper.querySelector(
          ".results-competition-listing__year"
        );
        const yearText = cleanText(yearNode?.textContent || "");
        const monthNumberAttr = monthWrapper.getAttribute("data-month");
        const monthNumber = monthNumberAttr
          ? Number.parseInt(monthNumberAttr, 10)
          : null;

        let listElement = monthWrapper.nextElementSibling;
        while (listElement && listElement.tagName !== "OL") {
          listElement = listElement.nextElementSibling;
        }

        const items = listElement
          ? listElement.querySelectorAll(".results-competition-listing__item")
          : [];

        items.forEach((item) => {
          const anchor = item.querySelector("a.competition-item__link");
          if (!anchor) return;

          const dateText =
            cleanText(
              anchor.querySelector(
                ".competition-item__date.u-show-tablet"
              )?.textContent
            ) ||
            cleanText(
              anchor.querySelector(
                ".competition-item__date.u-hide-tablet"
              )?.textContent
            );

          const name = cleanText(
            anchor.querySelector(".competition-item__name")?.textContent || ""
          );
          const stage = cleanText(
            anchor.querySelector(".competition-item__stage")?.textContent || ""
          );

          const locationNode = anchor.querySelector(
            ".competition-item__location"
          );
          const locationText = cleanText(locationNode?.textContent || "");

          let city = null;
          let countryName = null;
          if (locationText) {
            const parts = locationText
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);

            if (parts.length === 1) {
              countryName = parts[0];
            } else if (parts.length === 2) {
              countryName = parts[0];
              city = parts[1];
            } else if (parts.length >= 3) {
              countryName = parts[1] || parts[0];
              city = parts.slice(2).join(", ") || null;
            }
          }

          const flagImg = anchor.querySelector(
            ".competition-item__flag img"
          );
          const countryCode = cleanText(flagImg?.getAttribute("alt") || "");
          const flagImage = absolutize(flagImg?.getAttribute("src") || "");

          const picture = anchor.querySelector(
            ".competition-item__logo picture"
          );
          let logo = null;
          if (picture) {
            const source = picture.querySelector("source[srcset]");
            if (source) {
              const srcset = source.getAttribute("srcset") || "";
              const candidates = srcset
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean);
              if (candidates.length) {
                const best = candidates[candidates.length - 1]
                  .split(" ")[0]
                  .trim();
                logo = absolutize(best);
              }
            }
            if (!logo) {
              const img = picture.querySelector("img");
              logo = absolutize(img?.getAttribute("src") || "");
            }
          }

          const poolName = cleanText(
            anchor.querySelector(".competition-item__pool")?.textContent || ""
          );

          const startDate = item.getAttribute("data-from") || null;
          const endDate = item.getAttribute("data-to") || null;

          results.push({
            name,
            stage: stage || null,
            date: dateText || null,
            startDate,
            endDate,
            poolName: poolName || null,
            city,
            countryName: countryName || null,
            countryCode: countryCode || null,
            flagImage: flagImage || null,
            logo: logo || null,
            url: normalizeUrl(anchor.getAttribute("href")),
            month: monthName || null,
            year: yearText || null,
            monthNumber: Number.isFinite(monthNumber) ? monthNumber : null,
            locationText,
          });
        });
      });

      return results;
    });

    const normalizeIso = (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    };

    const competitionsWithDates = competitions.map((item) => {
      const startDate = normalizeIso(item.startDate);
      let endDate = normalizeIso(item.endDate);

      if (!endDate && item.date && startDate) {
        const start = new Date(startDate);
        const rangeRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*-\s*(?:((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s*)?(\d{1,2})/i;
        const match = item.date.match(rangeRegex);
        if (match) {
          const [, startMonthName, , , endMonthName, endDay] = match;
          const endMonthIndex = endMonthName
            ? [
                "jan",
                "feb",
                "mar",
                "apr",
                "may",
                "jun",
                "jul",
                "aug",
                "sep",
                "oct",
                "nov",
                "dec",
              ].indexOf(endMonthName.toLowerCase().slice(0, 3))
            : start.getUTCMonth();

          if (endMonthIndex !== -1) {
            const derived = new Date(start);
            derived.setUTCMonth(endMonthIndex);
            derived.setUTCDate(Number.parseInt(endDay, 10));
            endDate = Number.isNaN(derived.getTime())
              ? null
              : derived.toISOString();
          }
        }
      }

      return {
        name: item.name || "",
        stage: item.stage,
        date: item.date,
        startDate,
        endDate,
        poolName: item.poolName,
        city: item.city,
        countryCode: item.countryCode,
        flagImage: item.flagImage,
        logo: item.logo,
        url: item.url,
        month: item.month,
        year: item.year,
        monthNumber: Number.isFinite(item.monthNumber)
          ? item.monthNumber
          : null,
      };
    });

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      url: requestUrl,
      params: {
        group,
        year,
        month,
        discipline: disciplineParam,
      },
      competitions: competitionsWithDates,
      total: competitionsWithDates.length,
    };

    if (cacheTtl > 0) {
      cache.set(normalizedCacheKey, response, cacheTtl);
    }

    return response;
  } catch (error) {
    logger.error(
      { err: error.message, url: requestUrl },
      "Error obteniendo listado de competiciones"
    );
    throw new Error(
      `No se pudieron obtener las competiciones solicitadas: ${error.message}`
    );
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

  const sanitizeSlugSegments = (rawSegments = []) => {
    const cleaned = rawSegments.filter(Boolean).map((segment) => segment.trim());
    if (cleaned.length) {
      const last = cleaned[cleaned.length - 1].toLowerCase();
      if (last === "results" || last === "results/") {
        cleaned.pop();
      }
    }
    return cleaned;
  };

  const idx = segments.indexOf("competitions");
  if (idx === -1) {
    const [competitionId, ...rest] = segments;
    const cleanedRest = sanitizeSlugSegments(rest);
    return {
      competitionId: competitionId || null,
      slug: cleanedRest.length ? cleanedRest.join("/") : null,
    };
  }

  const competitionId = segments[idx + 1] || null;
  const remaining = segments.slice(idx + 2);
  const cleanedRemaining = sanitizeSlugSegments(remaining);

  return {
    competitionId,
    slug: cleanedRemaining.length ? cleanedRemaining.join("/") : null,
  };
}

function buildCompetitionResultsUrl(parts, eventGuid = "") {
  const safeId = parts.competitionId || "95";
  const suffix = parts.slug ? `/${parts.slug}` : "";
  const eventParam = eventGuid
    ? `?event=${encodeURIComponent(eventGuid)}`
    : "";
  return `https://www.worldaquatics.com/competitions/${safeId}${suffix}/results${eventParam}`;
}

function buildCompetitionCacheKey(parts) {
  return `${parts.competitionId || "unknown"}-${(parts.slug || "default")
    .replace(/[^a-z0-9\-]+/gi, "_")
    .toLowerCase()}`;
}

module.exports = {
  fetchRankings,
  fetchCompetitionsList,
  fetchCompetitionEvents,
  fetchCompetitionEventResults,
};

