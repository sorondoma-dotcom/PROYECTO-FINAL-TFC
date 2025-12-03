import time
from datetime import datetime
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright
import mysql.connector


DB_CONFIG = {
    "host": "localhost",
    "user": "liveSwim",
    "password": "1234",
    "database": "liveSwim",
    "charset": "utf8mb4",
}

BASE_RANKINGS_URL = "https://www.worldaquatics.com/swimming/rankings"

RANKING_PARAMS = {
    "gender": "M",               # "M" o "F"
    "distance": 50,              # 50, 100, 200, 400, 800, 1500
    "stroke": "FREESTYLE",       # FREESTYLE, BACKSTROKE, BREASTSTROKE, BUTTERFLY, MEDLEY
    "poolConfiguration": "SCM",  # LCM o SCM
    "year": "all",               # "all" o año concreto
    "startDate": "",
    "endDate": "",
    "timesMode": "ALL_TIMES",
    "regionId": "all",
    "countryId": "",             # todos los países
}

SLEEP_AFTER_SHOW_MORE = 2.0   # segundos
HEADLESS = True               # pon False si quieres ver el navegador



VALID_COMBOS = {
    50: {"FREESTYLE", "BACKSTROKE", "BREASTSTROKE", "BUTTERFLY"},
    100: {"FREESTYLE", "BACKSTROKE", "BREASTSTROKE", "BUTTERFLY"},
    200: {"FREESTYLE", "BACKSTROKE", "BREASTSTROKE", "BUTTERFLY", "MEDLEY"},
    400: {"FREESTYLE", "MEDLEY"},
    800: {"FREESTYLE"},
    1500: {"FREESTYLE"},
}

def generate_all_param_sets():
    genders = ["M", "F"]
    pool_configurations = ["SCM"]  # si quieres también LCM: ["LCM", "SCM"]

    for gender in genders:
        for pool_conf in pool_configurations:
            for distance, strokes in VALID_COMBOS.items():
                for stroke in strokes:
                    params = RANKING_PARAMS.copy()
                    params["gender"] = gender
                    params["distance"] = distance
                    params["stroke"] = stroke
                    params["poolConfiguration"] = pool_conf
                    yield params


def validate_params(params: dict):
    gender = params["gender"]
    distance = int(params["distance"])
    stroke = params["stroke"].upper()

    if gender not in ("M", "F"):
        raise ValueError("gender debe ser 'M' o 'F'")

    if distance not in VALID_COMBOS:
        raise ValueError(f"distance {distance} no es válido")

    if stroke not in VALID_COMBOS[distance]:
        raise ValueError(
            f"stroke {stroke} no es válido para distance {distance}. "
            f"Válidos: {', '.join(sorted(VALID_COMBOS[distance]))}"
        )


def build_rankings_url(params: dict) -> str:
    query = {
        "gender": params["gender"],
        "distance": params["distance"],
        "stroke": params["stroke"],
        "poolConfiguration": params["poolConfiguration"],
        "year": params["year"],
        "startDate": params["startDate"],
        "endDate": params["endDate"],
        "timesMode": params["timesMode"],
        "regionId": params["regionId"],
        "countryId": params["countryId"],
    }
    return f"{BASE_RANKINGS_URL}?{urlencode(query)}"



def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def ensure_table_exists():
    """
    Crea la tabla con la estructura que has pasado (ajustada con PRIMARY KEY/AUTO_INCREMENT).
    Si la tabla ya existe, no la toca.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS swimming_rankings (
            id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
            gender CHAR(1) NOT NULL,
            distance SMALLINT(6) NOT NULL,
            stroke VARCHAR(20) NOT NULL,
            pool_configuration VARCHAR(10) NOT NULL,
            overall_rank INT(11) NOT NULL,
            country_code CHAR(3) NOT NULL,
            time_text VARCHAR(16) NOT NULL,
            points INT(11) DEFAULT NULL,
            tag VARCHAR(10) DEFAULT NULL,
            record_tag VARCHAR(20) DEFAULT NULL,
            competition VARCHAR(255) DEFAULT NULL,
            location_country_code CHAR(3) DEFAULT NULL,
            race_date DATE DEFAULT NULL,
            athlete_id INT(10) UNSIGNED DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT NULL,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    """)
    conn.commit()
    cur.close()
    conn.close()


def athlete_exists(athlete_id: int) -> bool:
    """Comprueba si ya existe un atleta con ese ID en la tabla atletas."""
    if athlete_id is None:
        return False

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM atletas WHERE athlete_id = %s LIMIT 1", (athlete_id,))
    exists = cur.fetchone() is not None
    cur.close()
    conn.close()
    return exists


