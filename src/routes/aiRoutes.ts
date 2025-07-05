import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

router.post('/task-suggestions', aiController.getTaskSuggestions);
router.post('/time-estimate', aiController.estimateTime);
router.post('/priority-suggestion', aiController.suggestPriority);
router.post('/assignee-suggestion', aiController.suggestAssignee);
router.post('/task-breakdown', aiController.breakdownTask);

export { router as aiRoutes };
