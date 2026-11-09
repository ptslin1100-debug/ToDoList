@echo off
title TeamTask 協作待辦伺服器 (to-do-list-511f9)
cd /d "%~dp0"
echo ========================================================
echo   啟動 TeamTask 本地伺服器...
echo   專案路徑: %cd%
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