def insert_athlete(athlete_data: dict):
    """Inserta un atleta en la tabla atletas."""
    conn = get_db_connection()
    cur = conn.cursor()
    sql = """
        INSERT INTO atletas (
            athlete_id, athlete_name, age, gender, country_code,
            image_url, athlete_profile_url
        ) VALUES (
            %(athlete_id)s, %(athlete_name)s, %(age)s, %(gender)s,
            %(country_code)s, %(image_url)s, %(athlete_profile_url)s
        )
    """
    cur.execute(sql, athlete_data)
    conn.commit()
    cur.close()
    conn.close()


def ensure_athlete_saved(row: dict):
    """
    Guarda el atleta en la tabla atletas si no existía previamente.
    """
    athlete_id = row.get("athlete_id")
    if athlete_id is None:
        print("[!] Fila sin athlete_id, se omite guardado en atletas")
        return

    if athlete_exists(athlete_id):
        return

    athlete_data = {
        "athlete_id": athlete_id,
        "athlete_name": row.get("athlete_name"),
        "age": row.get("age"),
        "gender": row.get("gender"),
        "country_code": row.get("country_code"),
        "image_url": row.get("image_url"),
        "athlete_profile_url": row.get("athlete_profile_url"),
    }

    insert_athlete(athlete_data)
    print(f"[+] Atleta {athlete_id} insertado en la tabla atletas")


def upsert_ranking_row(row: dict):
    """
    Inserta una fila en la tabla swimming_rankings usando SOLO las columnas
    que existen en tu definición actual.
    De momento es un INSERT normal (si ejecutas varias veces, duplica datos).
    """
    conn = get_db_connection()
    cur = conn.cursor()

    sql = """
        INSERT INTO swimming_rankings (
            gender, distance, stroke, pool_configuration,
            overall_rank, country_code, time_text, points,
            tag, record_tag, competition,
            location_country_code, race_date, athlete_id
        )
        VALUES (
            %(gender)s, %(distance)s, %(stroke)s, %(pool_configuration)s,
            %(overall_rank)s, %(country_code)s, %(time_text)s, %(points)s,
            %(tag)s, %(record_tag)s, %(competition)s,
            %(location_country_code)s, %(race_date)s, %(athlete_id)s
        )
    """

    cur.execute(sql, row)
    conn.commit()
    cur.close()
    conn.close()


# =========================
# HELPERS DE PARSE
# =========================

def parse_int(value: str):
    value = (value or "").strip()
    return int(value) if value.isdigit() else None


def parse_date(value: str):
    """
    Convierte '18 Dec 2009' a date, si puede. Si no, devuelve None.
    """
    v = (value or "").strip()
    if not v:
        return None
    try:
        return datetime.strptime(v, "%d %b %Y").date()
    except ValueError:
        return None


def normalize_url(url: str) -> str:
    if not url:
        return None
    url = url.strip()
    if url.startswith("//"):
        return "https:" + url
    return url


# =========================
# SCRAPING CON PLAYWRIGHT
# =========================

