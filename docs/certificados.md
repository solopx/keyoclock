# Certificados HTTPS

← [Administração](./administracao.md) | [Voltar ao índice](./index.md)

---

## Por que o navegador exibe um aviso de segurança?

Ao abrir `https://localhost:5000` pela primeira vez, o navegador exibe uma tela de aviso similar a:

> **Sua conexão não é particular** / **This connection is not private**

Isso ocorre porque o Key O'Clock usa um **certificado TLS auto-assinado** gerado automaticamente. O conteúdo da comunicação é criptografado normalmente — o aviso indica apenas que o navegador não reconhece a autoridade que emitiu o certificado, não que a conexão seja insegura.

Para prosseguir: clique em **Avançado** → **Prosseguir para localhost (não seguro)**.

> Para eliminar o aviso permanentemente, importe um certificado emitido por uma CA confiável conforme descrito nesta página.

---

## Tipos de Certificado

### 1. Auto-assinado (padrão)

Gerado automaticamente pelo Key O'Clock na primeira inicialização. Armazenado em `$KEYOCLOCK_DATA_DIR/certs/`.

| Vantagem | Desvantagem |
|----------|-------------|
| Sem configuração necessária | Aviso de segurança em todos os navegadores |
| Funciona offline | Não aceito por alguns clientes automatizados |
| Renovação automática via interface | Precisa ser aceito manualmente em cada navegador/dispositivo |

**Indicado para:** uso interno sem requisitos de confiança de terceiros, testes, homologação.

---

### 2. Certificado de CA Pública (ex: Let's Encrypt)

Emitido por uma Autoridade Certificadora reconhecida publicamente. Confiável em todos os navegadores sem configuração adicional.

| Vantagem | Desvantagem |
|----------|-------------|
| Sem aviso no navegador | Requer nome de domínio público (não funciona com `localhost`) |
| Renovação automatizável | Requer acesso à internet para emissão e renovação |

**Indicado para:** instalações acessíveis por nome de domínio (ex: `licencas.empresa.com.br`).

---

### 3. Certificado de CA Corporativa (Interna)

Emitido pela infraestrutura PKI da própria empresa. Confiável em todos os dispositivos da rede corporativa que têm a CA raiz instalada.

| Vantagem | Desvantagem |
|----------|-------------|
| Sem aviso nos dispositivos da empresa | Requer infra PKI corporativa |
| Funciona em redes internas e com `localhost` | Administrado pelo time de TI |

**Indicado para:** uso corporativo em rede interna, onde os dispositivos já confiam na CA da empresa.

---

## Confiando no Certificado Auto-Assinado (sem importar novo certificado)

Se preferir manter o certificado auto-assinado e eliminar o aviso manualmente:

### Windows — Importar no repositório de certificados

1. Exporte o certificado auto-assinado:
   - Abra `https://localhost:5000` no Chrome ou Edge
   - Clique no cadeado (ou ícone de aviso) na barra de endereços
   - **Certificado não é válido** → **Detalhes** → **Exportar**
   - Salve como arquivo `.cer`

2. Importe no repositório de certificados do Windows:
   - Execute `certmgr.msc` (Gerenciador de Certificados)
   - Navegue até **Autoridades de Certificação Raiz Confiáveis** → **Certificados**
   - **Ação** → **Todas as tarefas** → **Importar**
   - Selecione o arquivo `.cer` exportado
   - Confirme e reinicie o navegador

3. Acesse `https://localhost:5000` — o aviso não aparecerá mais neste dispositivo.

### Firefox

O Firefox mantém seu próprio repositório de certificados. Para confiar no certificado auto-assinado:

1. Acesse `https://localhost:5000`
2. Clique em **Avançado** → **Aceitar o risco e continuar**
3. O Firefox lembrará a exceção para este endereço

---

## Importando um Certificado Próprio no Key O'Clock

### Pré-requisitos

- Arquivo do certificado em formato PEM (extensão `.pem` ou `.crt`)
- Arquivo da chave privada em formato PEM (extensão `.pem` ou `.key`)
- A chave privada **não pode ter senha (passphrase)** — veja como remover abaixo se necessário
- Tamanho máximo: 64 KB por arquivo

