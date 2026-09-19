import { Router } from 'express';
import { RoomController } from '../controllers/room.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All room routes require authentication
router.use(authenticate);

router.post('/', RoomController.create);
router.get('/', RoomController.list);
router.get('/:roomId', RoomController.getById);
router.post('/:roomId/join', RoomController.join);
router.post('/:roomId/leave', RoomController.leave);

export default router;
