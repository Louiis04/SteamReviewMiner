# Usa uma imagem base Node.js
FROM node:20-alpine

# Cria o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia package.json e package-lock.json para instalar dependências
# Isso usa o cache do Docker se as dependências não mudarem
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta que a aplicação escuta (3000)
EXPOSE 3000

# Comando para rodar a aplicação
CMD [ "npm", "start" ]