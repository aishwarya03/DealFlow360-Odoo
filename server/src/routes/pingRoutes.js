import { Router } from 'express';
import { ping } from '../controllers/pingController.js';

const router = Router();

router.get('/api/ping', ping);

export default router;