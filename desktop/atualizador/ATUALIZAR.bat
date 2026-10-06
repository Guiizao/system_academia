@echo off
rem DARK FISIC - atualizar o sistema sem instalar de novo.
rem Clique duas vezes neste arquivo. Para apontar outra pasta de instalacao:
rem    ATUALIZAR.bat "C:\caminho\da\pasta\DARK FISIC"
setlocal
title DARK FISIC - Atualizacao
cd /d "%~dp0"

echo.
echo   ============================================
echo     DARK FISIC - atualizacao do sistema
echo   ============================================
echo.

if not exist "%~dp0atualizar.ps1" goto faltou
if not exist "%~dp0pacote\atualizacao.json" goto faltou

set DESTINO=%~1
if defined DESTINO if "%DESTINO:~-1%"=="\" set DESTINO=%DESTINO:~0,-1%
rem caminho completo: o cmd procura primeiro na pasta atual, e aqui ela vem de um zip
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0atualizar.ps1" -Destino "%DESTINO%"
set CODIGO=%ERRORLEVEL%

echo.
if "%CODIGO%"=="0" echo   Tudo certo. Pode fechar esta janela.
if "%CODIGO%"=="2" echo   O sistema ja esta nesta versao ou em uma mais nova.
if "%CODIGO%"=="3" echo   Esta atualizacao nao serve: use o instalador completo.
if "%CODIGO%"=="4" echo   O arquivo chegou corrompido. Baixe o zip de novo.
if "%CODIGO%"=="5" echo   Algo deu errado e eu voltei a versao anterior. Nada foi perdido.
if "%CODIGO%"=="1" echo   Nao deu para atualizar. O motivo esta acima e no log.
echo.
echo   Registro: %LOCALAPPDATA%\DarkFisic\logs\atualizacao.log
echo.
pause
exit /b %CODIGO%

:faltou
echo   Faltam arquivos aqui do lado.
echo.
echo   Extraia o zip INTEIRO em uma pasta (botao direito ^> Extrair tudo)
echo   e rode o ATUALIZAR.bat de dentro dela.
echo.
pause
exit /b 1
