# 🏊‍♂️ SwimLive

**Trabajo de Fin de Curso (TFC)**  
**Autor:** Miguel Alfredo Sorondo Hernández(https://github.com/sorondoma-dotcom)  
**Repositorio:** [PROYECTO-FINAL-TFC](https://github.com/sorondoma-dotcom/PROYECTO-FINAL-TFC.git)

---

## 📘 Descripción general

**SwimLive** es un proyecto orientado a mejorar la **accesibilidad a la natación**, ofreciendo una plataforma donde atletas, entrenadores y federaciones pueden consultar información en tiempo real sobre competiciones de natación.  

El objetivo principal es permitir la **visualización de competiciones activas**, filtradas por país, fecha o tipo de piscina (25 m o 50 m), junto con los resultados correspondientes.

Este proyecto ha sido desarrollado como parte del **Trabajo de Fin de Curso**, combinando distintas tecnologías web modernas para crear una arquitectura funcional y escalable.

---

## ⚙️ Tecnologías utilizadas

| Tecnología | Uso principal |
|-------------|----------------|
| **Angular** | Desarrollo del *frontend* interactivo. |
| **Node.js** | Creación de la API que conecta el frontend con los datos. |
| **PHP** | Gestión de consultas a la base de datos y manejo de usuarios y metadatos. |
| **MySQL Workbench** | Base de datos principal para almacenar competiciones, resultados y usuarios. |

> 💡 El proyecto utiliza una arquitectura separada entre **frontend**, **backend** y **API**, lo que facilita el mantenimiento y escalabilidad.

---

## 📂 Estructura del proyecto

```bash
SwimLive/
├── frontend/
│   └── ProyectoAngular/         # Código del frontend en Angular
│
├── backend/
│   ├── Model/                   # Modelos de datos
│   ├── Controller/              # Controladores de la lógica del servidor
│   └── ConnectionDB/            # Conexión con la base de datos MySQL
│
└── api/
    └── index.js                 # Punto de entrada de la API (Node.js)

```
---

## 🚀 Ejecución del proyecto

### 🔧 Requisitos previos
- Tener instalado **Node.js** y **npm**
- Tener instalado **MySQL Workbench**
- Configurar una base de datos MySQL local

### ▶️ Iniciar la API (Node.js)
1. Abrir una terminal en la carpeta `api/`
2. Ejecutar:
   ```bash
   node index.js


---

## 🚀 Ejecución del proyecto

### 🔧 Requisitos previos
- Tener instalado **Node.js** y **npm**
- Tener instalado **MySQL Workbench**
- Configurar una base de datos MySQL local

### ▶️ Iniciar la API (Node.js)
1. Abrir una terminal en la carpeta `api/`
2. Ejecutar:
   ```bash
   node index.js


   La API se ejecutará en local, lista para recibir peticiones del frontend.

🧩 Funcionalidades principales

   • 📅 Consulta de competiciones activas por país, fecha o tipo de piscina (25 m / 50 m).

  • 🏆 Visualización de resultados en tiempo real.

  • 🔍 Filtro inteligente para facilitar la búsqueda de eventos.

  • 🧾 Integración con una base de datos para la gestión de información de atletas y resultados.

  • 🛠️ To-Do (pendiente de desarrollo)

  •  Finalizar el despliegue del frontend Angular.

  •  Implementar el archivo .env para gestionar variables de entorno (DB_HOST, DB_USER, etc.).

  • Mejorar la interfaz visual y añadir componentes interactivos.

  • Añadir un sistema de autenticación para usuarios y entrenadores.

  • Incluir capturas de pantalla y demo visual.

🤝 Cómo contribuir

  • Este proyecto forma parte de un trabajo académico, por lo que no se aceptan contribuciones externas de momento.
   Sin embargo, se agradecen los comentarios, sugerencias o feedback constructivo a través del repositorio de GitHub.

❤️ Agradecimientos

 • Agradezco especialmente a:

 • Jordi Pozo

 • José Antonio Carrascal Alderete

 • José Luis Román Bienes

 • Ana Rosa Hoyos Terán

  por su apoyo, orientación y colaboración durante el desarrollo de este proyecto.

🔗 Enlaces

📦 Repositorio: https://github.com/sorondoma-dotcom/PROYECTO-FINAL-TFC

© 2025 — SwimLive. Proyecto académico desarrollado como parte del Trabajo de Fin de Curso
---

## 🪟 Cómo ejecutar en Windows (rápido)

Estas instrucciones permiten clonar el repositorio en un equipo con Windows y levantar la API mínima y la interfaz estática para ver la aplicación localmente.

Requisitos mínimos:

- Node.js (recomendado LTS) y npm disponibles en PATH
- Git (para clonar)
- Opcional: Python 3 (para servir archivos estáticos si no quieres instalar paquetes npm adicionales)

Pasos rápidos:

1. Clona el repositorio:

```bash
git clone https://github.com/sorondoma-dotcom/PROYECTO-FINAL-TFC.git
cd PROYECTO-FINAL-TFC
```

2. Iniciar la API Node (carpeta `api-swim-live`):

```bash
cd api-swim-live
# Instala dependencias exactamente según package-lock (recomendado)
npm ci
# Inicia la API
node index.js
```

La API por defecto escucha en el puerto que está definido en `index.js` (si no, normalmente 3000 o 8080). Abre el navegador en http://localhost:<puerto> según corresponda.

3. Ver la página estática `api-swim-live/index.html` (opciones):

- Usando `npx http-server` (si no lo tienes instalado globalmente):

```bash
npx http-server . -p 8080
# luego abrir http://localhost:8080/index.html
```

- O usando Python 3 (viene instalado en muchas máquinas):

```bash
python -m http.server 8080
# luego abrir http://localhost:8080/index.html
```

4. Si tienes un frontend Angular (carpeta `frontend/` o similar):

- Entra en la carpeta del frontend (si existe), instala dependencias y arranca el servidor de desarrollo:

```bash
cd ../frontend/ProyectoAngular || cd ../frontend
npm ci
npm run start # o ng serve si tu package.json lo define
```

Notas y buenas prácticas:

- Nunca incluyas `node_modules/` en el repositorio (ya está en `.gitignore`).
- Para entornos de producción o para simplificar instalaciones en Windows, considera usar Docker (instrucciones básicas en la sección siguiente).

### Opción Docker (recomendado para entornos limpios)

Si tienes Docker instalado puedes construir y levantar servicios sin instalar dependencias en Windows:

```bash
# desde la raíz del repo (ejemplo mínimo para api-swim-live)
cd api-swim-live
docker build -t swimlive-api .
docker run -p 8080:8080 swimlive-api
```

Adapta puertos y Dockerfile según necesites. Puedo añadir un `Dockerfile` y `docker-compose.yml` de ejemplo si quieres.
