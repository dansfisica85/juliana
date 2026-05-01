# Juliana Balbino — Moda, Bem-estar e Qualidade de Vida

Site dinâmico (Node/Express + Turso/libSQL) com:

- 🎨 Paleta de outono extraída de `img/outonoCores.jpeg` e logo em `img/logo.jpeg`.
- 🔐 Painel administrativo com login/senha real e troca de credenciais.
- 🖼️ Substituição de **qualquer foto/vídeo** dos cards por upload, biblioteca local
  ou busca no Pexels.
- 🎬 Vídeos da pasta `jubalbinodeoliveira/` viram **fundo silencioso em loop**
  dos cards/heroes.
- ⭐ Fotos com **roupas escuras** (nome contendo `preto`, `dark`, `escur`, `noite`)
  ganham realce automático no site.
- 🌍 Galeria curada Pexels (Milão, Paris, Nova York, jovens fashion, lugares fashion).
- 📩 Formulário de inscrição salvo no banco (com fallback em `localStorage`).
- ◆ Botão admin **discreto** no canto superior direito de toda página.

## Pré-requisitos

- Node.js 18.17+ (usa `fetch` nativo).
- Conta no [Turso](https://turso.tech) (gratuito) — opcional, cai em SQLite local.
- Conta no [Pexels](https://www.pexels.com/api/) (gratuito) para a busca de imagens.

## Instalação

```bash
git clone https://github.com/dansfisica85/juliana.git
cd juliana
npm install
cp .env.example .env
# edite .env com suas credenciais reais (Turso, JWT_SECRET, Pexels)
npm start
```

Acesse `http://localhost:3000`.

### Variáveis de ambiente (`.env`)

| Variável                | Descrição                                                          |
| ----------------------- | ------------------------------------------------------------------ |
| `TURSO_DATABASE_URL`    | URL `libsql://...` do banco no Turso.                              |
| `TURSO_AUTH_TOKEN`      | Token JWT do Turso (Read/Write).                                   |
| `JWT_SECRET`            | Segredo aleatório para assinar cookies de sessão (use 64+ chars).  |
| `ADMIN_INITIAL_USER`    | Login inicial do admin (default `JulianaAdmin`).                   |
| `ADMIN_INITIAL_PASSWORD`| Senha inicial do admin (default `ModaeBemEstar2026#`).             |
| `PEXELS_API_KEY`        | Chave da API Pexels (busca de imagens — opcional).                 |
| `PORT`                  | Porta HTTP (default `3000`).                                       |
| `NODE_ENV`              | `development` ou `production`.                                     |

> **Sem `TURSO_*` definidos** o servidor cria um SQLite local em `./local.db`,
> útil para desenvolvimento offline.

## Como usar o admin

1. Clique no botão **◆** discreto no canto superior direito de qualquer página.
2. Entre com `JulianaAdmin` / `ModaeBemEstar2026#` no primeiro acesso.
3. Em **Perfil**, troque o login e/ou senha quando quiser.
4. Em **Cards do site**, troque a mídia de qualquer slot:
   - **Escolher da biblioteca** — usa fotos/vídeos enviados ou da pasta
     `jubalbinodeoliveira/`.
   - **Buscar no Pexels** — busca direta com presets para Paris/Milão/NY.
   - **Enviar arquivo** — upload imediato (PNG/JPG/WEBP/MP4/WEBM, até 100 MB).
   - **Destaque** — marca a foto como roupa escura para ganhar realce.
5. Em **Biblioteca**, gerencie todos os arquivos enviados.
6. Em **Galeria Pexels**, monte a curadoria que aparece em **Moda → Inspiração**.
7. Em **Inscrições**, veja/exporte/limpe os contatos do formulário.

## Pasta `jubalbinodeoliveira/`

Coloque aqui as fotos/vídeos da Juliana. O servidor expõe esses arquivos em
`/jubalbinodeoliveira/<nome>` e o site os distribui automaticamente:

- Fotos cujo nome contém `preto`, `dark`, `escur`, `noite`, `night` viram **destaque**.
- Vídeos (`.mp4`, `.webm`, `.mov`) viram **fundos silenciosos em loop**.
- Você também pode atribuir manualmente arquivos a slots no painel admin.

## Estrutura

```
.
├── server.js                   # Express + Turso + Auth + Uploads + Pexels
├── package.json
├── .env.example                # Modelo de configuração
├── admin.html                  # Painel administrativo
├── index.html / moda.html / bem-estar.html / qualidade-vida.html / contato.html
├── posts/                      # Posts de exemplo
├── css/styles.css              # Paleta outono + componentes
├── js/
│   ├── site-app.js             # Comportamento público + botão admin flutuante
│   ├── admin.js                # Painel admin (consome /api/*)
│   ├── form.js                 # Formulário de contato
│   ├── pexels-defaults.js      # Curadoria default (fallback)
│   └── main.js                 # (compat — vazio)
├── jubalbinodeoliveira/        # Suas mídias (gitkeep)
├── img/                        # Logo + paleta
└── uploads/                    # (gerada em runtime, gitignored)
```

## Deploy sugerido

- **Render**, **Railway**, **Fly.io** ou **VPS** (qualquer host com Node 18+).
- Configure as variáveis de ambiente no painel do provedor.
- Aponte o domínio para a porta `PORT` exposta.

## Segurança

- Senhas armazenadas com `bcrypt` (12 rounds).
- Sessão por cookie HTTP-only assinado com `JWT_SECRET`.
- Rate limit em login e em submissão do formulário.
- Uploads validados por mimetype e nome saneado.
- Token Turso e segredos **nunca** vão para o repositório (`.env` no `.gitignore`).
