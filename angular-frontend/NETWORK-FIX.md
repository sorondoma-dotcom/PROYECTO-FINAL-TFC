# Solución al Error de Red (NetworkError)

## Problema
El frontend Angular no puede conectarse al backend PHP en XAMPP.

## Soluciones implementadas

### Opción 1: Usar Proxy (RECOMENDADO) ✅

El proxy evita problemas de CORS y simplifica las URLs.

**Para iniciar:**
```bash
# Opción A: Usar npm script
npm start

# Opción B: Usar comando directo
ng serve --open --proxy-config proxy.conf.json

# Opción C: Usar el script bat (Windows)
start-with-proxy.bat
```

**Configuración:**
- `proxy.conf.json` configurado ✅
- `angular.json` actualizado ✅
- `auth.service.ts` usando ruta relativa `/api` ✅

### Opción 2: Sin Proxy (URL Directa)

Si prefieres no usar proxy:

1. Edita `src/app/services/auth.service.ts`
2. Comenta la línea: `private readonly baseUrl = '/api';`
3. Descomenta: `private readonly baseUrl = 'http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api';`
4. Ejecuta: `npm run start:no-proxy`

## Verificación

### 1. Verificar que Apache está corriendo
- Abre XAMPP Control Panel
- Apache debe estar en verde (running)

### 2. Verificar que el backend responde
Ejecuta: `backend-php/auth-php/test-api.bat`

O prueba manualmente:
```bash
curl http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/
```

Deberías ver:
```json
{"status":"ok","service":"auth-php","database":"MySQL on localhost:3306"}
```

### 3. Verificar la base de datos
Si no has creado la base de datos:
```bash
# Desde phpMyAdmin o línea de comandos:
# Ejecutar: backend-php/auth-php/setup-database.sql
```

## URLs importantes

- **Frontend**: http://localhost:4200
- **Backend (directo)**: http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api
- **Backend (con proxy)**: http://localhost:4200/api (redirige al backend)
- **phpMyAdmin**: http://localhost/phpmyadmin

## Credenciales de prueba

Después de ejecutar `setup-database.sql`:
- **Email**: test@test.com
- **Password**: test123

## Estructura de archivos creados/modificados

```
angular-frontend/
├── proxy.conf.json              ← Configuración del proxy
├── start-with-proxy.bat         ← Script de inicio rápido
├── package.json                 ← Scripts npm actualizados
├── angular.json                 ← Configuración del proxy en serve
└── src/app/services/
    └── auth.service.ts          ← URL del API actualizada

backend-php/auth-php/
├── setup-database.sql           ← Script de setup de BD
├── test-api.bat                 ← Script de prueba del API
├── public/
│   ├── index.php                ← Routing mejorado
│   └── .htaccess                ← Configuración Apache
└── README.md                    ← Documentación actualizada
```

## Solución de problemas

### Error: "Cannot GET /api/login"
- Verifica que Apache esté corriendo
- Verifica que la ruta del backend sea correcta en `proxy.conf.json`

### Error: "CORS policy"
- Si usas URL directa sin proxy, verifica CORS en `backend-php/auth-php/public/index.php`
- Mejor solución: usa el proxy (Opción 1)

### Error: "Connection refused"
- Verifica que Apache esté en el puerto 80
- En XAMPP: Apache debe estar iniciado

### Base de datos vacía
- Ejecuta `setup-database.sql` en phpMyAdmin o MySQL Workbench
- Crea el usuario de prueba manualmente si es necesario
