@echo off
title SIPRO-PH - Detener Servidor
cd /d "%~dp0"

echo =========================================================================
echo   SIPRO-PH - DETENER SERVICIO LOCAL
echo =========================================================================
echo.

python -c "import serve; serve.kill_process_on_port(8085)" >nul 2>&1
echo [OK] El servidor SIPRO-PH en el puerto 8085 ha sido detenido.
ping 127.0.0.1 -n 2 >nul
exit /b 0