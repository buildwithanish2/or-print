@echo off
title PrintQR Platform Launcher
color 0b

echo ===================================================
echo           PrintQR SaaS Platform Launcher
echo ===================================================
echo.

echo 1. Starting Backend REST API & WebSocket (Port 5000)...
start "PrintQR API" cmd /k "npm run dev:api"

timeout /t 3 /nobreak > nul

echo 2. Starting Customer Web App (Port 5173)...
start "PrintQR Customer Web" cmd /k "npm run dev:customer"

echo 3. Starting Shop Dashboard (Port 5174)...
start "PrintQR Shop Dashboard" cmd /k "npm run dev:shop"

echo 4. Starting Admin Console (Port 5175)...
start "PrintQR Admin Web" cmd /k "npm run dev:admin"

echo.
echo ===================================================
echo   All Web Services Started Successfully!
echo.
echo   - Customer Web:    http://localhost:5173/print/abc-digital-print
echo   - Shop Dashboard:  http://localhost:5174 (owner@abcdigital.com / Shop@123456)
echo   - Admin Panel:     http://localhost:5175 (admin@example.com / Admin@123456)
echo   - Backend API:     http://localhost:5000
echo.
echo   To launch Windows Print Agent, run:
echo   dotnet run --project apps/print-agent/PrintQRAgent/PrintQRAgent.csproj
echo ===================================================
pause
