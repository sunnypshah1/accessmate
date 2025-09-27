import { chromium } from 'playwright';
import * as axe from 'axe-core';

export type AuditViolation = {
  id: string;
  impact?: string | null;
  description: string;
  helpUrl: string;
  nodes: { html: string; target: string[] }[];
};

export type AuditResult = {
  violations: AuditViolation[];
  error?: string;
};

export async function runAudit(urls: string[]) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results: Record<string, AuditResult> = {};

  try {
    for (const url of urls) {
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.addScriptTag({ content: axe.source });

        const analysis = await page.evaluate(async () => {
          // @ts-ignore
          const axeRun = await (window as any).axe.run({
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa'],
            },
          });

          return axeRun;
        });

        results[url] = {
          violations: analysis.violations.map((violation: any) => ({
            id: violation.id,
            impact: violation.impact ?? null,
            description: violation.description,
            helpUrl: violation.helpUrl,
            nodes: violation.nodes.map((node: any) => ({
              html: node.html,
              target: node.target,
            })),
          })),
        };
      } catch (error) {
        results[url] = {
          violations: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return { results } as const;
}
