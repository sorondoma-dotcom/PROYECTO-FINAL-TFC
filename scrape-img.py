import time
import requests
from bs4 import BeautifulSoup
import mysql.connector
from mysql.connector import Error

# ===== CONFIGURACIÓN DB (Rellena con tus datos) =====
DB_CONFIG = {
    "host": "localhost",
    "user": "liveSwim",
    "password": "1234",
    "database": "liveSwim",
}

# URL base del perfil de atleta
BASE_URL = "https://www.worldaquatics.com/athletes/{athlete_id}/{athlete_id}"

# Tiempo entre peticiones (segundos) para no ir muy agresivos
REQUEST_DELAY = 0.8


def get_db_connection():
    """Abre conexión a MySQL."""
    return mysql.connector.connect(**DB_CONFIG)


def get_athletes_without_image(conn):
    """Devuelve lista de athlete_id donde image_url es NULL."""
    sql = "SELECT athlete_id FROM atletas WHERE image_url IS NULL"
    with conn.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()
    # rows es lista de tuplas [(id,), (id,), ...]
    return [r[0] for r in rows]


def fetch_athlete_image_url(athlete_id):
    """Descarga la página del atleta y extrae la URL de la imagen de perfil."""
    url = BASE_URL.format(athlete_id=athlete_id)
    try:
        resp = requests.get(url, timeout=10)
    except requests.RequestException as e:
        print(f"[ERROR] Athlete {athlete_id} - fallo de petición: {e}")
        return None, url

    if resp.status_code != 200:
        print(f"[WARN] Athlete {athlete_id} - status code {resp.status_code} para {url}")
        return None, url

    soup = BeautifulSoup(resp.text, "html.parser")

    # Buscamos el bloque que comentas:
    # <div class="athlete-header__profile" ...>
    container = soup.find("div", class_="athlete-header__profile")
    if not container:
        print(f"[WARN] Athlete {athlete_id} - no se encontró el contenedor 'athlete-header__profile'")
        return None, url

    # Dentro buscamos la imagen de perfil:
    # <img class="athlete-header__profile--image  object-fit-cover-picture__img" src="..." alt="...">
    img = container.find("img", class_="athlete-header__profile--image")
    if not img:
        # Por si acaso la clase varía un poco, probamos a coger el primer <img> dentro del contenedor
        img = container.find("img")

    if not img:
        print(f"[WARN] Athlete {athlete_id} - no se encontró ninguna imagen en el contenedor")
        return None, url

    img_src = img.get("src")
    if not img_src:
        print(f"[WARN] Athlete {athlete_id} - imagen sin atributo src")
        return None, url

    # Si la URL viniera relativa (no debería, pero por si acaso)
    if img_src.startswith("//"):
        img_src = "https:" + img_src

    print(f"[OK] Athlete {athlete_id} - imagen encontrada: {img_src}")
    return img_src, url


def update_athlete_image(conn, athlete_id, image_url, profile_url=None):
    """Actualiza el campo image_url (y opcionalmente athlete_profile_url) del atleta."""
    if profile_url:
        sql = """
            UPDATE atletas
            SET image_url = %s,
                athlete_profile_url = COALESCE(athlete_profile_url, %s)
            WHERE athlete_id = %s
        """
        params = (image_url, profile_url, athlete_id)
    else:
        sql = "UPDATE atletas SET image_url = %s WHERE athlete_id = %s"
        params = (image_url, athlete_id)

    with conn.cursor() as cursor:
        cursor.execute(sql, params)
    conn.commit()


def main():
    try:
        conn = get_db_connection()
        print("[INFO] Conectado a la base de datos")

        athlete_ids = get_athletes_without_image(conn)
        print(f"[INFO] Atletas sin imagen: {len(athlete_ids)} encontrados")

        for idx, athlete_id in enumerate(athlete_ids, start=1):
            print(f"\n[{idx}/{len(athlete_ids)}] Procesando athlete_id={athlete_id}")
            image_url, profile_url = fetch_athlete_image_url(athlete_id)

            if image_url:
                try:
                    update_athlete_image(conn, athlete_id, image_url, profile_url)
                    print(f"[OK] Athlete {athlete_id} - DB actualizado")
                except Error as e:
                    print(f"[ERROR] Athlete {athlete_id} - fallo al actualizar DB: {e}")
            else:
                print(f"[SKIP] Athlete {athlete_id} - sin imagen, no se actualiza DB")

            time.sleep(REQUEST_DELAY)

    except Error as e:
        print(f"[ERROR] Error de conexión MySQL: {e}")
    finally:
        try:
            if conn.is_connected():
                conn.close()
                print("[INFO] Conexión a DB cerrada")
        except NameError:
            # conn no se llegó a definir
            pass


if __name__ == "__main__":
    main()
