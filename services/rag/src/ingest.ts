import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { log } from '@accessmate/diagnostics';
import { prisma } from '@accessmate/db';
import type { Prisma } from '@accessmate/db';
import { wcagChecklist } from '@accessmate/wcag';

const SOURCE_KEY = '@accessmate/wcag/checklist';
const EMBEDDING_DIMENSION = 256;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'with',
]);

export type QueryInput = {
  ruleId?: string;
  contextSnippet?: string;
};

export interface GuidelineMatch {
  id: string;
  topic: string;
  wcagCode: string;
  wcagTitle: string;
  paragraph: string;
  summary: string;
  citation: string;
  source: string;
  score: number;
}

type NormalizedGuideline = Omit<GuidelineMatch, 'score'> & {
  embedding: Float32Array;
};

let cachedIndexPromise: Promise<GuidelineIndex> | null = null;

export class GuidelineIndex {
  constructor(private readonly guidelines: NormalizedGuideline[]) {}

  search(query: QueryInput, limit = 5): GuidelineMatch[] {
    const queryText = buildQueryText(query);
    const queryVector = embedText(queryText);
    const wcagCodes = extractWcagCodes(queryText);
    const normalizedRule = query.ruleId ? normalizeRuleId(query.ruleId) : null;

    const matches = this.guidelines
      .map((guideline) => {
        const similarity = cosineSimilarity(queryVector, guideline.embedding);
        const bonus = computeMetadataBonus(guideline, wcagCodes, normalizedRule);
        return {
          ...guideline,
          score: similarity + bonus,
        } satisfies GuidelineMatch;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return matches;
  }
}

export async function ensureGuidelineIndex(): Promise<GuidelineIndex> {
  if (!cachedIndexPromise) {
    cachedIndexPromise = loadIndex();
  }

  return cachedIndexPromise;
}

export async function retrieveGuidelines(
  query: QueryInput,
  options?: { limit?: number },
): Promise<GuidelineMatch[]> {
  const index = await ensureGuidelineIndex();
  const limit = options?.limit ?? 5;
  return index.search(query, limit);
}

async function loadIndex(): Promise<GuidelineIndex> {
  const fromDatabase = await loadFromDatabase();
  if (fromDatabase) {
    return new GuidelineIndex(fromDatabase);
  }

  const fromChecklist = buildGuidelinesFromChecklist();
  await persistGuidelines(fromChecklist);
  return new GuidelineIndex(fromChecklist);
}

async function loadFromDatabase(): Promise<NormalizedGuideline[] | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const records = await prisma.guidelineChunk.findMany({
      where: { source: SOURCE_KEY },
    });

    if (records.length === 0) {
      return null;
    }

    const parsed: NormalizedGuideline[] = [];
    for (const record of records) {
      try {
        const payload = JSON.parse(record.body);
        if (!isPersistedPayload(payload)) {
          return null;
        }

        const buffer = record.embedding as unknown as Buffer;
        const bytes = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        );
        if (bytes.byteLength !== EMBEDDING_DIMENSION * 4) {
          return null;
        }

        const embedding = new Float32Array(bytes);
        normalizeVector(embedding);

        parsed.push({
          id: record.id,
          source: SOURCE_KEY,
          topic: payload.topic,
          wcagCode: payload.wcagCode,
          wcagTitle: payload.wcagTitle,
          paragraph: payload.paragraph,
          summary: payload.summary,
          citation: payload.citation,
          embedding,
        });
      } catch (error) {
        log.warn('Failed to parse persisted guideline chunk, rebuilding from checklist', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }

    if (parsed.length === 0) {
      return null;
    }

    return parsed;
  } catch (error) {
    log.warn('Unable to load WCAG index from database, falling back to in-memory version', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function persistGuidelines(guidelines: NormalizedGuideline[]): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.guidelineChunk.deleteMany({ where: { source: SOURCE_KEY } });
      for (const guideline of guidelines) {
        await tx.guidelineChunk.create({
          data: {
            source: SOURCE_KEY,
            heading: guideline.citation,
            body: JSON.stringify({
              topic: guideline.topic,
              wcagCode: guideline.wcagCode,
              wcagTitle: guideline.wcagTitle,
              paragraph: guideline.paragraph,
              summary: guideline.summary,
              citation: guideline.citation,
            }),
            embedding: Buffer.from(guideline.embedding.buffer),
          },
        });
      }
    });
  } catch (error) {
    log.warn('Unable to persist WCAG index, continuing with in-memory fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

type ChecklistEntry = {
  task: string;
  wcag: string;
};

function buildGuidelinesFromChecklist(): NormalizedGuideline[] {
  const guidelines: NormalizedGuideline[] = [];
  const seen = new Set<string>();
  const checklist = wcagChecklist.checklist as Record<string, ChecklistEntry[]>;

  for (const [topic, entries] of Object.entries(checklist)) {
    for (const entry of entries) {
      const paragraph = entry.task.trim();
      const { code, title } = parseWcagReference(entry.wcag);
      const citation = title ? `WCAG ${code} ${title}` : `WCAG ${code}`;
      const id = createHash('sha1')
        .update(`${topic}:${entry.wcag}:${paragraph}`)
        .digest('hex');

      if (seen.has(id)) {
        continue;
      }
      seen.add(id);

      const text = `${topic} ${code} ${title} ${paragraph}`;
      const embedding = embedText(text);

      guidelines.push({
        id,
        source: SOURCE_KEY,
        topic,
        wcagCode: code,
        wcagTitle: title,
        paragraph,
        summary: paragraph,
        citation,
        embedding,
      });
    }
  }

  return guidelines;
}

function parseWcagReference(input: string): { code: string; title: string } {
  const match = input.match(/^(\d(?:\.\d+)+)\s*(.*)$/);
  if (match) {
    return {
      code: match[1],
      title: match[2]?.trim() ?? '',
    };
  }

  return { code: input.trim(), title: '' };
}

function embedText(text: string): Float32Array {
  const vector = new Float32Array(EMBEDDING_DIMENSION);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const index = hashToken(token);
    vector[index] += 1;
  }

  return normalizeVector(vector);
}

function normalizeVector(vector: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i += 1) {
    norm += vector[i] * vector[i];
  }

  if (norm === 0) {
    return vector;
  }

  const magnitude = Math.sqrt(norm);
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = vector[i] / magnitude;
  }

