import { createHmac } from 'node:crypto';
import { App } from '@octokit/app';
import { verify } from '@octokit/webhooks-methods';

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
}

export interface WebhookHeaders {
  delivery: string | undefined;
  event: string | undefined;
  signature: string | undefined;
}

export async function verifyWebhook({
  secret,
  payload,
  signature,
}: {
  secret: string;
  payload: string;
  signature: string | undefined;
}): Promise<WebhookVerificationResult> {
  if (!signature) {
    return { valid: false, reason: 'Missing signature header' };
  }

  try {
    const signatureToCheck = signature;
    const isValid = await verify(secret, payload, signatureToCheck);
    return isValid ? { valid: true } : { valid: false, reason: 'Invalid signature' };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

export function computeWebhookSignature(secret: string, payload: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

export function createGitHubApp(options: ConstructorParameters<typeof App>[0]): App {
  return new App(options);
}

export async function createInstallationClient({
  app,
  installationId,
}: {
  app: App;
  installationId: number;
}): Promise<Awaited<ReturnType<App['getInstallationOctokit']>>> {
  return app.getInstallationOctokit(installationId);
}
