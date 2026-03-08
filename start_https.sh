#!/bin/bash
echo "================================================="
echo "  Key O'Clock - Modo HTTPS"
echo "================================================="
echo ""

PYTHON=""
if command -v python3 &> /dev/null; then
    PYTHON="python3"
elif command -v python &> /dev/null; then
    PYTHON="python"
else
    echo "[ERRO] Python nao encontrado."
    echo "       Instale com: sudo apt install python3"
    exit 1
fi

echo "Na primeira execucao, o certificado sera gerado em:"
echo "  instance/certs/cert.pem"
echo ""
echo "AVISO: O browser exibira um aviso de seguranca."
echo "       Clique em Avancado e depois em Prosseguir."
echo ""
echo "Pressione Ctrl+C para encerrar a aplicacao."
echo "================================================="
echo ""

export HTTPS_MODE=1
$PYTHON "$(dirname "$0")/app.py"
