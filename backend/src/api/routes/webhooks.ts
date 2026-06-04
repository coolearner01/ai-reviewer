import { Router, json, type Request, type Response } from 'express';
import { buildProvider } from '../../providers';
import { organizationService } from '../../modules/organizations/organizationService';
import { startReview } from '../../modules/reviews/reviewEnqueueService';
import { logger } from '../../utils/logger';
import type { Provider } from '../../types';

const router: Router = Router();

const rawBody = json({
  verify: (req: Request, _res, buf) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
});

const SIGNATURE_HEADERS: Record<Provider, string> = {
  github: 'x-hub-signature-256',
  gitlab: 'x-gitlab-token',
  bitbucket: 'x-hub-signature',
};

async function processVerifiedWebhook(input: {
  provider: Provider;
  prUrl: string;
  userId: string;
  organizationId: string | null;
}): Promise<void> {
  await startReview({
    userId: input.userId,
    pullRequestUrl: input.prUrl,
    organizationId: input.organizationId,
    logContext: '[webhook]',
  });
}

function handleOrgScoped(provider: Provider) {
  return async (req: Request, res: Response) => {
    const rawReq = req as Request & { rawBody?: Buffer };
    const webhookSlug = req.params.webhookSlug;

    const org = webhookSlug
      ? await organizationService.findByWebhookSlug(webhookSlug)
      : null;

    if (!org || org.provider !== provider) {
      logger.warn('[webhook] unknown or mismatched webhook slug', { provider, webhookSlug });
      res.status(200).json({ received: true });
      return;
    }

    const { webhookSecret } = organizationService.getCredentials(org);
    const adapter = buildProvider({ provider, token: undefined });
    const sigHeader = req.headers[SIGNATURE_HEADERS[provider]];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

    const ok = adapter.verifyWebhookSignature(
      rawReq.rawBody ?? Buffer.from(''),
      sig,
      webhookSecret,
    );
    if (!ok) {
      logger.warn('[webhook] invalid signature (org)', { provider, orgId: org.id });
      res.status(200).json({ received: true });
      return;
    }

    const prUrl = adapter.extractPRUrlFromWebhook(req.body);
    if (!prUrl) {
      res.status(200).json({ received: true });
      return;
    }

    try {
      await processVerifiedWebhook({
        provider,
        prUrl,
        userId: org.userId,
        organizationId: org.id,
      });
    } catch (err) {
      logger.error('[webhook] org processing failed', {
        provider,
        orgId: org.id,
        error: (err as Error).message,
      });
    }
    res.status(200).json({ received: true });
  };
}

router.post('/github/:webhookSlug', rawBody, handleOrgScoped('github'));
router.post('/gitlab/:webhookSlug', rawBody, handleOrgScoped('gitlab'));
router.post('/bitbucket/:webhookSlug', rawBody, handleOrgScoped('bitbucket'));

export default router;
