@echo off
title FarmaCore ERP ^& PDV - Magnos Farma
cd /d "C:\Users\magno\.gemini\antigravity\scratch\farma-erp"
echo =======================================================
echo    INICIANDO FARMACORE ERP ^& PDV (MAGNOS FARMA)
echo =======================================================
echo.
echo [1/2] Iniciando Servidor Backend (Fastify) e Frontend (Vite)...
echo [2/2] Abrindo navegador em http://localhost:5173 ...
echo.
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173"
call npm.cmd run dev:all
pause
