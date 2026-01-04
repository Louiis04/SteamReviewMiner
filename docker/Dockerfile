# Usa uma imagem base Node.js
FROM node:20-alpine

# Cria o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia package.json e package-lock.json do backend para instalar dependências
# Isso usa o cache do Docker se as dependências não mudarem
COPY ./backend/package*.json ./

# Instala as dependências do backend
RUN npm install

# Copia o restante do código da aplicação (apenas backend)
COPY ./backend .

# Copia os assets estáticos do frontend usados pelo servidor
COPY ./frontend ./../frontend

# Expõe a porta que a aplicação escuta (3000)
EXPOSE 3000

# Comando para rodar a aplicação
CMD [ "npm", "start" ]