# Auth PHP (login/registro)

API sencilla en PHP para gestionar usuarios (login/registro) con MySQL. Pensada para conectarse desde el frontend Angular.

## Estructura
- `public/index.php`: front controller con rutas `/api/register` y `/api/login`.
- `src/`: bootstrap de PDO, controladores, servicios y repositorio.
- `.env`: configuración de conexión a MySQL.

## Requisitos
- PHP 8.1+
- MySQL/MariaDB en `localhost:3306`
- Extensión PDO MySQL habilitada

## Configuración de Base de Datos

### 1. Crear la base de datos y usuario
Ejecuta el script SQL completo desde MySQL:

```bash
# Opción 1: Desde línea de comandos
mysql -u root -p < setup-database.sql

# Opción 2: Desde phpMyAdmin o MySQL Workbench
# Abre setup-database.sql y ejecuta todo el contenido
```

### 2. Verificar configuración en .env
El archivo `.env` debe contener:
```env
DB_DSN="mysql:host=localhost;dbname=liveswim;charset=utf8mb4"
DB_USER="liveSwim"
DB_PASS="1234"
```

### 3. Usuario de prueba
Después de ejecutar `setup-database.sql`, tendrás:
- **Email**: test@test.com
- **Password**: test123

## Arranque con XAMPP
El proyecto está configurado para funcionar con XAMPP en el puerto 80:

1. Asegúrate de que Apache esté corriendo en XAMPP
2. El frontend accede a la API en:
   ```
   http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api
   ```

3. Para verificar que funciona, accede a:
   ```
   http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/
   ```
   Deberías ver: `{"status":"ok","service":"auth-php","database":"MySQL on localhost:3306"}`

### Alternativa: Servidor PHP integrado (puerto 8000)
```bash
cd auth-php
php -S localhost:8000 -t public
```
Si usas esta opción, cambia en `auth.service.ts`:
```typescript
private readonly baseUrl = 'http://localhost:8000/api';
```

## Endpoints
- `POST /api/register` body: `{ "name": "", "email": "", "password": "" }`
- `POST /api/login` body: `{ "email": "", "password": "" }`

Responden JSON con `message` y `user`.

## Solución de problemas

### Error de conexión a la base de datos
1. Verifica que MySQL esté corriendo en el puerto 3306
2. Verifica que el usuario `liveSwim` existe y tiene permisos
3. Verifica que la base de datos `liveswim` existe

### Verificar conexión MySQL
```bash
mysql -u liveSwim -p1234 -e "USE liveswim; SHOW TABLES;"
```
