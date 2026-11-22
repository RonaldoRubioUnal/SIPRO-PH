@echo off
chcp 65001 > nul
title SIPRO-PH - Sistema de Revision de Placa Huellas - Gobernacion de Antioquia
cd /d "%~dp0"

echo =========================================================================
echo   SIPRO-PH - SISTEMA DE REVISION DE PLACA HUELLAS
echo   Gobernacion de Antioquia - Secretaria de Infraestructura Fisica
echo =========================================================================
echo.

:: 1. Verificar disponibilidad de Python o py launcher
set "PY_CMD="
where python >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
) else (
    where py >nul 2>&1
    if not errorlevel 1 (
        set "PY_CMD=py"
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] No se encontro Python en el sistema.
    echo Por favor asegurese de tener instalado Python 3 y agregado al PATH.
    echo Puede descargarlo gratuitamente desde: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

:: 2. Iniciar el servidor local e interfaz web
echo [+] Iniciando servidor SIPRO-PH con %PY_CMD%...
%PY_CMD% serve.py
if errorlevel 1 (
    echo.
    echo [!] Aviso: Se presento un error al ejecutar serve.py.
    echo [+] Intentando metodo alternativo de contingencia...
    start "" "http://localhost:8085/index.html"
    %PY_CMD% -m http.server 8085
)

echo.
pause
