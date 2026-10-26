@echo off
chcp 65001 > nul
title SIPRO-PH - Sistema de Revisión de Placa Huellas - Gobernación de Antioquia
cd /d "%~dp0"
python serve.py
if errorlevel 1 (
    echo.
    echo Intentando método de contingencia...
    start "" "http://localhost:8085/index.html"
    python -m http.server 8085
)
pause

