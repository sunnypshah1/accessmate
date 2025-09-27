import { chromium } from 'playwright';
import * as axe from 'axe-core';


export type AuditViolation = {
id: string;
impact?: string | null;
description: string;
helpUrl: string;
nodes: { html: string; target: string[] }[];
};


export async function runAudit(urls: string[]) {
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const results: Record<string, { violations: AuditViolation[] }> = {};


for (const url of urls) {
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });


// inject axe source into the page
await page.addScriptTag({ content: axe.source });


const analysis = await page.evaluate(async () => {
// @ts-ignore
const r = await (window as any).axe.run({
runOnly: {
type: 'tag',
values: ['wcag2a', 'wcag2aa']
}
});
return r;
});


results[url] = {
violations: analysis.violations.map((v: any) => ({
id: v.id,
impact: v.impact ?? null,
description: v.description,
helpUrl: v.helpUrl,
nodes: v.nodes.map((n: any) => ({ html: n.html, target: n.target }))
}))
};


await page.close();
}


await context.close();
await browser.close();


return { results } as const;
}