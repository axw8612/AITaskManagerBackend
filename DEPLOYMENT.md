# Deployment Guide

This guide provides comprehensive instructions for deploying the AI Task Management Assistant backend to various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Monitoring and Logging](#monitoring-and-logging)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- PostgreSQL 12 or higher
- Redis 6.0 or higher
- SSL certificates for HTTPS (production)
- SEQ logging server (optional)

## Environment Configuration

### 1. Production Environment Variables

Create a `.env` file in the root directory with the following production values:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=https://your-domain.com/api

# Database Configuration
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=taskmanager_prod
DB_USER=your-db-user
DB_PASSWORD=your-secure-db-password

# Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Security
JWT_SECRET=your-very-secure-jwt-secret-key-minimum-32-characters
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# Email Configuration (for password reset)
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-email-password
EMAIL_FROM=noreply@your-domain.com

# SEQ Logging (optional)
SEQ_SERVER_URL=https://your-seq-server.com
SEQ_API_KEY=your-seq-api-key

# File Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain
```

### 2. Environment-Specific Configurations

#### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
```

#### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
```

#### Production
```env
NODE_ENV=production
LOG_LEVEL=error
```

## Database Setup

### 1. PostgreSQL Setup

#### Create Database and User
```sql
-- Connect as postgres superuser
CREATE DATABASE taskmanager_prod;
CREATE USER taskmanager_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE taskmanager_prod TO taskmanager_user;

-- Connect to the database
\c taskmanager_prod;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO taskmanager_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taskmanager_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taskmanager_user;
```

#### Run Migrations
```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

### 2. Redis Setup

#### Installation (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf

# Set password
requirepass your-redis-password

# Restart Redis
sudo systemctl restart redis-server
```

## Production Deployment

### 1. Server Setup

#### Install Node.js
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### 2. Application Deployment

#### Clone and Build
```bash
# Clone repository
git clone https://github.com/your-repo/ai-task-management-backend.git
cd ai-task-management-backend

# Install dependencies
npm install

# Build application
npm run build

# Copy environment file
cp .env.example .env
# Edit .env with production values
```

#### PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'ai-task-manager',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

#### Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 3. Reverse Proxy Setup (Nginx)

#### Install Nginx
```bash
sudo apt install nginx
```

#### Configure Nginx
Create `/etc/nginx/sites-available/ai-task-manager`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

#### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/ai-task-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Docker Deployment

### 1. Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

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

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

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

### 2. Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: taskmanager_prod
      POSTGRES_USER: taskmanager_user
      POSTGRES_PASSWORD: your-secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass your-redis-password
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Deploy with Docker
```bash
# Build and start services
docker-compose up -d

# Run migrations
docker-compose exec app npm run migrate

# View logs
docker-compose logs -f app
```

## Cloud Deployment

### 1. AWS Deployment

#### Using AWS ECS with Fargate

1. **Create ECR Repository**
```bash
aws ecr create-repository --repository-name ai-task-manager
```

2. **Build and Push Image**
```bash
# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account-id.dkr.ecr.us-east-1.amazonaws.com

# Build and tag image
docker build -t ai-task-manager .
docker tag ai-task-manager:latest your-account-id.dkr.ecr.us-east-1.amazonaws.com/ai-task-manager:latest

# Push image
docker push your-account-id.dkr.ecr.us-east-1.amazonaws.com/ai-task-manager:latest
```

3. **Create ECS Service**
Use AWS Console or CLI to create ECS cluster, task definition, and service.

#### Using AWS Lambda (Serverless)

Install Serverless Framework:
```bash
npm install -g serverless
```

Create `serverless.yml`:
```yaml
service: ai-task-manager

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    NODE_ENV: production
    DB_HOST: ${env:DB_HOST}
    DB_NAME: ${env:DB_NAME}
    # ... other environment variables

functions:
  app:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-offline
```

### 2. Google Cloud Platform

#### Using Google Cloud Run

1. **Build and Deploy**
```bash
# Build image
gcloud builds submit --tag gcr.io/your-project-id/ai-task-manager

# Deploy to Cloud Run
gcloud run deploy ai-task-manager \
  --image gcr.io/your-project-id/ai-task-manager \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

### 3. Digital Ocean

#### Using App Platform

Create `.do/app.yaml`:
```yaml
name: ai-task-manager
services:
- name: api
  source_dir: /
  github:
    repo: your-username/ai-task-manager
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "8080"
databases:
- name: postgres
  engine: PG
  version: "13"
- name: redis
  engine: REDIS
  version: "6"
```

## Monitoring and Logging

### 1. Application Monitoring

#### PM2 Monitoring
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart ai-task-manager
```

#### Health Checks
The application includes health check endpoints:
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with database and Redis status

### 2. Log Management

#### Log Rotation
```bash
# Install logrotate
sudo apt install logrotate

# Create logrotate config
sudo nano /etc/logrotate.d/ai-task-manager
```

```
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0640 nodejs nodejs
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. External Monitoring

#### New Relic
```bash
npm install newrelic
```

Add to top of `src/index.ts`:
```typescript
require('newrelic');
```

#### DataDog
```bash
npm install dd-trace
```

## Security Considerations

### 1. Server Security

#### Firewall Configuration
```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
```

#### Security Updates
```bash
# Enable automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 2. Application Security

#### SSL/TLS Configuration
- Use strong ciphers
- Enable HSTS
- Regular certificate renewal

#### Rate Limiting
- Implement at both Nginx and application level
- Use Redis for distributed rate limiting

#### Input Validation
- Validate all inputs
- Sanitize user data
- Use parameterized queries

### 3. Database Security

#### PostgreSQL Security
```sql
-- Create read-only user for monitoring
CREATE USER monitoring WITH PASSWORD 'monitoring-password';
GRANT CONNECT ON DATABASE taskmanager_prod TO monitoring;
GRANT USAGE ON SCHEMA public TO monitoring;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;
```

#### Redis Security
```bash
# Configure Redis security
# In /etc/redis/redis.conf:
requirepass your-redis-password
rename-command FLUSHALL ""
rename-command FLUSHDB ""
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start
```bash
# Check logs
pm2 logs ai-task-manager

# Check environment variables
pm2 env 0

# Restart application
pm2 restart ai-task-manager
```

#### 2. Database Connection Issues
```bash
# Test database connection
psql -h localhost -U taskmanager_user -d taskmanager_prod

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log
```

#### 3. Redis Connection Issues
```bash
# Test Redis connection
redis-cli -h localhost -p 6379 -a your-redis-password ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

#### 4. High Memory Usage
```bash
# Monitor memory usage
pm2 monit

# Analyze memory leaks
node --inspect dist/index.js

# Restart application
pm2 restart ai-task-manager
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM tasks WHERE user_id = 1;

-- Create indexes
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

#### 2. Redis Optimization
```bash
# Monitor Redis memory usage
redis-cli info memory

# Optimize Redis configuration
maxmemory 256mb
maxmemory-policy allkeys-lru
```

#### 3. Application Optimization
- Enable gzip compression
- Use CDN for static assets
- Implement caching strategies
- Optimize database queries

## Backup and Recovery

### 1. Database Backup
```bash
# Create backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U taskmanager_user taskmanager_prod > "$BACKUP_DIR/backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

### 2. Application Backup
```bash
# Backup application files
tar -czf /backups/app/ai-task-manager_$(date +%Y%m%d).tar.gz /path/to/app

# Backup configuration
cp /path/to/app/.env /backups/config/env_$(date +%Y%m%d)
```

### 3. Automated Backups
```bash
# Add to crontab
crontab -e

# Daily database backup at 2 AM
0 2 * * * /path/to/backup-script.sh

# Weekly application backup
0 3 * * 0 /path/to/app-backup-script.sh
```

## Scaling Considerations

### 1. Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Implement session store with Redis
- Use database connection pooling

### 2. Vertical Scaling
- Monitor CPU and memory usage
- Scale based on metrics
- Use PM2 cluster mode

### 3. Database Scaling
- Implement read replicas
- Use connection pooling
- Consider database sharding for large datasets

This deployment guide provides comprehensive instructions for deploying the AI Task Management Assistant backend in various environments. Follow the appropriate sections based on your deployment needs and infrastructure requirements.
