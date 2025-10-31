# Steam Game Reviews - Aplicação Web

Uma aplicação web completa para consultar informações de jogos da Steam, incluindo miniaturas, avaliações e comentários dos usuários. **Com sistema de cache usando PostgreSQL para reduzir chamadas à API e melhorar performance!**

## 📋 Funcionalidades

✅ **Busca por AppID**: Digite o AppID de qualquer jogo da Steam  
✅ **Miniatura do Jogo**: Exibe a imagem oficial do jogo  
✅ **Média de Avaliações**: Calcula e exibe a porcentagem de avaliações positivas  
✅ **Estatísticas Detalhadas**: Total de avaliações, positivas e negativas  
✅ **Comentários dos Usuários**: Exibe os 10 comentários mais recentes  
✅ **Carregar Mais**: Botão para carregar mais comentários (paginação)  
✅ **Múltiplos Jogos**: Compare vários jogos lado a lado  
✅ **Layout Responsivo**: Funciona perfeitamente em desktop e mobile  
✅ **Interface Moderna**: Design clean com Bootstrap 5  
✅ **Sistema de Cache PostgreSQL**: Reduz drasticamente chamadas à API Steam  
✅ **Docker Support**: Banco de dados containerizado e fácil de configurar  

## 🚀 Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **Axios** - Cliente HTTP para requisições à Steam API
- **CORS** - Permitir requisições cross-origin
- **PostgreSQL** - Banco de dados para cache
- **node-postgres (pg)** - Driver PostgreSQL
- **dotenv** - Gerenciamento de variáveis de ambiente

### Frontend
- **HTML5** - Estrutura
- **CSS3** - Estilização customizada
- **JavaScript (Vanilla)** - Lógica da aplicação
- **Bootstrap 5** - Framework CSS responsivo
- **Bootstrap Icons** - Ícones

### Infraestrutura
- **Docker & Docker Compose** - Containerização do PostgreSQL
- **PostgreSQL 15** - Banco de dados relacional

## 📦 Instalação

### Pré-requisitos
- Node.js (versão 14 ou superior)
- Docker Desktop (para o PostgreSQL)
- npm ou yarn

### Passos Rápidos

1. **Clone ou navegue até o diretório do projeto**
```powershell
cd "c:\Users\luis_\OneDrive\Área de Trabalho\SteamReview"
```

2. **Instale as dependências**
```powershell
npm install
```

3. **Configure o PostgreSQL via Docker**
```powershell
# Iniciar o container PostgreSQL
docker-compose up -d

# Verificar se está rodando
docker ps
```

4. **Configure as variáveis de ambiente**
O arquivo `.env` já está configurado com valores padrão. Edite se necessário.

5. **Inicie o servidor**
```powershell
npm start
```

Ou, para desenvolvimento com auto-reload:
```powershell
npm run dev
```

6. **Acesse a aplicação**
Abra seu navegador e acesse: `http://localhost:3000`

### 📘 Guia Detalhado

Para instruções completas sobre Docker, PostgreSQL e troubleshooting, veja:
**[DOCKER_SETUP.md](./DOCKER_SETUP.md)**

## 🎮 Como Usar

1. **Digite o AppID** de um jogo da Steam no campo de busca
   - Exemplos de AppIDs:
     - `730` - Counter-Strike: Global Offensive
     - `570` - Dota 2
     - `1091500` - Cyberpunk 2077
     - `1245620` - Elden Ring
     - `271590` - Grand Theft Auto V
     - `1938090` - Call of Duty

2. **Clique em "Buscar Jogo"** ou pressione Enter

3. **Visualize as informações**:
   - Miniatura do jogo
   - Nome do jogo
   - Porcentagem de avaliações positivas
   - Descrição geral das avaliações
   - Estatísticas detalhadas

4. **Ver Comentários**: Clique no botão "Ver Comentários" para abrir o modal com os reviews dos usuários

5. **Carregar Mais**: No modal de comentários, clique em "Carregar Mais" para ver mais reviews

6. **Adicionar Mais Jogos**: Você pode adicionar vários jogos e compará-los lado a lado

7. **Remover Jogos**: Clique no X no canto superior direito de cada card para remover

## 🏗️ Estrutura do Projeto

```
SteamReview/
├── server.js              # Servidor Express e rotas da API
├── db.js                  # Camada de banco de dados PostgreSQL
├── package.json           # Dependências e scripts
├── docker-compose.yml     # Configuração do PostgreSQL
├── init.sql               # Schema do banco de dados
├── .env                   # Variáveis de ambiente (não commitar)
├── .env.example           # Exemplo de configuração
├── README.md             # Este arquivo
├── DOCKER_SETUP.md       # Guia detalhado do Docker/PostgreSQL
└── public/               # Arquivos estáticos
    ├── index.html        # Interface principal
    ├── styles.css        # Estilos customizados
    └── script.js         # Lógica JavaScript do frontend
```

## 💾 Sistema de Cache

### Como Funciona

A aplicação usa PostgreSQL como camada de cache para **reduzir chamadas à API da Steam**:

1. **Primeira consulta**: Busca na Steam API e salva no banco
2. **Consultas seguintes**: Busca direto do banco (muito mais rápido!)
3. **Atualização automática**: Após 24h, atualiza os dados da API

### Tabelas do Banco

- **`games`**: Informações básicas (nome, imagem, desenvolvedores)
- **`review_stats`**: Estatísticas de avaliações (positivas, negativas, score)
- **`comments`**: Comentários individuais dos usuários

### Logs do Sistema

