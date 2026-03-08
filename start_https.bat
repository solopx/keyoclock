@echo off
chcp 65001 > nul
echo =================================================
echo   Key O'Clock - Modo HTTPS
echo =================================================
echo.

where python > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado no PATH.
    echo        Instale o Python em https://python.org e tente novamente.
    echo.
    pause
    exit /b 1
)

echo Na primeira execucao, o certificado sera gerado em:
echo   instance\certs\cert.pem
echo.
echo AVISO: O browser exibira um aviso de seguranca.
echo        Clique em Avancado e depois em Prosseguir.
echo.
echo Pressione Ctrl+C para encerrar a aplicacao.
echo =================================================
echo.

set HTTPS_MODE=1
python "%~dp0app.py"

echo.
echo Aplicacao encerrada.
pause
