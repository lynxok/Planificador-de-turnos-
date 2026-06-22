@echo off
title Detener Planificador SFH ITEO
echo Deteniendo servidores de Node en segundo plano...
taskkill /f /im node.exe >nul 2>&1
echo.
echo =======================================================
echo         Planificador Detenido Correctamente
   echo =======================================================
echo.
timeout /t 2 >nul
