@echo off
chcp 65001 >nul
title FR Rapor Bridge Kurulum
cd /d "%~dp0"

:: Zaten yonetici mi?
net session >nul 2>&1
if %errorLevel% == 0 goto RUN

echo Yonetici izni isteniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:RUN
echo.
echo === FR Rapor Bridge Kurulum ===
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
echo Pencereyi kapatabilirsiniz.
pause
