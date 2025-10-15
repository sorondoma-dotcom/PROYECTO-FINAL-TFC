# api-swim-live

Pequeña API y página estática que forma parte del proyecto SwimLive.

Este README describe cómo instalar y ejecutar la API localmente en Windows.

Requisitos

- Node.js (LTS) y npm
- Git

Instalación y ejecución (Windows)

1. Abrir PowerShell o Git Bash y situarse en la carpeta del proyecto:

```bash
cd path\to\PROYECTO-FINAL-TFC\api-swim-live
```

2. Instalar dependencias (recomendado usar `npm ci` para reproducibilidad):

```bash
npm ci
```

3. Iniciar la API:

```bash
node index.js
```

4. Abrir la interfaz estática en el navegador (si la API sirve páginas estáticas o para probar `index.html`):

```bash
# usando http-server:
npx http-server . -p 8080
# o con Python 3:
python -m http.server 8080
# y abrir http://localhost:8080/index.html
```

Notas

- Si compartes este repositorio con otros, recomiéndales ejecutar `npm ci` y no `npm install` para asegurar que instalan las versiones exactas.
- Para despliegues o demos públicas, crea un Dockerfile y un `docker-compose.yml` para encapsular dependencias.

Si quieres, puedo añadir un `Dockerfile` y un `docker-compose.yml` minimalistas para `api-swim-live`.
