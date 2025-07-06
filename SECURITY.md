# Security Policy

This document outlines the security practices and policies for the AI Task Management Assistant backend project.

## Table of Contents

- [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)
- [Security Measures](#security-measures)
- [Authentication and Authorization](#authentication-and-authorization)
- [Data Protection](#data-protection)
- [Infrastructure Security](#infrastructure-security)
- [Dependency Management](#dependency-management)
- [Security Best Practices](#security-best-practices)
- [Incident Response](#incident-response)
- [Compliance](#compliance)

## Reporting Security Vulnerabilities

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Create Public Issues

Please **DO NOT** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### 2. Report Privately

Send an email to **security@taskmanager.ai** with the following information:

- **Subject**: Security Vulnerability Report
- **Description**: Detailed description of the vulnerability
- **Steps to Reproduce**: Clear steps to reproduce the issue
- **Impact**: Potential impact and severity assessment
- **Affected Versions**: Which versions are affected
- **Suggested Fix**: If you have suggestions for fixing the issue

### 3. Response Timeline

- **Acknowledgment**: We will acknowledge receipt within 24 hours
- **Initial Assessment**: We will provide an initial assessment within 72 hours
- **Status Updates**: We will provide regular updates every 7 days
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### 4. Coordinated Disclosure

We believe in coordinated disclosure and will work with you to:
- Understand and validate the vulnerability
- Develop and test a fix
- Plan the disclosure timeline
- Provide credit for your discovery (if desired)

## Security Measures

### Authentication and Authorization

#### JWT Token Security

```typescript
// Token configuration
const JWT_CONFIG = {
  algorithm: 'HS256',
  expiresIn: '7d',
  issuer: 'ai-task-manager',
  audience: 'api-users'
};

// Token validation middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Access token required' }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!, JWT_CONFIG);
    req.user = decoded as JWTPayload;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
    });
  }
};
```

#### Password Security

- **Hashing**: Uses bcrypt with minimum 12 rounds
- **Complexity**: Enforces strong password requirements
- **Reset**: Secure password reset with time-limited tokens

```typescript
// Password hashing
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  return bcrypt.hash(password, saltRounds);
};

// Password validation
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .required()
  .messages({
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  });
```

### Input Validation and Sanitization

#### Request Validation

```typescript
// Joi validation schemas
export const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: passwordSchema,
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required()
});

// Validation middleware
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message)
        }
      });
    }
    next();
  };
};
```

#### SQL Injection Prevention

```typescript
// Using parameterized queries with Knex
const getUserById = async (id: number): Promise<User | null> => {
  const user = await db('users')
    .where('id', id)  // Parameterized query
    .first();
  
  return user || null;
};

// Never use string concatenation for queries
// ❌ Bad: `SELECT * FROM users WHERE id = ${id}`
// ✅ Good: Using parameterized queries as shown above
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

// Strict rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  skipSuccessfulRequests: true
});
```

### CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://app.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Data Protection

### Sensitive Data Handling

#### Environment Variables

```bash
# .env file (never commit to version control)
JWT_SECRET=very-long-random-string-minimum-32-characters
DB_PASSWORD=secure-database-password
OPENAI_API_KEY=sk-your-openai-key
REDIS_PASSWORD=secure-redis-password

# Use strong, unique secrets for production
# Generate secrets using: openssl rand -base64 32
```

#### Data Encryption

```typescript
import crypto from 'crypto';

// Encrypt sensitive data at rest
const encryptSensitiveData = (data: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  cipher.setAAD(Buffer.from('additional-data'));
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};
```

### Database Security

#### Connection Security

```typescript
// Database connection with SSL
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    ca: fs.readFileSync('path/to/ca-cert.pem'),
    cert: fs.readFileSync('path/to/client-cert.pem'),
    key: fs.readFileSync('path/to/client-key.pem')
  } : false,
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  }
};
```

#### Data Access Controls

```typescript
// Role-based access control
export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserById(req.user.id);
      
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Access denied'
          }
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

### File Upload Security

```typescript
import multer from 'multer';
import path from 'path';

// Secure file upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});
```

## Infrastructure Security

### Server Security

#### Firewall Configuration

```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### SSL/TLS Configuration

```nginx
# Nginx SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### Container Security

```dockerfile
# Use non-root user in Docker
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy files with proper ownership
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs
```

## Dependency Management

### Vulnerability Scanning

```bash
# Regular dependency auditing
npm audit

# Fix vulnerabilities
npm audit fix

# Manual review of high/critical vulnerabilities
npm audit --audit-level high
```

### Automated Security Updates

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    assignees:
      - "security-team"
```

### Supply Chain Security

```json
{
  "scripts": {
    "preinstall": "npm audit --audit-level high",
    "postinstall": "npm run security-check"
  }
}
```

## Security Best Practices

### 1. Principle of Least Privilege

- Database users have minimal required permissions
- API endpoints require appropriate authorization
- File system permissions are restrictive

### 2. Defense in Depth

- Multiple layers of security controls
- Input validation at multiple levels
- Network segmentation

### 3. Regular Security Reviews

- Monthly security assessments
- Quarterly penetration testing
- Annual third-party security audits

### 4. Security Monitoring

```typescript
// Security event logging
export const logSecurityEvent = (event: string, details: any, req: Request) => {
  logger.warn('Security Event', {
    event,
    details,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
};

// Failed login attempt monitoring
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export const trackFailedLogin = async (email: string, ip: string) => {
  const key = `failed_login:${email}:${ip}`;
  const attempts = await redis.incr(key);
  
  if (attempts === 1) {
    await redis.expire(key, LOCKOUT_DURATION / 1000);
  }
  
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    logSecurityEvent('ACCOUNT_LOCKOUT', { email, ip, attempts });
    throw new Error('Account temporarily locked due to failed login attempts');
  }
};
```

### 5. Secure Configuration

```typescript
// Production configuration checks
export const validateSecurityConfig = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DB_PASSWORD',
    'REDIS_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
};
```

## Incident Response

### 1. Incident Classification

- **Critical**: Data breach, system compromise
- **High**: Service disruption, authentication bypass
- **Medium**: Privilege escalation, data exposure
- **Low**: Information disclosure, minor vulnerabilities

### 2. Response Procedures

#### Immediate Response (0-1 hour)
1. Assess and contain the incident
2. Notify security team
3. Document initial findings

#### Short-term Response (1-24 hours)
1. Investigate root cause
2. Implement temporary fixes
3. Communicate with stakeholders

#### Long-term Response (1-7 days)
1. Develop permanent fixes
2. Update security measures
3. Conduct post-incident review

### 3. Communication Plan

- **Internal**: Security team, development team, management
- **External**: Affected users, regulatory bodies (if required)
- **Timeline**: Regular updates every 2-4 hours during active incidents

## Compliance

### GDPR Compliance

#### Data Protection Rights

```typescript
// Data subject rights implementation
export const handleDataDeletion = async (userId: number) => {
  const transaction = await db.transaction();
  
  try {
    // Anonymize user data instead of deletion where legally required
    await transaction('users')
      .where('id', userId)
      .update({
        email: `deleted-${userId}@example.com`,
        firstName: 'Deleted',
        lastName: 'User',
        deletedAt: new Date()
      });

    // Delete personal data from related tables
    await transaction('task_attachments')
      .where('uploaded_by', userId)
      .del();

    await transaction.commit();
    
    logSecurityEvent('DATA_DELETION', { userId });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
```

#### Data Processing Records

```typescript
// Data processing logging
export const logDataProcessing = (
  userId: number,
  operation: string,
  dataType: string,
  legalBasis: string
) => {
  logger.info('Data Processing', {
    userId,
    operation,
    dataType,
    legalBasis,
    timestamp: new Date().toISOString()
  });
};
```

### Security Standards

- **OWASP Top 10**: Regular assessment against OWASP security risks
- **ISO 27001**: Information security management practices
- **SOC 2**: Security, availability, and confidentiality controls

## Security Contact

For security-related questions or concerns:

- **Email**: security@taskmanager.ai
- **Response Time**: 24 hours for acknowledgment
- **Emergency**: For critical security issues affecting production systems

## Version History

- **v1.0.0** (2024-01-01): Initial security policy
- **v1.1.0** (2024-02-01): Added GDPR compliance section
- **v1.2.0** (2024-03-01): Enhanced incident response procedures

## Acknowledgments

We appreciate the security researchers and community members who help keep our project secure through responsible disclosure.

---

This security policy is a living document and will be updated regularly to reflect new threats, technologies, and best practices.
