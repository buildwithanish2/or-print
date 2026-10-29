import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';
import rateLimit from 'express-rate-limit';

const router = Router();
const pairingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

// Agent Pairing & Registration (No JWT required - pairing code is the secret)
router.post('/pair', pairingLimiter, AgentController.pairAgent);
router.post('/printers/sync', AgentController.syncPrinters);
router.post('/heartbeat', AgentController.agentHeartbeat);
router.post('/jobs/:jobId/status', AgentController.updateJobStatus);
router.get('/update/latest', AgentController.getLatestUpdate);

export default router;
