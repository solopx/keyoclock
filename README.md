# Key O'Clock

### [Read this in english](README.en.md)

> **Porque licença vencida não avisa — ela simplesmente para o seu negócio.**

![Logo Key O'Clock](./docs/img/logo.png)

O Key O'Clock é o seu centro de comando para gestão de ativos e licenças de software. Chega de planilhas de Excel perdidas, post-its colados no monitor ou aquele frio na barriga quando um software crítico para de funcionar porque alguém esqueceu de renovar o contrato.

---
## Latest Release: v1.0 (Production Ready)

Estamos oficialmente em produção! A versão v1.0 do Key O'Clock consolida a base de segurança e estabilidade necessária para o ambiente corporativo.

---

## Por que usar?

| | |
|---|---|
| **Visibilidade Total** | Saiba exatamente o que você tem, onde está e quanto custa. |
| **Zero Sustos** | Alertas visuais e por e-mail que te avisam muito antes do prazo acabar. |
| **Relatórios Reais** | Exporte dados mastigados para reuniões de diretoria em segundos. |
| **Privacidade Levada a Sério** | Criptografia de nível bancário para seus dados sensíveis. |

---

## O que ele faz por você

### Inventário Inteligente
Organize tudo em uma estrutura de árvore **(Grupo → Lista → Item)**. É intuitivo como uma pasta de arquivos, mas com o poder de um banco de dados. Esqueceu de algo? O soft delete mantém seus dados em uma "quarentena" antes de sumirem para sempre.

### Semáforo de Saúde (Status Automático)
O sistema trabalha por você, classificando suas licenças em tempo real:

| | |
|---|---|
| 🟣 **Expirada** | Aqui você tem um problema! |
| 🔴 **Crítica** (≤30 dias) | Hora de abrir o processo de compra. |
| 🟠 **Atenção / Em breve** (≤60 dias)| No seu radar, sem pressa. |
| 🟢 **Válida / Perpétua** (>90 dias)| Durma tranquilo. |

### Dashboard Executivo & Widgets Estilosos
Não é só funcional — é bonito. Acompanhe a saúde do seu parque de software com gráficos claros e o nosso famoso e patenteado **Widget de Próximo Vencimento**.

Escolha seu estilo: Do clássico **Odômetro** ao nostálgico **Digital**, ou até uma **Ampulheta** para os mais dramáticos. São 9 estilos no total.

![widgets](docs\img\personalizacao-widget.gif)

### O "Assistente Virtual" que Não Dorme
O Key O'Clock envia relatórios e alertas automáticos diretamente para o seu e-mail:

- **Relatório Periódico** — Um PDF completo no seu e-mail a cada X dias.
- **Ronda Diária** — "Ei, estas 3 licenças entram em estado crítico hoje."
- **Lembrete de Expiração** — Para você não esquecer de limpar o que já passou.

---

## Configuração a Jato

### Download & Install

Para baixar a versão estável:

**Download do instalador:** (https://github.com/solopx/keyoclock/releases/download/v1.0.0-Windows/KeyOClock-Setup-v1.0.exe)

Ou se preferir pode clonar o repositório e rodar localmente.

Se você já tem o Python instalado, está a 3 comandos de distância:

```bash
# 1. Prepare o terreno
pip install -r requirements.txt

# 2. Dê o play (modo HTTP)
python app.py

# 3. Quer segurança máxima? (modo HTTPS)
start_https.bat          # Windows
HTTPS_MODE=1 python app.py  # Linux
```

Acesso padrão: `http://localhost:5000` | Usuário: `admin` | Senha: `admin`

> Troca de senha obrigatória no primeiro acesso!

---

## Segurança e Privacidade

O Key O'Clock utiliza **Fernet (AES-128 + HMAC-SHA256)** para proteger campos sensíveis como contratos e senhas SMTP. A chave é configurada em **Configurações → Banco de Dados → Criptografia**.

> **⚠ Nota de responsabilidade:**
> A chave de criptografia fica com **você**. Se perdê-la, nem a NASA recupera os dados.
> Guarde seu arquivo `.enc_key` como se fosse ouro — e faça backup junto com o banco `keyoclock.db`.

---

## Personalize até o Cansaço

Cada usuário tem seu gosto. Por isso, oferecemos:

- **7 Temas** — incluindo o nostálgico Windows XP e o elegante Midnight.
- **9 Estilos de Widget** — Anel, Arco, Barra, Minimal, Digital, Clássico, Ampulheta, Odômetro, Flip.
- **3 Tamanhos de Fonte** — tudo salvo localmente, sem precisar reconfigurar a cada sessão.

---

## Para os Devs

### Estrutura do projeto

```
keyoclock/
├── app.py
├── run.py
│
├── database/
│   ├── db.py
│   ├── auth.py
│   ├── helpers.py
│   ├── certs.py
│   ├── ratelimit.py
│   ├── scheduler.py
│   └── email_utils.py
│
├── routes/
│   ├── auth.py
│   ├── views.py
│   ├── api_stats.py
│   ├── api_inventory.py
│   ├── api_licenses.py
│   ├── api_reports.py
│   ├── api_users.py
│   ├── api_certificates.py
│   ├── api_email.py
│   ├── api_database.py
│   ├── api_audit.py
│   └── api_schedule.py
│
├── templates/
│   ├── app.html
│   └── login.html
│
├── static/
│   ├── css/app.css
│   ├── fonts/
│   ├── images/
│   └── js/
│       ├── app.js, api.js, theme.js, ui.utils.js
│       ├── ui.dashboard.js, ui.inventory.js, ui.licenses.js
│       ├── ui.reports.js, ui.contracts.js, ui.admin.js
│       ├── ui.certificates.js, ui.email.js, ui.database.js
│       ├── ui.schedule.js, ui.audit.js
│
├── docs/
└── requirements.txt
```

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `KEYOCLOCK_DATA_DIR` | `./instance/` | Diretório de dados (banco, chaves, certs, logs) |
| `SECRET_KEY` | gerado automaticamente | Flask session secret key |
| `HTTPS_MODE` | não definido | Ativa modo HTTPS com cheroot + TLS |
| `PORT` | `5000` | Porta do servidor |
| `HOST` | `0.0.0.0` | Interface de escuta |
| `DISABLE_SCHEDULER` | não definido | `'1'` desativa APScheduler (obrigatório em gunicorn `-w N`) |

```bash
# Produção Linux
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export KEYOCLOCK_DATA_DIR=/var/lib/keyoclock
export HTTPS_MODE=1
python app.py
```

> **Múltiplos workers (gunicorn -w N):** defina `DISABLE_SCHEDULER=1` em todos os workers — caso contrário, cada worker dispara seus próprios envios e os e-mails chegam duplicados.

### Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.11+, Flask 3, Werkzeug |
| Banco | SQLite (WAL mode, sem ORM) |
| Servidor HTTPS | cheroot + BuiltinSSLAdapter |
| Agendamento | APScheduler 3 (BackgroundScheduler) |
| Exportação | openpyxl (XLSX), reportlab (PDF) |
| Criptografia | cryptography — Fernet AES-128, PBKDF2-SHA256 |
| Frontend | Vanilla JS (SPA), CSS custom properties |
| Tipografia | IBM Plex Sans + IBM Plex Mono (self-hosted) |
