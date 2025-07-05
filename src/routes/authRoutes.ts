import { Router } from 'express';
import { authController } from '../controllers/authController';
import { validateAuth } from '../validators/authValidator';

const router = Router();

router.post('/register', validateAuth.register, authController.register);
router.post('/login', validateAuth.login, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', validateAuth.forgotPassword, authController.forgotPassword);
router.post('/reset-password', validateAuth.resetPassword, authController.resetPassword);
router.post('/verify-email', validateAuth.verifyEmail, authController.verifyEmail);

export { router as authRoutes };
