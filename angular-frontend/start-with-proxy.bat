@echo off
echo ================================
echo Iniciando Angular con Proxy
echo ================================
echo.
echo Backend URL: http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api
echo Frontend URL: http://localhost:4200
echo.
cd /d "%~dp0"
call ng serve --open --proxy-config proxy.conf.json
