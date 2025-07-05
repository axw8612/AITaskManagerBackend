import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { validateUser } from '../validators/userValidator';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', validateUser.update, userController.updateProfile);
router.get('/search', userController.searchUsers);
router.get('/:id', userController.getUser);
router.get('/:id/projects', userController.getUserProjects);
router.get('/:id/tasks', userController.getUserTasks);

export { router as userRoutes };
