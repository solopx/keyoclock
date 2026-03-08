# Key O'Clock

**Gerenciamento e monitoramento de licenças de software para ambientes corporativos.**

![Logo Key O'Clock](./img/logo.png)

> Versão atual: `v2.0-pre-release`

---

## Sobre

Key O'Clock é uma aplicação web para centralizar o controle de licenças de software corporativas. Permite cadastrar o inventário de ativos (grupos, listas e itens), associar licenças com datas de validade, monitorar o status de cada licença em tempo real e receber alertas automáticos por e-mail antes dos vencimentos.

![Dashboard principal](./img/operacao-dashboard.jpg)
*Visão geral do dashboard com cards executivos, status das licenças e widget de próximo vencimento*

---

## Módulos

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | Totais executivos, saúde por faixa de vencimento e widget de próximo vencimento |
| **Inventário** | Estrutura em árvore: Grupo → Lista → Item |
| **Licenças** | CRUD de licenças com status automático por prazo |
| **Contratos** | Agrupamento de licenças por contrato, com totais e vencimentos |
| **Relatórios** | Gráficos, tabelas e exportação XLSX/PDF por validade, contrato e grupo |
| **Agendamentos** | Envio automático de relatórios e alertas por e-mail |
| **Auditoria** | Log completo de ações dos usuários |
| **Personalização** | Temas, estilos de widget e tamanho de fonte por usuário |
| **Administração** | Usuários, HTTPS, SMTP, criptografia e banco de dados |

---

## Navegação da Wiki

- [Instalação](./instalacao.md) — Como instalar via instalador Windows ou Python diretamente
- [Funcionalidades](./funcionalidades.md) — Descrição detalhada de cada módulo
- [Guia de Operação](./operacao.md) — Passo a passo para uso diário
- [Personalização](./personalizacao.md) — Temas, widgets e preferências do usuário
- [Administração](./administracao.md) — Configurações de sistema (admin)
- [Certificados HTTPS](./certificados.md) — Tipos de certificado, avisos do navegador e como importar certificados
- [Arquitetura](./arquitetura.md) — Como a aplicação funciona internamente

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.11+, Flask 3, Werkzeug |
| Banco de dados | SQLite (sem ORM, WAL mode) |
| Servidor HTTPS | cheroot + BuiltinSSLAdapter |
| Agendamento | APScheduler 3 (BackgroundScheduler) |
| Exportação | openpyxl (XLSX), reportlab (PDF) |
| Criptografia | cryptography — Fernet AES-128 + PBKDF2-SHA256 |
| Frontend | Vanilla JS (SPA), CSS custom properties |
| Tipografia | IBM Plex Sans + IBM Plex Mono (self-hosted) |

---

## Início Rápido

```bash
pip install -r requirements.txt
python app.py
# Acesse: http://localhost:5000
# Usuário: admin
# Senha: admin
```

> **No primeiro login, a troca de senha é obrigatória.** Escolha uma senha segura com no mínimo 8 caracteres.