def scrape_rankings_page(params: dict):
    """
    Abre la página de rankings con los parámetros dados,
    hace click en 'Show More' hasta que no queden más,
    y devuelve una lista de dicts con los datos.
    """
    validate_params(params)
    url = build_rankings_url(params)
    print(f"[*] URL de rankings: {url}")

    rows_data = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=60000)

        # Esperamos a que aparezca la tabla
        page.wait_for_selector("tbody.js-rankings-table-body tr.rankings-table__row",
                                timeout=30000)

        # Cargar más filas con "Show More"
        while True:
            table_rows = page.locator("tbody.js-rankings-table-body tr.rankings-table__row")
            current_count = table_rows.count()
            print(f"[*] Filas actuales cargadas: {current_count}")

            show_more = page.locator("button.js-show-more-button")

            # Si no existe el botón, salimos
            if show_more.count() == 0:
                print("[*] No existe botón 'Show More'. Fin de paginación.")
                break

            btn = show_more.first

            # Si el botón no es visible o no está habilitado, salimos
            if not btn.is_visible():
                print("[*] Botón 'Show More' no visible. Fin de paginación.")
                break

            if not btn.is_enabled():
                print("[*] Botón 'Show More' deshabilitado (cargando o sin más datos). Fin de paginación.")
                break

            print("[*] Pulsando 'Show More'…")
            btn.click()
            page.wait_for_timeout(SLEEP_AFTER_SHOW_MORE * 1000)

            # Volvemos a contar filas después del click
            new_count = table_rows.count()
            print(f"[*] Filas después de 'Show More': {new_count}")

            # Si no aumenta, evitamos bucle infinito
            if new_count <= current_count:
                print("[!] No se han cargado filas nuevas. Salimos de la paginación.")
                break

        # Una vez cargado todo, parseamos fila a fila
        table_rows = page.locator("tbody.js-rankings-table-body tr.rankings-table__row")
        total_rows = table_rows.count()
        print(f"[+] Total de filas a procesar: {total_rows}")

        for i in range(total_rows):
            row = table_rows.nth(i)
            cells = row.locator("td")

            try:
                overall_rank_text = cells.nth(0).inner_text().strip()
                overall_rank = parse_int(overall_rank_text) or 0

                # Country (nadador)
                country_img = cells.nth(1).locator("img.flag__img")
                country_code = None
                if country_img.count() > 0:
                    country_code = (country_img.first.get_attribute("alt") or "").strip()

                # Nombre + foto + datos atleta
                name_cell = cells.nth(2)
                link = name_cell.locator("a.rankings-table__person-link")
                athlete_profile_url = None
                athlete_name = None
                if link.count() > 0:
                    athlete_profile_url = normalize_url(link.first.get_attribute("href"))
                    athlete_name = (link.first.get_attribute("title") or "").strip()

                headshot = name_cell.locator(".athlete-headshot")
                athlete_id = None
                image_url = None
                if headshot.count() > 0:
                    athlete_id_attr = headshot.first.get_attribute("data-athlete-id")
                    athlete_id = parse_int(athlete_id_attr)
                    img = headshot.first.locator("img")
                    if img.count() > 0:
                        image_url = normalize_url(img.first.get_attribute("src"))

                # Edad (NO se guarda en BD de momento)
                age_text = cells.nth(3).inner_text().strip()
                age = parse_int(age_text)

                # Tiempo + record_tag (WR, MR, OC...)
                time_cell = cells.nth(4)
                time_text = time_cell.locator("strong").inner_text().strip()
                record_tags_loc = time_cell.locator(".rankings-table__records .rankings-table__record-tag")
                record_tags = []
                for j in range(record_tags_loc.count()):
                    tag_txt = (record_tags_loc.nth(j).inner_text() or "").strip()
                    if tag_txt:
                        record_tags.append(tag_txt)
                record_tag = ", ".join(record_tags) if record_tags else None

                # Points
                points_text = cells.nth(5).inner_text().strip()
                points = parse_int(points_text)

                # Tag (columna "Tag")
                tag_text = cells.nth(6).inner_text().strip() or None

                # Competition
                competition = cells.nth(7).inner_text().strip() or None

                # Location
                location_cell = cells.nth(8)
                loc_country_img = location_cell.locator("img.flag__img")
                location_country_code = None
                if loc_country_img.count() > 0:
                    location_country_code = (loc_country_img.first.get_attribute("alt") or "").strip()

                # Date
                date_text = cells.nth(9).inner_text().strip()
                race_date = parse_date(date_text)

                row_data = {
                    "gender": params["gender"],
                    "distance": int(params["distance"]),
                    "stroke": params["stroke"],
                    "pool_configuration": params["poolConfiguration"],

                    "overall_rank": overall_rank,
                    "country_code": country_code,
                    "athlete_name": athlete_name,          # no se inserta
                    "age": age,                            # no se inserta
                    "time_text": time_text,
                    "points": points,
                    "tag": tag_text,
                    "record_tag": record_tag,

                    "competition": competition,
                    "location_country_code": location_country_code,
                    "race_date": race_date,

                    "athlete_id": athlete_id,
                    "athlete_profile_url": athlete_profile_url,  # no se inserta
                    "image_url": image_url,                      # no se inserta
                }

                rows_data.append(row_data)

            except Exception as e:
                print(f"[X] Error parseando fila {i+1}: {e}")

        browser.close()

    return rows_data



def main():
    ensure_table_exists()

    for params in generate_all_param_sets():
        desc = f"{params['gender']} {params['distance']} {params['stroke']} {params['poolConfiguration']}"
        print(f"\n==============================")
        print(f"[*] Scrapeando prueba: {desc}")
        print(f"==============================")

        try:
            rows = scrape_rankings_page(params)
            print(f"[+] Filas obtenidas para {desc}: {len(rows)}")

            for idx, row in enumerate(rows, start=1):
                print(f"[{idx}/{len(rows)}] Guardando ranking {row['time_text']} (athlete_id={row['athlete_id']})")
                ensure_athlete_saved(row)
                upsert_ranking_row(row)

        except Exception as e:
            print(f"[X] Error en prueba {desc}: {e}")

        # pequeño respiro entre pruebas para no ir tan agresivo
        time.sleep(2)

    print("[✓] Proceso completado para todas las pruebas.")


if __name__ == "__main__":
    main()