### Passo a passo

1. Acesse **Configurações → Certificados HTTPS**
2. Selecione **Upload de certificado PEM**
3. Selecione o arquivo do certificado no campo **Certificado (.pem / .crt)**
4. Selecione o arquivo da chave privada no campo **Chave Privada (.pem / .key)**
5. Clique em **Enviar**
6. Aguarde a confirmação — os arquivos são validados e salvos imediatamente

![Upload de certificado](./img/certificados-upload.jpg)
*Formulário de upload do certificado e chave privada*

7. **Reinicie o serviço** para que o novo certificado entre em vigor:

```cmd
net stop KeyOClock
net start KeyOClock
```

### Validações realizadas no upload

| Validação | Comportamento se falhar |
|-----------|------------------------|
| Formato PEM do certificado | Erro: "Certificado inválido. Envie um arquivo PEM válido." |
| Formato PEM da chave privada | Erro: "Chave privada inválida. Envie um arquivo PEM válido (sem senha)." |
| Chave privada sem senha | Erro na validação da chave (chaves com passphrase são rejeitadas) |
| Tamanho máximo (64 KB) | Erro: "Arquivo muito grande." |

> A aplicação **não valida** se o certificado e a chave privada correspondem entre si. Certifique-se de enviar o par correto para evitar erros na inicialização do serviço.

---

## Removendo a Senha de uma Chave Privada

Se sua chave privada estiver protegida por senha, remova-a antes do upload com OpenSSL:

```bash
openssl rsa -in chave-com-senha.pem -out chave-sem-senha.pem
```

O comando solicitará a senha atual. O arquivo `chave-sem-senha.pem` gerado pode ser enviado ao Key O'Clock.

---

## Obtendo um Certificado com Let's Encrypt (Certbot)

> Requer um nome de domínio público apontando para o servidor.

```bash
# Instalar Certbot
sudo apt install certbot

# Obter certificado (modo standalone — temporariamente usa a porta 80)
sudo certbot certonly --standalone -d licencas.suaempresa.com.br

# Certificados gerados em:
# /etc/letsencrypt/live/licencas.suaempresa.com.br/fullchain.pem  ← certificado
# /etc/letsencrypt/live/licencas.suaempresa.com.br/privkey.pem    ← chave privada
```

Faça o upload dos arquivos `fullchain.pem` (certificado) e `privkey.pem` (chave privada) via **Configurações → Certificados HTTPS**.

> Let's Encrypt emite certificados com validade de **90 dias**. Configure a renovação automática com `certbot renew` e lembre-se de reiniciar o serviço após a renovação.

---

## Obtendo um Certificado de CA Corporativa

Consulte o time de TI/segurança da sua empresa. O processo típico:

1. Gere um CSR (Certificate Signing Request):

```bash
openssl req -newkey rsa:2048 -nodes -keyout chave.pem -out requisicao.csr \
  -subj "/CN=licencas.empresa.local/O=Empresa/C=BR"
```

2. Envie o arquivo `requisicao.csr` para o time de PKI interno
3. Receba o certificado assinado (`.pem` ou `.crt`)
4. Faça o upload do certificado e da chave `chave.pem` no Key O'Clock
5. Reinicie o serviço

---

## Gerando um Novo Certificado Auto-Assinado

Para regenerar o certificado auto-assinado (ex: após o vencimento):

1. Acesse **Configurações → Certificados HTTPS**
2. Clique em **Gerar novo certificado**
3. Reinicie o serviço para aplicar

O certificado anterior é substituído. Dispositivos que tinham o certificado anterior salvo manualmente precisarão aceitar o novo.

---

## Localização dos Arquivos de Certificado

| Arquivo | Caminho (instalação Windows) |
|---------|------------------------------|
| Certificado | `C:\ProgramData\Key O'Clock\certs\cert.pem` |
| Chave privada | `C:\ProgramData\Key O'Clock\certs\key.pem` ⚠ acesso restrito |

Para backup do certificado, copie ambos os arquivos. A chave privada deve ser tratada como dado confidencial — restrinja o acesso ao arquivo no nível do SO (somente o usuário do serviço).

---

← [Administração](./administracao.md) | [Voltar ao índice](./index.md)
