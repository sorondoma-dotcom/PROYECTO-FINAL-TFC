# Auth PHP 

API sencilla en PHP para gestionar usuarios (login/registro) con MySQL. Incluye verificacion de correo via Gmail SMTP para confirmar cuentas antes de iniciar sesion.

## Estructura
- `public/index.php`: front controller con rutas `/api/register`, `/api/login`, verificacion y reset de contrasena.
- `src/`: bootstrap de PDO, controladores, servicios y repositorio.
- `.env`: configuracion de conexion a MySQL y SMTP.

## Requisitos
- PHP 8.1+
- MySQL/MariaDB en `localhost:3306`
- Extension PDO MySQL habilitada

## Configuracion de Base de Datos

1) Crear la base de datos y usuario:
```bash
mysql -u root -p < setup-database.sql
```


3) Configurar correo (Gmail SMTP) para enviar el codigo:
```env
DB_DSN="mysql:host=localhost;dbname=liveswim;charset=utf8mb4"
DB_USER="liveSwim"
DB_PASS="1234"

MAIL_ENABLED=true
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_SECURE="tls"
MAIL_USER="swimlive669@gmail.com"
MAIL_PASS="orcd tixd ueqy wrnu "
MAIL_FROM="swimlive669@gmail.com"
MAIL_FROM_NAME="Live Swim"
```
- Usa una contrasena de aplicacion de Gmail (no la contrasena normal).
- Si falta configuracion o `MAIL_ENABLED=false`, la API no intentara enviar correos.

4) Usuario de prueba creado por el script:
- Email: `test@test.com`
- Password: `test123`

## Arranque con XAMPP
- Frontend apunta a: `http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api`
- Prueba rapida: abre `http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/`

Alternativa: servidor PHP integrado (puerto 8000):
```bash
cd auth-php
php -S localhost:8000 -t public
```
Si usas esta opcion, cambia en `auth.service.ts`:
```ts
private readonly baseUrl = 'http://localhost:8000/api';
```

## Endpoints
### GET
- `GET /api/health` (y `/` o `/index.php`) verifica que el servicio y la base de datos respondan.
- `GET /api/auth/me` devuelve la sesion actual (requiere login previo).
- `GET /api/users/{id}/avatar` obtiene el avatar almacenado del usuario.
- `GET /api/rankings` lista los rankings globales scrapeados.
- `GET /api/athletes` lista atletas disponibles para consulta publica.
- `GET /api/athletes/results` historico de resultados de atletas (acepta filtros por query string).
- `GET /api/athletes/results/medals` resumen de medallas por atleta y prueba.
- `GET /api/athletes/results/stats` estadisticas agregadas (records personales, promedios, etc.).
- `GET /api/athletes/me` perfil del atleta vinculado al usuario autenticado.
- `GET /api/athletes/{id}/profile` perfil publico de un atleta concreto.
- `GET /api/stats/olympic-records` lider actual de records olimpicos por prueba.
- `GET /api/competitions` listado general de competiciones con inscripciones.
- `GET /api/competitions/{id}` detalle de una competicion concreta.
- `GET /api/competitions/{id}/proofs` pruebas asociadas a la competicion indicada.
- `GET /api/proofs/{id}` detalle de una prueba especifica.
- `GET /api/notifications` notificaciones pendientes del usuario autenticado.

### POST
- `POST /api/register` body: `{ "name": "", "email": "", "password": "" }` (envia codigo de verificacion al correo)
- `POST /api/login` body: `{ "email": "", "password": "" }` (requiere correo verificado)
- `POST /api/email/send-code` body: `{ "email": "" }` reenvia codigo de verificacion
- `POST /api/email/verify` body: `{ "email": "", "code": "" }` valida el codigo y marca el correo como verificado
- `POST /api/password-reset` body: `{ "email": "" }` envia codigo de cambio de contrasena al correo (solo devuelve el codigo en la respuesta si el SMTP esta deshabilitado)
- `POST /api/logout` cierra la sesion actual.
- `POST /api/competitions` crea una nueva competicion.
- `POST /api/competitions/{id}/athletes` inscribe a un atleta en una competicion.
- `POST /api/proofs/{id}/athletes` inscribe un atleta en una prueba concreta.
- `POST /api/proofs/athletes/bulk` inscribe en bloque un atleta en multiples pruebas.
- `POST /api/notifications/{id}/mark-read` marca como leida una notificacion.
- `POST /api/notifications/{id}/respond` acepta o rechaza la notificacion/inscripcion.

### PUT
- `PUT /api/password-reset` body: `{ "code": "", "newPassword": "" }`
- `PUT /api/auth/profile` actualiza los datos del usuario (acepta multipart para avatar).
- `PUT /api/competitions/{id}` modifica una competicion existente.
- `PUT /api/inscriptions/{id}` actualiza el estado de una inscripcion.
- `PUT /api/proofs/{id}` actualiza los campos de una prueba existente.

### DELETE
- `DELETE /api/competitions/{id}` elimina una competicion.
- `DELETE /api/inscriptions/{id}` revoca la inscripcion realizada.
- `DELETE /api/proofs/{id}` borra la prueba.
- `DELETE /api/proofs/{proofId}/athletes/{inscriptionId}` desinscribe a un atleta concreto de la prueba.
- `DELETE /api/proofs/athletes/{inscriptionId}` elimina la inscripcion de la prueba por id directo.

Responden JSON con `message` y `user` segun el caso.

## Solucion de problemas
1. Verifica MySQL en puerto 3306 y que el usuario `liveSwim` tenga permisos.
2. Si Gmail bloquea el envio, confirma que usas una contrasena de aplicacion y que el dispositivo esta autorizado.
3. Para ver columnas nuevas, ejecuta `DESCRIBE users;` tras el arranque.
