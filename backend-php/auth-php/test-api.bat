@echo off
echo ================================
echo Verificacion del Backend PHP
echo ================================
echo.

echo 1. Probando endpoint raiz...
curl -s "http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/"
echo.
echo.

echo 2. Probando endpoint de health...
curl -s "http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api/health"
echo.
echo.

echo 3. Probando registro de usuario...
curl -s -X POST "http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api/register" -H "Content-Type: application/json" -d "{\"name\":\"Usuario Prueba\",\"email\":\"prueba@test.com\",\"password\":\"123456\"}"
echo.
echo.

echo 4. Probando login con usuario recien creado...
curl -s -X POST "http://localhost/Proyecto-Final-TFC/backend-php/auth-php/public/api/login" -H "Content-Type: application/json" -d "{\"email\":\"prueba@test.com\",\"password\":\"123456\"}"
echo.
echo.

echo ================================
echo Verificacion completada!
echo ================================
pause
