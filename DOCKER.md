# Docker Deployment Guide

This guide explains how to deploy the Launtel Plan Manager using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, but recommended)
- A `.env` file with your Launtel credentials

## Quick Start with Docker Compose

1. **Create a `.env` file** in the project root with your Launtel credentials:

```bash
BASE=https://residential.launtel.net.au
USERNAME=your_email@example.com
PASSWORD=your_password
USER_ID=your_user_id
SERVICE_ID=your_service_id
AVC_ID=your_avc_id
LOC_ID=your_loc_id
DISCOUNT_CODE=
TIMEOUT_MS=15000
```

2. **Build and start the container**:

```bash
docker-compose up -d
```

3. **Access the application**:

Open your browser and navigate to http://localhost:3000

4. **View logs**:

```bash
docker-compose logs -f
```

5. **Stop the container**:

```bash
docker-compose down
```

## Manual Docker Build

If you prefer not to use Docker Compose:

1. **Build the image**:

```bash
docker build -t launtel-plan-manager .
```

2. **Create data directory**:

```bash
mkdir -p data
```

3. **Run the container**:

```bash
docker run -d \
  --name plan-changer \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  --restart unless-stopped \
  launtel-plan-manager
```

4. **View logs**:

```bash
docker logs -f plan-changer
```

5. **Stop the container**:

```bash
docker stop plan-changer
docker rm plan-changer
```

## Architecture

The Docker image uses a multi-stage build process:

1. **deps stage**: Installs dependencies
2. **builder stage**: Builds the Next.js application
3. **runner stage**: Creates a minimal production image

### Key Features

- **Standalone output**: Next.js standalone mode for minimal image size
- **Non-root user**: Runs as `nextjs` user (UID 1001) for security
- **Data persistence**: SQLite database stored in `/app/data` volume
- **Health checks**: Automatic health monitoring
- **Auto-restart**: Configured to restart automatically unless stopped

## Data Persistence

The SQLite database is stored in the `data/` directory and is mounted as a Docker volume. This ensures:

- Settings persist across container restarts
- Schedules are preserved
- Logs are retained

**Important**: Back up the `data/` directory regularly to prevent data loss.

## Environment Variables

All environment variables can be set in the `.env` file or passed directly to Docker:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BASE` | Yes | - | Launtel base URL |
| `USERNAME` | Yes | - | Your Launtel email |
| `PASSWORD` | Yes | - | Your Launtel password |
| `USER_ID` | Yes | - | Your Launtel user ID |
| `SERVICE_ID` | Yes | - | Your service ID |
| `AVC_ID` | Yes | - | Your AVC ID |
| `LOC_ID` | Yes | - | Your location ID |
| `DISCOUNT_CODE` | No | - | Optional discount code |
| `TIMEOUT_MS` | No | 15000 | Request timeout in milliseconds |
| `PORT` | No | 3000 | Port to run the server on |
| `NODE_ENV` | No | production | Node environment |

## Troubleshooting

### Container won't start

Check the logs:
```bash
docker-compose logs
```

### Database permissions

If you see database permission errors, ensure the `data/` directory is writable:
```bash
chmod 755 data/
```

### Port already in use

If port 3000 is already in use, change it in `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Use port 8080 instead
```

### Reset database

To start fresh, remove the database file:
```bash
rm -f data/plan-changer.db
docker-compose restart
```

## Upgrading

To upgrade to a new version:

1. Pull the latest code
2. Rebuild the image:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Security Notes

- The container runs as a non-root user (`nextjs`)
- Credentials are stored in environment variables (consider using Docker secrets in production)
- The application uses HTTPS for all external requests
- SQLite database is stored in a mounted volume with appropriate permissions

## Production Deployment

For production deployments, consider:

1. **Use Docker secrets** instead of environment variables for credentials
2. **Set up reverse proxy** (nginx, Caddy) with HTTPS
3. **Configure automatic backups** for the `data/` directory
4. **Monitor logs** using a centralized logging solution
5. **Use health checks** to automatically restart failed containers
6. **Limit resources** using Docker resource constraints

Example with resource limits:
```yaml
services:
  plan-changer:
    # ... other config ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```
