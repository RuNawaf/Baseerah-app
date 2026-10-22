# Back end image for Render. The official Playwright image ships Chromium and its system libraries.
# Keep the tag in sync with the "playwright" version in server/package.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --omit=dev

COPY server/src server/src

USER pwuser
EXPOSE 4000
CMD ["node", "server/src/index.js"]