```
🌐 [API] Buscando dados da Steam API...     # Chamando API
💾 Dados salvos no banco...                  # Salvando cache
📦 [CACHE] Buscando dados do banco...        # Usando cache
```

### Benefícios do Cache

- ⚡ **Performance**: Resposta 10-100x mais rápida
- 🛡️ **Proteção**: Evita spam e rate limiting da Steam API
- 💰 **Economia**: Reduz uso de banda e recursos
- 📊 **Histórico**: Mantém dados mesmo se API ficar offline

## 🔌 Endpoints da API

### GET `/api/game/reviews/:appId`
Retorna as estatísticas gerais de avaliações do jogo.
- **Cache**: Sim (24h por padrão)
- **Parâmetros:**
  - `appId` (path) - ID do jogo na Steam

### GET `/api/game/comments/:appId`
Retorna comentários/reviews dos usuários com paginação.
- **Cache**: Sim (24h por padrão)
- **Parâmetros:**
  - `appId` (path) - ID do jogo na Steam
  - `num_per_page` (query) - Quantidade de reviews por página (padrão: 10)
  - `page` (query) - Número da página (padrão: 1)

### GET `/api/game/details/:appId`
Retorna detalhes adicionais do jogo (nome, descrição, etc).
- **Cache**: Sim (permanente até atualização manual)
- **Parâmetros:**
  - `appId` (path) - ID do jogo na Steam

### GET `/api/health`
Verifica status do servidor e banco de dados.
- **Retorna:**
  ```json
  {
    "server": "OK",
    "database": { "healthy": true, "timestamp": "..." },
    "timestamp": "..."
  }
  ```

## 🌐 APIs da Steam Utilizadas

1. **Imagem do Jogo**:
   ```
   https://cdn.akamai.steamstatic.com/steam/apps/<APPID>/capsule_184x69.jpg
   ```

2. **Avaliações/Reviews**:
   ```
   https://store.steampowered.com/appreviews/<APPID>?json=1
   ```

3. **Detalhes do Jogo**:
   ```
   https://store.steampowered.com/api/appdetails?appids=<APPID>
   ```

## 📱 Responsividade

A aplicação é totalmente responsiva e se adapta a diferentes tamanhos de tela:
- **Desktop**: Layout com 2 colunas de cards
- **Tablet**: Layout com 1-2 colunas
- **Mobile**: Layout com 1 coluna

## 🎨 Personalização

Você pode personalizar as cores e estilos editando o arquivo `public/styles.css`. As variáveis CSS principais estão definidas no `:root`:

```css
:root {
    --steam-blue: #1b2838;
    --steam-light-blue: #2a475e;
    --steam-green: #5c7e10;
    --steam-positive: #66c0f4;
}
```

## 🐛 Troubleshooting

### Erro ao buscar jogo
- Verifique se o AppID está correto
- Alguns jogos podem não ter avaliações disponíveis
- Verifique sua conexão com a internet

### Porta já em uso
Se a porta 3000 já estiver em uso, você pode alterá-la no arquivo `.env`:
```env
PORT=3001
```

### Erro de conexão com o banco
```powershell
# Verificar se o container está rodando
docker ps

# Ver logs do PostgreSQL
docker-compose logs postgres

# Reiniciar o container
docker-compose restart
```

### Resetar o banco de dados
```powershell
# Parar e remover containers + dados
docker-compose down -v

# Iniciar novamente
docker-compose up -d
```

### Servidor funciona sem banco?
Sim! Se o PostgreSQL não estiver disponível, o servidor funcionará normalmente, mas **SEM cache** (todas as requisições irão para a Steam API diretamente).

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# Porta do servidor
PORT=3000

# Configurações do PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=steamuser
DB_PASSWORD=steampass123
DB_NAME=steamreviews

# Tempo de expiração do cache (em horas)
CACHE_EXPIRATION_HOURS=24
```

### Comandos Docker Úteis

```powershell
# Iniciar PostgreSQL
docker-compose up -d

# Parar PostgreSQL
docker-compose stop

# Ver logs
docker-compose logs -f

# Acessar banco via psql
docker exec -it steam_review_db psql -U steamuser -d steamreviews

# Remover tudo (incluindo dados)
docker-compose down -v
```

## 🧪 Testando o Sistema de Cache

### 1. Primeira Consulta (Steam API)
Busque um jogo, por exemplo AppID `730`. No terminal você verá:
```
🌐 [API] Buscando dados da Steam API para AppID 730
💾 Review stats salvos no banco para AppID 730
💾 Detalhes do jogo salvos no banco para AppID 730
💾 10 novos comentários salvos no banco para AppID 730
```

### 2. Segunda Consulta (Cache)
Busque o mesmo jogo novamente. Agora você verá:
```
📦 [CACHE] Buscando dados do banco para AppID 730
📦 [CACHE] Buscando comentários do banco para AppID 730
```

**Muito mais rápido!** 🚀

### 3. Consultar Estatísticas no Banco

```powershell
docker exec -it steam_review_db psql -U steamuser -d steamreviews
```

```sql
-- Ver jogos salvos
SELECT app_id, name, updated_at FROM games;

-- Total de comentários por jogo
SELECT app_id, COUNT(*) FROM comments GROUP BY app_id;

-- Sair
\q
```

## 📄 Licença

Este projeto é livre para uso pessoal e educacional.

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir novas funcionalidades
- Melhorar a documentação
- Enviar pull requests

## 👨‍💻 Autor

Desenvolvido como projeto de exemplo para consulta da Steam API com sistema de cache PostgreSQL.

---

**Aproveite a aplicação! 🎮**
