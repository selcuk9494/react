@echo off
setlocal
cd /d "%~dp0"
:loop
".\node\node.exe" agent.js
if errorlevel 1 echo [%date% %time%] agent kapandi, 2 sn sonra yeniden basliyor>> "%ProgramData%\FrRaporBridge\bridge.log"
timeout /t 2 /nobreak >nul
goto loop