  return vector;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !STOP_WORDS.has(token));
}

function hashToken(token: string): number {
  const digest = createHash('sha1').update(token).digest();
  const bucket = digest.readUInt32BE(0);
  return bucket % EMBEDDING_DIMENSION;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / Math.sqrt(normA * normB);
}

function buildQueryText(query: QueryInput): string {
  const parts: string[] = [];
  if (query.ruleId) {
    parts.push(normalizeRuleId(query.ruleId));
  }
  if (query.contextSnippet) {
    parts.push(query.contextSnippet);
  }
  return parts.join(' ');
}

function normalizeRuleId(ruleId: string): string {
  return ruleId.replace(/[-_]+/g, ' ').toLowerCase();
}

function extractWcagCodes(text: string): Set<string> {
  const codes = new Set<string>();
  const regex = /(\d(?:\.\d+)+)/g;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(text))) {
    codes.add(match[1]);
  }
  return codes;
}

function computeMetadataBonus(
  guideline: NormalizedGuideline,
  wcagCodes: Set<string>,
  normalizedRule: string | null,
): number {
  let bonus = 0;

  if (wcagCodes.has(guideline.wcagCode)) {
    bonus += 0.5;
  }

  if (normalizedRule) {
    const normalizedTopic = guideline.topic.toLowerCase();
    const normalizedTitle = guideline.wcagTitle.toLowerCase();
    const normalizedParagraph = guideline.paragraph.toLowerCase();

    if (normalizedParagraph.includes(normalizedRule)) {
      bonus += 0.3;
    } else if (normalizedTitle.includes(normalizedRule)) {
      bonus += 0.2;
    } else if (normalizedTopic.includes(normalizedRule)) {
      bonus += 0.1;
    }
  }

  return bonus;
}

function isPersistedPayload(value: unknown): value is {
  topic: string;
  wcagCode: string;
  wcagTitle: string;
  paragraph: string;
  summary: string;
  citation: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.topic === 'string' &&
    typeof payload.wcagCode === 'string' &&
    typeof payload.wcagTitle === 'string' &&
    typeof payload.paragraph === 'string' &&
    typeof payload.summary === 'string' &&
    typeof payload.citation === 'string'
  );
}

export const __testing = {
  buildGuidelinesFromChecklist,
  parseWcagReference,
  embedText,
  tokenize,
  computeMetadataBonus,
  buildQueryText,
  extractWcagCodes,
  cosineSimilarity,
  normalizeRuleId,
};
