import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  idParamSchema,
  reviewPromptCreateSchema,
  reviewPromptUpdateSchema,
} from '../schemas';
import { reviewPromptService } from '../../modules/prompts/reviewPromptService';

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const prompts = await reviewPromptService.listForUser(req.user!.id);
    res.json({ prompts });
  }),
);

router.post(
  '/',
  validateBody(reviewPromptCreateSchema),
  asyncHandler(async (req, res) => {
    const prompt = await reviewPromptService.create(req.user!.id, req.body);
    res.status(201).json({ prompt });
  }),
);

router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(reviewPromptUpdateSchema),
  asyncHandler(async (req, res) => {
    const prompt = await reviewPromptService.update(req.user!.id, req.params.id, req.body);
    res.json({ prompt });
  }),
);

router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await reviewPromptService.remove(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);

export default router;
