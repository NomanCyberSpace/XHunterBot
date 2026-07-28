FROM node:18-bullseye-slim

# Install system dependencies required by media & scraper libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    webp \
    git \
    python3 \
    make \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy dependency graphs first to leverage Docker layer caching
COPY package*.json ./

# Install packages clean
RUN npm install

# Copy application source code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]