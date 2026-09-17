@echo off
title Instalador y Lanzador del Sistema de Turnos LYNX
color 0A
echo ========================================================
echo   SISTEMA DE TURNOS LYNX - INSTALACION Y ARRANQUE
echo ========================================================
echo.

:: Comprobar si Node.js esta instalado
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado en esta computadora.
    echo El sistema necesita Node.js para poder funcionar.
    echo.
    echo Presiona cualquier tecla para abrir la pagina de descarga...
    pause >nul
    start https://nodejs.org/
    echo.
    echo Descarga la version "LTS", instalala dando "Siguiente" a todo, y luego vuelve a abrir este archivo.
    pause
    exit
)

echo [OK] Node.js esta instalado.
echo.

:: Comprobar si existen los modulos de Node (node_modules)
IF NOT EXIST "node_modules\" (
    echo [INFO] Es la primera vez que se ejecuta en esta PC.
    echo [INFO] Instalando componentes necesarios (esto puede tardar un par de minutos)...
    call npm install
    echo.
    echo [OK] Componentes instalados correctamente.
) ELSE (
    echo [OK] Componentes del sistema verificados.
)

echo.
echo ========================================================
echo INICIANDO EL SERVIDOR... 
echo IMPORTANTE: NO CIERRES ESTA VENTANA NEGRA.
echo Si la cierras, el sistema dejara de funcionar en la clinica.
echo ========================================================
echo.

:: Iniciar el servidor
call npm start

pause
