# Auth PHP (login/registro)

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
- `POST /api/register` body: `{ "name": "", "email": "", "password": "" }` (envia codigo de verificacion al correo)
- `POST /api/login` body: `{ "email": "", "password": "" }` (requiere correo verificado)
- `POST /api/email/send-code` body: `{ "email": "" }` reenvia codigo de verificacion
- `POST /api/email/verify` body: `{ "email": "", "code": "" }` valida el codigo y marca el correo como verificado
- `POST /api/password-reset` body: `{ "email": "" }` solicita codigo de cambio de contrasena (requiere correo verificado)
- `PUT /api/password-reset` body: `{ "code": "", "newPassword": "" }`

Responden JSON con `message` y `user` segun el caso.

## Solucion de problemas
1. Verifica MySQL en puerto 3306 y que el usuario `liveSwim` tenga permisos.
2. Si Gmail bloquea el envio, confirma que usas una contrasena de aplicacion y que el dispositivo esta autorizado.
3. Para ver columnas nuevas, ejecuta `DESCRIBE users;` tras el arranque.
