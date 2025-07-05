import { Router } from 'express';
import { projectController } from '../controllers/projectController';
import { authenticate, authorize } from '../middleware/auth';
import { validateProject } from '../validators/projectValidator';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProject);
router.post('/', validateProject.create, projectController.createProject);
router.put('/:id', authorize(['owner', 'admin']), validateProject.update, projectController.updateProject);
router.delete('/:id', authorize(['owner']), projectController.deleteProject);
router.post('/:id/members', authorize(['owner', 'admin']), validateProject.addMember, projectController.addMember);
router.delete('/:id/members/:userId', authorize(['owner', 'admin']), projectController.removeMember);
router.put('/:id/archive', authorize(['owner']), projectController.archiveProject);

export { router as projectRoutes };
