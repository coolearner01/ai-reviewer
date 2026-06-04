import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { reviewPreferencesSchema } from '../schemas';
import { settingsService } from '../../modules/settings/settingsService';

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await settingsService.getForUser(req.user!.id);
    res.json({ settings });
  }),
);

router.patch(
  '/',
  validateBody(reviewPreferencesSchema),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.upsertForUser(req.user!.id, req.body);
    res.json({ settings });
  }),
);

export default router;
