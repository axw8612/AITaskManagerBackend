import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { authenticate } from '../middleware/auth';
import { validateTask } from '../validators/taskValidator';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTask);
router.post('/', validateTask.create, taskController.createTask);
router.put('/:id', validateTask.update, taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.post('/:id/attachments', taskController.addAttachment);
router.delete('/:id/attachments/:attachmentId', taskController.removeAttachment);

export { router as taskRoutes };
