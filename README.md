# SwimLive

Trabajo final orientado a la difusion de resultados de natacion. La plataforma combina un frontend Angular, un backend PHP para autenticacion y gestion de atletas, y una API Node.js que realiza scraping de datos publicos para alimentar los listados.

---

## Tecnologias principales

| Capa | Tecnologias |
|------|-------------|
| Frontend | Angular 19, Angular Material, SSR opcional |
| Autenticacion y gestion | PHP 8.1+, MySQL/PDO, PHPMailer |
| Scraping / datos externos | Node.js 18+, Express, Puppeteer, MySQL |
| Base de datos | MySQL 8 (script `liveswim.sql` + `setup-database.sql`) |

---

## Estructura del repositorio

```
PROYECTO-FINAL-TFC/
|-- angular-frontend/        # SPA Angular con proxy hacia ambos backends
|-- api-swim-live/           # API Node.js (scraping World Aquatics + endpoints extras)
|-- backend-php/
|   |-- auth-php/            # Backend PHP con endpoints de auth, atletas, rankings, etc.
|-- scraper-python/          # Scripts auxiliares (no necesarios para el arranque nativo)
|-- liveswim.sql             # Dump principal con datos base
|-- docker-compose.yml       # Stack completo con Docker (opcional)
`-- README.md                # Este archivo
```

Cada carpeta incluye su propio README o documentacion mas especifica (`backend-php/auth-php/README.md`, etc.).

---

## Requisitos generales para ejecucion nativa

- Git
- Node.js 18+ y npm
- PHP 8.1+ con extension PDO MySQL (XAMPP/WAMP o PHP standalone)
- MySQL 8 (o MariaDB equivalente)
- Opcional pero recomendado: Python 3 (para scripts auxiliares) y Composer si ampliaras el backend PHP

> Consejo: manten cada servicio en una terminal distinta para ver logs en vivo.

---

## Guia rapida de uso nativo

### 1. Clonar y preparar la base de datos

```bash
git clone https://github.com/sorondoma-dotcom/PROYECTO-FINAL-TFC.git
cd PROYECTO-FINAL-TFC
```

1. Crea una base `liveswim` y un usuario con permisos (`liveSwim`/`1234` o el que prefieras).
2. Importa los datos iniciales:
   ```bash
   mysql -u root -p liveswim < liveswim.sql
   ```
3. Si quieres cargar usuarios de prueba del backend PHP ejecuta tambien:
   ```bash
   mysql -u root -p < backend-php/auth-php/setup-database.sql
   ```

**Credenciales de referencia (puedes cambiarlas):**
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=liveswim
DB_USER=liveSwim
DB_PASS=1234
```

Guardalas; se reutilizan en los tres servicios.

---

### 2. Backend PHP (auth + atletas)

Ubicacion: `backend-php/auth-php`

1. Copia o edita el archivo `.env` (el repo incluye uno funcional como ejemplo). Variables minimas:
   ```env
   DB_DSN="mysql:host=localhost;dbname=liveswim;charset=utf8mb4"
   DB_USER="liveSwim"
   DB_PASS="1234"
   ALLOWED_ORIGINS="http://localhost:4200,http://localhost:8080"
   MAIL_ENABLED=false
   MAIL_HOST="smtp.gmail.com"
   MAIL_PORT=587
   MAIL_SECURE="tls"
   MAIL_USER="example@gmail.com"
   MAIL_PASS="app-password"
   MAIL_FROM="example@gmail.com"
   MAIL_FROM_NAME="SwimLive"
   ```
2. Si usas Apache (XAMPP) basta con apuntar el VirtualHost a `backend-php/auth-php/public`.
3. Para pruebas rapidas puedes ejecutar:
   ```bash
   cd backend-php/auth-php
   php -S localhost:8081 -t public
   ```
4. Valida que responde en `http://localhost:8081/api/health` y revisa los endpoints detallados en `backend-php/auth-php/README.md`.

**Notas clave**
- El backend gestiona login, registro, atletas, competiciones y notificaciones.
- Sube avatares a `public/uploads/`; asegurate de que la carpeta puede escribirse.

---

### 3. API Node.js (scraping / datos publicos)

Ubicacion: `api-swim-live`

1. Instala dependencias:
   ```bash
   cd api-swim-live
   npm ci
   ```
2. Crea un `.env` (no versionado). Ejemplo basico:
   ```env
   PORT=3000
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=liveSwim
   MYSQL_PASSWORD=1234
   MYSQL_DATABASE=liveswim
   LOG_LEVEL=debug
   PUPPETEER_CACHE_DIR=./.puppeteer-cache
   WORLD_AQUATICS_COMP_TTL=3600
   WORLD_AQUATICS_EVENTS_TTL=3600
   WORLD_AQUATICS_EVENT_RESULT_TTL=900
   ```
3. Arranca el servidor:
   ```bash
   npm run dev   # con nodemon y logs verbosos
   # o
   npm start
   ```
4. Prueba el endpoint principal:
   ```bash
   curl http://localhost:3000/api/world-aquatics/competitions
   ```

**Notas clave**
- Usa Puppeteer; el primer arranque puede tardar en descargar Chromium.
- Comparte la misma base MySQL que el backend PHP para estadisticas y cacheos.

---

### 4. Frontend Angular

Ubicacion: `angular-frontend`

1. Instala dependencias:
   ```bash
   cd angular-frontend
   npm ci
   ```
2. Inicia el servidor de desarrollo con el proxy configurado hacia los backends:
   ```bash
   npm start
   ```
   - `/api` apunta a `http://localhost:3000` (Node)
   - `/auth-api` apunta a `http://localhost:8081` (PHP)
3. Abre `http://localhost:4200`. Si ya tenias credenciales (`test@test.com` / `test123`) podras iniciar sesion.

**Notas clave**
- `src/app/config/api.config.ts` autodetecta el origen y usa el proxy; para despliegues recuerda exponer `/api` y `/auth-api` desde tu reverse proxy (Nginx, Apache, etc.).
- Para builds SSR o de produccion utiliza `npm run build` y sirve la carpeta `dist/angular-frontend`.

---

### 5. Flujo recomendado de arranque nativo

1. MySQL en marcha con `liveswim` importado.
2. `php -S localhost:8081 -t public` dentro de `backend-php/auth-php`.
3. `npm start` dentro de `api-swim-live` (puerto 3000).
4. `npm start` dentro de `angular-frontend` (puerto 4200 con proxy).

Con esas tres terminales abiertas tendras toda la plataforma operativa sin depender de Docker.

---

## Uso con Docker (opcional)

Si prefieres evitar instalaciones locales:

```bash
docker compose build
docker compose up -d
```

Servicios expuestos:
- Frontend (Angular + Nginx): `http://localhost:8080`
- API Node: `http://localhost:3000`
- Backend PHP: `http://localhost:8081`
- MySQL: `localhost:3310` (usuario `liveswim_user` / `liveswim_pass`)

Deten todo con `docker compose down` o `docker compose down -v` para borrar datos.

---

## Documentacion complementaria

- `backend-php/auth-php/README.md`: detalle completo de endpoints (GET, POST, PUT, DELETE) y configuracion SMTP.
- `api-swim-live/src/`: controladores y servicios de scraping (`worldAquatics.controller` contiene la lista de rutas publicas).
- Scripts Python (`scraper-python/`) para importaciones puntuales.

Si detectas discrepancias o anades nuevos endpoints recuerda actualizar ambos README para mantener sincronizada la informacion.
