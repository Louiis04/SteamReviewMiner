# Steam Review Miner

Aplicação full-stack que coleta métricas e comentários da Steam Store para facilitar análises rápidas de jogos. O backend Express centraliza o cache em PostgreSQL e expõe uma API REST, enquanto o frontend em React + Vite oferece as telas **Início** (busca/análise pontual) e **Top Jogos** (ranking filtrável com paginação e modal de comentários).

## Estrutura do Projeto

```
SteamReviewMiner/
├─ backend/           # API Express + integração Steam + PostgreSQL
├─ frontend/          # Aplicação React (Vite)
├─ public/            # Legado estático; referência para assets/estilos
├─ docker-compose.yml # Serviço PostgreSQL pronto para desenvolvimento
└─ README.md          # Este arquivo
```

## Pré-requisitos

- Node.js 20+ e npm 10+
- PostgreSQL 15 (use `docker-compose` para subir rapidamente)
- Steam acessível na rede (as chamadas usam endpoints públicos)

## Configuração Rápida

1. **Clonar e instalar dependências**
   ```powershell
   cd backend; npm install
   cd ../frontend; npm install
   ```

2. **Configurar variáveis**
   ```powershell
   cd backend
   copy .env.example .env  # ajuste as credenciais conforme necessário
   ```

3. **Subir PostgreSQL via Docker (opcional, porém recomendado)**
   ```powershell
   docker-compose up -d postgres
   ```

4. **Executar backend em modo dev**
   ```powershell
   cd backend
   npm run dev   # porta padrão 3000
   ```

5. **Executar frontend com Vite**
   ```powershell
   cd frontend
   npm run dev   # porta padrão 5173 com proxy automático para http://localhost:3000/api
   ```

O Vite já está configurado para encaminhar requisições começadas em `/api` ao backend (configurável via `VITE_PROXY_TARGET`). Em produção, o build React é servido pelo próprio Express.

## Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável              | Descrição                                   | Default          |
| --------------------- | ------------------------------------------- | ---------------- |
| `PORT`                | Porta HTTP do Express                       | `3000`           |
| `DB_HOST/PORT/NAME`   | Atenção às credenciais do PostgreSQL        | vide `.env.example` |
| `DB_USER/DB_PASSWORD` | Usuário de banco                            | `steamuser/steampass123` |
| `CACHE_EXPIRATION_HOURS` | Validade dos dados persistidos          | `24`             |

### Frontend (`frontend/.env` opcional)

| Variável             | Descrição                                                                   | Default |
| -------------------- | --------------------------------------------------------------------------- | ------- |
| `VITE_API_BASE_URL`  | URL base usada pelos fetchs. Use quando backend estiver em outro domínio.   | `/api`  |
| `VITE_PROXY_TARGET`  | Destino do proxy do Vite durante o desenvolvimento.                         | `http://localhost:3000` |

## Scripts Importantes

| Local      | Comando           | Descrição                                           |
| ---------- | ----------------- | --------------------------------------------------- |
| `backend`  | `npm run dev`     | Nodemon + Express com hot-reload                    |
| `backend`  | `npm start`       | Servidor Express em modo produção                   |
| `frontend` | `npm run dev`     | Vite com HMR e proxy `/api`                         |
| `frontend` | `npm run build`   | Build otimizado para servir via Express             |
| `frontend` | `npm run preview` | Prévia local do build                               |

## Fluxo de Build/Produção

1. `cd frontend && npm run build` gera `frontend/dist`.
2. `cd backend && npm start` detecta automaticamente o diretório `dist` e serve os arquivos estáticos, mantendo as rotas `/api` disponíveis.
3. Opcional: hospede apenas o backend (com Node + PostgreSQL) e use um reverse proxy (NGINX/Caddy) apontando para ele.

## Funcionalidades

- **Busca rápida** por nome ou AppID com autocomplete e cache local.
- **Painel de comparação** mostrando score geral, positivos/negativos e modal de comentários.
- **Busca por palavras-chave** em comentários, com destaque no modal e ranking de relevância.
- **Top Jogos** em `/top`: filtros de ordenação, mínimo de reviews, opções de limite/todos, paginação amigável e botão para pré-carregar o banco.
- **Comentários detalhados** com paginação via cursor, contadores e destaques visuais.

## Banco de Dados + Docker

O arquivo `docker-compose.yml` expõe um contêiner Postgres 15 já configurado com:

```
POSTGRES_USER=steamuser
POSTGRES_PASSWORD=steampass123
POSTGRES_DB=steamreviews
```

O script `backend/init.sql` cria as tabelas necessárias no primeiro start do contêiner. Ajuste credenciais conforme o seu ambiente e sincronize com o `.env` do backend.

## Endpoints Principais da API

- `GET /api/search?q=term`
- `GET /api/game/reviews/:appId`
- `GET /api/game/comments/:appId`
- `GET /api/game/details/:appId`
- `GET /api/search/keywords?keywords=a,b`
- `GET /api/top-games?sort=rating&min_reviews=100&limit=50`
- `GET /api/preload?limit=100`

Todos os endpoints são consumidos pelo frontend, mas podem ser utilizados por outras integrações.

## Dicas de Desenvolvimento

- Defina `VITE_API_BASE_URL` apenas quando o frontend precisar falar com um backend externo (por exemplo, deploy em domínios diferentes). Localmente, o valor padrão `/api` funciona com o proxy.
- O hook `useAlerts` centraliza toasts com auto-dismiss; aproveite-o em novas páginas.
- O backend já serve `frontend/dist` automaticamente: não é necessário mexer em `server.js` ao gerar novos builds.
- Mantenha o banco populado usando o botão "Pré-carregamento" na página Top Jogos ou executando `GET /api/preload` manualmente.

Bom desenvolvimento! 🎮
