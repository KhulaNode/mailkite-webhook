FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node index.js ./
USER node
EXPOSE 3005
CMD ["node", "index.js"]
