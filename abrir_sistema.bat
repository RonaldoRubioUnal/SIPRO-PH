@echo off
setlocal enabledelayedexpansion
title SIPRO-PH - Sistema de Revision de Placa Huellas - Gobernacion de Antioquia
cd /d "%~dp0"

echo =========================================================================
echo   SIPRO-PH - SISTEMA DE REVISION DE PLACA HUELLAS
echo   Gobernacion de Antioquia - Secretaria de Infraestructura Fisica
echo =========================================================================
echo.

:: 1. Verificar si el servidor ya esta activo y respondiendo
python -c "import sys, serve; sys.exit(0 if serve.is_server_healthy(8085) else 1)" >nul 2>&1
if not errorlevel 1 (
    echo [OK] El servidor ya se encuentra activo en segundo plano.
    echo [+] Abriendo SIPRO-PH en su navegador...
    start "" "http://localhost:8085/index.html"
    ping 127.0.0.1 -n 2 >nul
    exit /b 0
)

:: 2. Si no esta activo, iniciarlo en segundo plano con pythonw
echo [+] Iniciando servidor SIPRO-PH en segundo plano (Puerto 8085)...
start "" pythonw serve.py --no-browser

:: 3. Esperar hasta que el servidor este respondiendo (maximo 6 segundos)
for /l %%i in (1,1,6) do (
    ping 127.0.0.1 -n 2 >nul
    python -c "import sys, serve; sys.exit(0 if serve.is_server_healthy(8085) else 1)" >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Servidor activo y respondiendo.
        echo [+] Abriendo SIPRO-PH en su navegador...
        start "" "http://localhost:8085/index.html"
        ping 127.0.0.1 -n 2 >nul
        exit /b 0
    )
)

:: 4. Contingencia: Si pythonw no respondio, ejecutar en primer plano para diagnostico
echo.
echo [!] Advertencia: No se detecto el inicio en segundo plano.
echo [+] Iniciando servidor en modo consola directo...
python serve.py
if errorlevel 1 (
    echo.
    echo [ERROR] No fue posible iniciar el servidor web SIPRO-PH.
    echo Verifique que Python este instalado y disponible en el sistema.
    pause
)