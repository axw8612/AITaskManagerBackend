import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Helper function to generate JWT token
const generateToken = (payload: object): string => {
  return jwt.sign(payload, config.jwt.secret, { 
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256'
  } as jwt.SignOptions);
};

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { username, email, password, first_name, last_name } = req.body;

      // Validate required fields
      if (!username || !email || !password || !first_name || !last_name) {
        throw new AppError('All fields are required', 400);
      }

      // Check if user already exists
      const existingUser = await db('users')
        .where(function() {
          this.where('email', email).orWhere('username', username);
        })
        .first();

      if (existingUser) {
        if (existingUser.email === email) {
          throw new AppError('Email already registered', 409);
        }
        if (existingUser.username === username) {
          throw new AppError('Username already taken', 409);
        }
      }

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user
      const [newUser] = await db('users')
        .insert({
          username: username.toLowerCase().trim(),
          email: email.toLowerCase().trim(),
          password_hash,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          role: 'user',
          is_active: true,
          preferences: JSON.stringify({
            theme: 'light',
            notifications: true,
            timezone: 'UTC'
          })
        })
        .returning(['id', 'username', 'email', 'first_name', 'last_name', 'role', 'created_at']);

      // Generate JWT token
      const token = generateToken({ 
        id: newUser.id, 
        email: newUser.email, 
        username: newUser.username 
      });

      logger.info(`New user registered: ${newUser.email}`);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          token,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            role: newUser.role
          }
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      // Find user by email
      const user = await db('users')
        .select('*')
        .where({ email, is_active: true })
        .first();

      if (!user) {
        throw new AppError('Invalid credentials', 401);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401);
      }

      // Generate JWT token
      const token = generateToken({ 
        id: user.id, 
        email: user.email, 
        username: user.username 
      });

      // Update last login
      await db('users')
        .where({ id: user.id })
        .update({ last_login: new Date() });

      logger.info(`User logged in: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
          }
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  });

  logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // In a more advanced implementation, you might want to:
      // 1. Blacklist the token in Redis
      // 2. Update last_activity timestamp
      // 3. Clear any session data

      const userId = req.user?.id;
      
      if (userId) {
        // Update user's last activity
        await db('users')
          .where({ id: userId })
          .update({ updated_at: new Date() });
        
        logger.info(`User logged out: ${req.user?.email}`);
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400);
      }

      try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;

        // Get user details
        const user = await db('users')
          .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active')
          .where({ id: decoded.id, is_active: true })
          .first();

        if (!user) {
          throw new AppError('Invalid refresh token', 401);
        }

        // Generate new access token
        const newToken = generateToken({
          id: user.id,
          email: user.email,
          username: user.username
        });

        // Generate new refresh token
        const newRefreshToken = generateToken({
          id: user.id,
          type: 'refresh'
        });

        logger.info(`Token refreshed for user: ${user.email}`);

        res.status(200).json({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            token: newToken,
            refreshToken: newRefreshToken,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role
            }
          }
        });
      } catch (jwtError) {
        throw new AppError('Invalid refresh token', 401);
      }
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        throw new AppError('Email is required', 400);
      }

      // Find user by email
      const user = await db('users')
        .select('id', 'email', 'first_name', 'last_name')
        .where({ email: email.toLowerCase().trim(), is_active: true })
        .first();

      // Always return success (don't reveal if email exists)
      const successResponse = {
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      };

      if (!user) {
        // Still return success to prevent email enumeration
        logger.info(`Password reset requested for non-existent email: ${email}`);
        res.status(200).json(successResponse);
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store reset token in database
      await db('password_reset_tokens').insert({
        user_id: user.id,
        token: resetToken,
        email: user.email,
        expires_at: expiresAt,
        used: false
      });

      // In a real application, you would send an email here
      // For now, we'll just log the reset token (remove in production!)
      logger.info(`Password reset token for ${user.email}: ${resetToken} (expires: ${expiresAt})`);

      // TODO: Send email with reset link
      // await sendPasswordResetEmail(user.email, resetToken);

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Forgot password error:', error);
      throw error;
    }
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        throw new AppError('Token and new password are required', 400);
      }

      if (newPassword.length < 6) {
        throw new AppError('Password must be at least 6 characters long', 400);
      }

      // Find valid reset token
      const resetToken = await db('password_reset_tokens')
        .select('*')
        .where({
          token,
          used: false
        })
        .where('expires_at', '>', new Date())
        .first();

      if (!resetToken) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      // Get user
      const user = await db('users')
        .select('id', 'email')
        .where({ id: resetToken.user_id, is_active: true })
        .first();

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Hash new password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);

      // Start transaction
      await db.transaction(async (trx) => {
        // Update user password
        await trx('users')
          .where({ id: user.id })
          .update({ 
            password_hash,
            updated_at: new Date()
          });

        // Mark reset token as used
        await trx('password_reset_tokens')
          .where({ id: resetToken.id })
          .update({ 
            used: true,
            updated_at: new Date()
          });

        // Optionally, invalidate all other reset tokens for this user
        await trx('password_reset_tokens')
          .where({ 
            user_id: user.id,
            used: false
          })
          .whereNot({ id: resetToken.id })
          .update({ 
            used: true,
            updated_at: new Date()
          });
      });

      logger.info(`Password reset successful for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      throw error;
    }
  });

  verifyEmail = asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implement email verification
    res.status(501).json({ message: 'Email verification endpoint not implemented yet' });
  });
}

export const authController = new AuthController();
