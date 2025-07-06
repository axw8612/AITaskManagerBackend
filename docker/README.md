# Docker Configuration

This directory contains Docker configuration files for the AI Task Management Assistant backend.

## Docker Compose Setup

### Development Environment

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Main application
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    command: npm run dev

  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: taskmanager_dev
      POSTGRES_USER: taskmanager_user
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  # Redis cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data
    ports:
      - "6379:6379"

  # Database administration
  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@taskmanager.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "8080:80"
    depends_on:
      - postgres

volumes:
  postgres_dev_data:
  redis_dev_data:
```

### Production Environment

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Main application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: taskmanager_prod
      POSTGRES_USER: taskmanager_user
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - postgres_password
    restart: unless-stopped

  # Redis cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass_file /run/secrets/redis_password
    volumes:
      - redis_data:/data
    secrets:
      - redis_password
    restart: unless-stopped

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - app
    restart: unless-stopped

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  redis_password:
    file: ./secrets/redis_password.txt

volumes:
  postgres_data:
  redis_data:
```

## Dockerfiles

### Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
```

### Production Dockerfile

```dockerfile
# Dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create necessary directories
RUN mkdir -p logs uploads && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

## Docker Ignore

```dockerfile
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.*.local
.nyc_output
coverage
.vscode
.idea
*.log
dist
logs/*
!logs/.gitkeep
uploads/*
!uploads/.gitkeep
.DS_Store
*.md
Dockerfile*
docker-compose*
.dockerignore
```

## Nginx Configuration

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        text/javascript
        text/xml
        text/css
        text/plain;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # HTTP redirect to HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/certificate.crt;
        ssl_certificate_key /etc/nginx/ssl/private.key;

        # HSTS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

        # Main application
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 86400;
            
            # Rate limiting
            limit_req zone=api burst=20 nodelay;
        }

        # Auth endpoints with stricter rate limiting
        location /api/auth {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Strict rate limiting for auth
            limit_req zone=auth burst=10 nodelay;
        }

        # Socket.IO
        location /socket.io/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://app;
            access_log off;
        }

        # Static files (if any)
        location /static/ {
            alias /app/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Docker Scripts

### Build Script

```bash
#!/bin/bash
# scripts/docker-build.sh

set -e

echo "Building Docker images..."

# Build development image
docker build -f Dockerfile.dev -t ai-task-manager:dev .

# Build production image
docker build -f Dockerfile -t ai-task-manager:latest .

echo "Docker images built successfully!"
```

### Deploy Script

```bash
#!/bin/bash
# scripts/docker-deploy.sh

set -e

ENVIRONMENT=${1:-development}

echo "Deploying to $ENVIRONMENT environment..."

if [ "$ENVIRONMENT" = "production" ]; then
    # Production deployment
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml pull
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    sleep 30
    
    # Run migrations
    docker-compose -f docker-compose.prod.yml exec app npm run migrate
    
    echo "Production deployment completed!"
else
    # Development deployment
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml up -d
    
    # Wait for services to be ready
    sleep 15
    
    # Run migrations
    docker-compose -f docker-compose.dev.yml exec app npm run migrate
    
    echo "Development deployment completed!"
fi
```

### Health Check Script

```bash
#!/bin/bash
# scripts/docker-health.sh

set -e

ENVIRONMENT=${1:-development}

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.dev.yml"
fi

echo "Checking health of $ENVIRONMENT environment..."

# Check if services are running
docker-compose -f $COMPOSE_FILE ps

# Check application health
echo "Checking application health..."
curl -f http://localhost:3000/health || exit 1

echo "All services are healthy!"
```

## Environment Variables

### Development (.env.dev)

```env
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000/api

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=taskmanager_dev
DB_USER=taskmanager_user
DB_PASSWORD=dev_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=development-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Bcrypt
BCRYPT_ROUNDS=10

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# Logging
LOG_LEVEL=debug
```

### Production (.env.prod)

```env
NODE_ENV=production
PORT=3000
API_BASE_URL=https://your-domain.com/api

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=taskmanager_prod
DB_USER=taskmanager_user
DB_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Bcrypt
BCRYPT_ROUNDS=12

# OpenAI
OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_MODEL=gpt-4

# Email
EMAIL_HOST=${EMAIL_HOST}
EMAIL_PORT=${EMAIL_PORT}
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}
EMAIL_FROM=${EMAIL_FROM}

# Logging
LOG_LEVEL=info
SEQ_SERVER_URL=${SEQ_SERVER_URL}
SEQ_API_KEY=${SEQ_API_KEY}
```

## Usage Instructions

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/ai-task-manager-backend.git
   cd ai-task-manager-backend
   ```

2. **Start development environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Run migrations**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app npm run migrate
   ```

4. **Seed database**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app npm run seed
   ```

5. **View logs**
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f app
   ```

### Production Deployment

1. **Prepare secrets**
   ```bash
   mkdir -p secrets
   echo "your-postgres-password" > secrets/postgres_password.txt
   echo "your-redis-password" > secrets/redis_password.txt
   ```

2. **Deploy to production**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Monitor deployment**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

### Useful Commands

```bash
# View running containers
docker-compose ps

# Execute command in container
docker-compose exec app npm run test

# View logs
docker-compose logs -f app

# Restart specific service
docker-compose restart app

# Scale application
docker-compose up --scale app=3

# Stop all services
docker-compose down

# Remove volumes (careful!)
docker-compose down -v
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   # Kill the process or change port in docker-compose.yml
   ```

2. **Database connection issues**
   ```bash
   # Check database logs
   docker-compose logs postgres
   # Verify connection
   docker-compose exec postgres psql -U taskmanager_user -d taskmanager_dev
   ```

3. **Redis connection issues**
   ```bash
   # Check Redis logs
   docker-compose logs redis
   # Test connection
   docker-compose exec redis redis-cli ping
   ```

4. **Application won't start**
   ```bash
   # Check application logs
   docker-compose logs app
   # Verify environment variables
   docker-compose exec app env
   ```

### Performance Optimization

1. **Multi-stage builds** - Use multi-stage Dockerfiles to reduce image size
2. **Layer caching** - Order Dockerfile instructions to maximize cache hits
3. **Resource limits** - Set appropriate CPU and memory limits
4. **Health checks** - Implement proper health check endpoints
5. **Log rotation** - Configure log rotation to prevent disk space issues

This Docker configuration provides a complete containerized environment for the AI Task Management Assistant backend, suitable for both development and production deployments.
