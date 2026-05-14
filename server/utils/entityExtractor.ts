// Mock entity extractor. Pulls out capitalized multi-word phrases as
// candidate Organization/Person/Product entities and stores their context.
// Designed as a placeholder for the real YottaGraph enrichment pipeline.

import type { EntityType } from '../../utils/knowspaceTypes';

export interface ExtractedEntity {
    name: string;
    type: EntityType;
    snippet: string;
    confidence: number;
}

const STOPWORDS = new Set([
    'The',
    'A',
    'An',
    'In',
    'On',
    'At',
    'Of',
    'For',
    'And',
    'But',
    'Or',
    'If',
    'So',
    'Is',
    'It',
    'We',
    'You',
    'They',
    'He',
    'She',
    'I',
    'This',
    'That',
    'These',
    'Those',
    'With',
    'From',
    'By',
    'To',
    'As',
    'Be',
    'Been',
    'Was',
    'Were',
    'Are',
    'Has',
    'Have',
    'Had',
    'Will',
    'Would',
    'Could',
    'Should',
    'Notion',
    'Google',
    'Page',
    'Pages',
    'Collection',
    'Workspace',
]);

const ORG_HINTS = /\b(Inc|LLC|Corp|Corporation|Company|Co|Ltd|Group|Holdings|Labs|Systems)\b/;
const PERSON_HINTS = /\b(Mr|Mrs|Ms|Dr|Prof|Professor)\.?\s/;

export function extractEntities(text: string): ExtractedEntity[] {
    if (!text) return [];
    const candidates = new Map<string, ExtractedEntity>();
    const phrasePattern = /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,3})/g;

    let match: RegExpExecArray | null;
    while ((match = phrasePattern.exec(text)) !== null) {
        const phrase = match[1].trim();
        if (phrase.length < 3) continue;

        const firstWord = phrase.split(/\s+/)[0];
        if (STOPWORDS.has(firstWord) && !phrase.includes(' ')) continue;

        const start = Math.max(0, match.index - 60);
        const end = Math.min(text.length, match.index + phrase.length + 80);
        const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();

        let type: EntityType = 'concept';
        if (ORG_HINTS.test(phrase)) type = 'organization';
        else if (PERSON_HINTS.test(text.slice(Math.max(0, match.index - 8), match.index)))
            type = 'person';
        else if (phrase.split(/\s+/).length >= 2) type = 'organization';

        const key = phrase.toLowerCase();
        const existing = candidates.get(key);
        if (existing) {
            existing.confidence = Math.min(1, existing.confidence + 0.05);
        } else {
            candidates.set(key, {
                name: phrase,
                type,
                snippet,
                confidence: 0.5,
            });
        }
    }

    return Array.from(candidates.values()).slice(0, 25);
}

export function chunkText(text: string, chunkSize: number = 800): string[] {
    if (!text) return [];
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks: string[] = [];
    let current = '';
    for (const p of paragraphs) {
        if (current.length + p.length + 2 > chunkSize && current) {
            chunks.push(current.trim());
            current = '';
        }
        current += (current ? '\n\n' : '') + p;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}
