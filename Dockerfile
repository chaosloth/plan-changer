# syntax=docker/dockerfile:1

# Alpine-based Node image
FROM node:lts-alpine

# Install required packages:
# - bash: downgrade-plan.sh uses bash features
# - dcron: lightweight cron daemon on Alpine
# - tzdata: optional, for timezone support via TZ env
RUN apk add --no-cache bash dcron tzdata

# Work in the same path the project expects
WORKDIR /home/cc/plan-changer

# Copy only manifests first for better layer caching
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy the rest of the project
COPY . .

# Build TS -> dist, ensure scripts are executable, and provide /usr/bin/node symlink
# The script calls /usr/bin/node, while Node in this image installs to /usr/local/bin/node
RUN npm run build \
  && npm prune --omit=dev \
  && chmod +x /home/cc/plan-changer/downgrade-plan.sh /home/cc/plan-changer/docker/entrypoint.sh \
  && ln -sf /usr/local/bin/node /usr/bin/node

# Install crontab to run daily at 23:45 (11:45 PM)
COPY docker/crontab /etc/crontabs/root

# Start cron in foreground
ENTRYPOINT ["sh", "/home/cc/plan-changer/docker/entrypoint.sh"]
