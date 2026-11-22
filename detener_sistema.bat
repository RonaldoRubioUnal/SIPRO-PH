@echo off
chcp 65001 > nul
title SIPRO-PH - Detener Servidor
cd /d "%~dp0"

echo =========================================================================
echo   SIPRO-PH - DETENER SERVICIO LOCAL
echo =========================================================================
echo.

python serve.py --stop >nul 2>&1
if errorlevel 1 (
    py serve.py --stop >nul 2>&1
)
echo [OK] El servidor SIPRO-PH en el puerto 8085 ha sido detenido.
ping 127.0.0.1 -n 2 >nul
exit /b 0
