FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm
USER root
RUN npm install --global --force pnpm@11.25.0 \
    && apt-get update && apt-get install -y --no-install-recommends python3-venv \
    && rm -rf /var/lib/apt/lists/*
USER node
