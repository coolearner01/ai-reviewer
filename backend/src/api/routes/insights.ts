import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { insightsService } from '../../modules/insights/insightsService';

const router: Router = Router();

router.use(requireAuth);

const query = z.object({
  days: z.coerce.number().int().positive().max(180).default(30),
});

router.get(
  '/',
  validateQuery(query),
  asyncHandler(async (req, res) => {
    const days = (req.query as unknown as z.infer<typeof query>).days;
    const result = await insightsService.getForUser(req.user!.id, days);
    res.json(result);
  }),
);

export default router;
