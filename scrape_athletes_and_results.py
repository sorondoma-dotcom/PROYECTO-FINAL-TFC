import time
from datetime import datetime
from urllib.parse import urlencode, quote

from playwright.sync_api import sync_playwright
import mysql.connector

# =========================
# CONFIGURACIÓN
# =========================

DB_CONFIG = {
    "host": "localhost",
    "user": "liveSwim",
    "password": "1234",
    "database": "liveSwim",
    "charset": "utf8mb4",
}

BASE_ATHLETES_SEARCH_URL = "https://www.worldaquatics.com/athletes"
HEADLESS = True
SLEEP_BETWEEN_ATHLETES = 1.0  # segundos


# =========================
# BD HELPERS
# =========================

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def ensure_resultados_table_exists():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS resultados (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            athlete_id INT UNSIGNED NOT NULL,
            event VARCHAR(255) NOT NULL,
            time_text VARCHAR(32) NOT NULL,
            record_tags VARCHAR(50) NULL,
            medal VARCHAR(20) NULL,
            pool_length VARCHAR(10) NULL,
            age_at_result TINYINT UNSIGNED NULL,
            competition VARCHAR(255) NULL,
            comp_country_code CHAR(3) NULL,
            race_date DATE NULL,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (id),
            UNIQUE KEY uniq_result (
                athlete_id, event, time_text, race_date, competition
            ),
            CONSTRAINT fk_resultados_atleta
                FOREIGN KEY (athlete_id)
                REFERENCES atletas(athlete_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)
    conn.commit()
    cur.close()
    conn.close()


def fetch_all_atletas():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT athlete_id, athlete_name, image_url, athlete_profile_url
        FROM atletas
        WHERE athlete_id IS NOT NULL
        ORDER BY athlete_id;
    """)
    atletas = cur.fetchall()
    cur.close()
    conn.close()
    return atletas


def update_atleta_profile(athlete_id, image_url, profile_url):
    """
    Actualiza image_url y athlete_profile_url de un atleta.
    Solo pisa si están NULL o vacíos.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    sql = """
        UPDATE atletas
        SET
            image_url = IF(image_url IS NULL OR image_url = '', %s, image_url),
            athlete_profile_url = IF(athlete_profile_url IS NULL OR athlete_profile_url = '', %s, athlete_profile_url)
        WHERE athlete_id = %s;
    """
    cur.execute(sql, (image_url, profile_url, athlete_id))
    conn.commit()
    cur.close()
    conn.close()


def upsert_result_row(row: dict):
    conn = get_db_connection()
    cur = conn.cursor()
    sql = """
        INSERT INTO resultados (
            athlete_id,
            event,
            time_text,
            record_tags,
            medal,
            pool_length,
            age_at_result,
            competition,
            comp_country_code,
            race_date
        ) VALUES (
            %(athlete_id)s,
            %(event)s,
            %(time_text)s,
            %(record_tags)s,
            %(medal)s,
            %(pool_length)s,
            %(age_at_result)s,
            %(competition)s,
            %(comp_country_code)s,
            %(race_date)s
        )
        ON DUPLICATE KEY UPDATE
            record_tags = VALUES(record_tags),
            medal = VALUES(medal),
            pool_length = VALUES(pool_length),
            age_at_result = VALUES(age_at_result),
            competition = VALUES(competition),
            comp_country_code = VALUES(comp_country_code),
            race_date = VALUES(race_date);
    """
    cur.execute(sql, row)
    conn.commit()
    cur.close()
    conn.close()


# =========================
# UTILES DE PARSEO
# =========================

def parse_int(value: str):
    if value is None:
        return None
    v = value.strip()
    return int(v) if v.isdigit() else None


def parse_date_ddmmyyyy(value: str):
    """
    Convierte '25/11/2021' a date, si puede. Si no, devuelve None.
    """
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    try:
        return datetime.strptime(v, "%d/%m/%Y").date()
    except ValueError:
        return None


def normalize_url(url: str) -> str:
    if not url:
        return None
    url = url.strip()
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://www.worldaquatics.com" + url
    return url


# =========================
# SCRAPERS
# =========================

def build_athlete_search_url(name: str) -> str:
    # El parámetro es "name" en la query
    query = {
        "gender": "",
        "discipline": "SW",
        "nationality": "",
        "name": name
    }
    return f"{BASE_ATHLETES_SEARCH_URL}?{urlencode(query)}"


def find_athlete_in_search(page, athlete_id: int, athlete_name: str):
    """
    En la página de búsqueda de atletas, intenta encontrar la fila
    cuyo data-athlete-id coincide con athlete_id.
    Si no encuentra, como fallback devuelve la primera fila (o None).
    Devuelve (fila_locator, image_url, profile_url).
    """
    page.wait_for_selector("tbody.js-athletes-table-body", timeout=15000)
    rows = page.locator("tbody.js-athletes-table-body tr.athlete-table__row")
    count = rows.count()
    if count == 0:
        print(f"    [!] Sin resultados en búsqueda para {athlete_name}")
        return None, None, None

    target_row = None
    athlete_id_str = str(athlete_id) if athlete_id is not None else None

    for i in range(count):
        row = rows.nth(i)
        # data-link suele ser //www.worldaquatics.com/athletes/<id>/...
        data_link = row.get_attribute("data-link") or ""
        # Dentro del headshot también hay data-athlete-id
        headshot = row.locator(".athlete-headshot")
        row_athlete_id = None
        if headshot.count() > 0:
            row_athlete_id = headshot.first.get_attribute("data-athlete-id")

        if athlete_id_str and row_athlete_id == athlete_id_str:
            target_row = row
            break

    # Si no encontramos por athlete_id, cogemos la primera fila
    if target_row is None:
        print(f"    [!] No se encontró por athlete_id, usando primera fila para {athlete_name}")
        target_row = rows.first

    # Imagen
    img_url = None
    headshot = target_row.locator(".athlete-headshot img")
    if headshot.count() > 0:
        img_url = normalize_url(headshot.first.get_attribute("src"))

    # Perfil
    profile_url = None
    # data-link en la fila
    data_link = target_row.get_attribute("data-link")
    if data_link:
        profile_url = normalize_url(data_link)
    else:
        # fallback: enlace en la columna de CTA
        link = target_row.locator("a.athlete-table__cta-link")
        if link.count() > 0:
            profile_url = normalize_url(link.first.get_attribute("href"))

    return target_row, img_url, profile_url


def scrape_personal_best_results(page, athlete_id: int):
    """
    En la página de perfil del atleta (view profile),
    scrapea la tabla 'Personal Best Results' y devuelve una lista de dicts.
    """
    results = []
    # Buscar la sección best-results
    section = page.locator("section[data-widget='best-results']")
    if section.count() == 0:
        print("    [!] No hay sección de 'Personal Best Results'")
        return results

    rows = section.locator("tbody tr.athlete-table__row")
    total = rows.count()
    print(f"    [+] Filas de resultados personales: {total}")

    for i in range(total):
        row = rows.nth(i)
        cells = row.locator("td.athlete-table__cell")

        try:
            # Event
            event = cells.nth(0).inner_text().strip()

            # Time + record tags
            time_cell = cells.nth(1)
            time_strong = time_cell.locator("strong")
            time_text = time_strong.inner_text().strip() if time_strong.count() > 0 else time_cell.inner_text().strip()

            record_tags_loc = time_cell.locator(".athlete-table__records .athlete-table__record-tag")
            record_tags = []
            for j in range(record_tags_loc.count()):
                tag_txt = (record_tags_loc.nth(j).inner_text() or "").strip()
                if tag_txt:
                    record_tags.append(tag_txt)
            record_tags_str = ", ".join(record_tags) if record_tags else None

            # Medal
            medal_cell = cells.nth(2)
            medal = None
            sr = medal_cell.locator(".u-screen-reader")
            if sr.count() > 0:
                medal = (sr.first.inner_text() or "").strip()
            else:
                txt = medal_cell.inner_text().strip()
                if txt and txt != "-":
                    medal = txt

            # Pool Length
            pool_length = cells.nth(3).inner_text().strip() or None

            # Age*
            age_text = cells.nth(4).inner_text().strip()
            age_at_result = parse_int(age_text)

            # Competition
            competition = cells.nth(5).inner_text().strip() or None

            # Comp Country
            comp_country_cell = cells.nth(6)
            flag_img = comp_country_cell.locator("img.flag__img")
            comp_country_code = None
            if flag_img.count() > 0:
                comp_country_code = (flag_img.first.get_attribute("alt") or "").strip()
            else:
                txt = comp_country_cell.inner_text().strip()
                if txt and len(txt) <= 3:
                    comp_country_code = txt

            # Date
            date_text = cells.nth(7).inner_text().strip()
            race_date = parse_date_ddmmyyyy(date_text)

            result_row = {
                "athlete_id": athlete_id,
                "event": event,
                "time_text": time_text,
                "record_tags": record_tags_str,
                "medal": medal,
                "pool_length": pool_length,
                "age_at_result": age_at_result,
                "competition": competition,
                "comp_country_code": comp_country_code,
                "race_date": race_date,
            }
            results.append(result_row)

        except Exception as e:
            print(f"    [X] Error parseando fila de resultados personales {i+1}: {e}")

    return results


# =========================
# MAIN SCRAPER
# =========================

def process_atleta(page, atleta: dict):
    athlete_id = atleta["athlete_id"]
    athlete_name = atleta["athlete_name"]
    print(f"\n==============================")
    print(f"[*] Procesando atleta {athlete_id} - {athlete_name}")
    print(f"==============================")

    # 1) Buscar al atleta en la página de búsqueda
    search_url = build_athlete_search_url(athlete_name)
    print(f"    [*] URL búsqueda: {search_url}")
    page.goto(search_url, wait_until="networkidle", timeout=60000)

    try:
        row, img_url, profile_url = find_athlete_in_search(page, athlete_id, athlete_name)
    except Exception as e:
        print(f"    [X] Error buscando atleta {athlete_name}: {e}")
        return

    if row is None:
        print(f"    [!] No se encontró fila para atleta {athlete_name}")
        return

    print(f"    [+] Encontrado atleta en búsqueda. Img: {img_url}, Profile: {profile_url}")

    # 2) Actualizar tabla atletas con imagen y profile_url (solo si están vacíos)
    update_atleta_profile(athlete_id, img_url, profile_url)

    # Si no tenemos profile_url, no podemos seguir
    if not profile_url:
        print("    [!] Sin profile_url, no se puede scrapear resultados personales.")
        return

    # 3) Ir a "view profile" y scrapear Personal Best Results
    print(f"    [*] Accediendo a perfil: {profile_url}")
    page.goto(profile_url, wait_until="networkidle", timeout=60000)

    pb_results = scrape_personal_best_results(page, athlete_id)
    print(f"    [+] Resultados personales obtenidos: {len(pb_results)}")

    for r in pb_results:
        upsert_result_row(r)


def main():
    ensure_resultados_table_exists()
    atletas = fetch_all_atletas()
    print(f"[*] Atletas a procesar: {len(atletas)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        page = browser.new_page()

        for idx, atleta in enumerate(atletas, start=1):
            print(f"\n##### ({idx}/{len(atletas)}) #####")
            try:
                process_atleta(page, atleta)
            except Exception as e:
                print(f"[X] Error procesando atleta {atleta.get('athlete_name')} ({atleta.get('athlete_id')}): {e}")
            time.sleep(SLEEP_BETWEEN_ATHLETES)

        browser.close()

    print("\n[✓] Proceso completado.")


if __name__ == "__main__":
    main()
