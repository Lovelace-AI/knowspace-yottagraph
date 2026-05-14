// Keyword search across pages, collections, records, sources, and entities.
// Returns ranked results with snippets and matched terms. A future
// implementation can add Postgres full-text search and pgvector semantic
// search behind the same shape.

import { readAll, requireAuth } from '../../utils/workspace';
import type {
    CollectionDef,
    CollectionRecord,
    EntityRecord,
    PageRecord,
    SearchResult,
    SourceRecord,
} from '../../../utils/knowspaceTypes';

interface SearchBody {
    query: string;
    types?: SearchResult['type'][];
    sourceId?: string;
}

const MAX_RESULTS = 50;

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const body = await readBody<SearchBody>(event);
    const queryRaw = (body?.query ?? '').trim();

    if (!queryRaw) return { results: [] };

    const terms = queryRaw
        .split(/\s+/)
        .filter((t) => t.length > 1)
        .map((t) => t.toLowerCase());
    if (!terms.length) terms.push(queryRaw.toLowerCase());

    const wantTypes = new Set(body.types ?? ['page', 'collection', 'record', 'source', 'entity']);
    const results: SearchResult[] = [];

    if (wantTypes.has('page')) {
        const pages = await readAll<PageRecord>(ctx, 'pages');
        for (const p of pages) {
            if (body.sourceId && p.sourceId !== body.sourceId) continue;
            const hit = scoreText(`${p.title}\n${p.contentMarkdown}`, terms);
            if (hit.score > 0) {
                results.push({
                    id: p.id,
                    type: 'page',
                    title: p.title,
                    snippet: snippetFor(p.contentMarkdown, terms, p.title),
                    source: p.sourceId ? 'imported' : 'workspace',
                    matchedTerms: hit.matched,
                    score: hit.score + (p.title.toLowerCase().includes(terms[0]) ? 2 : 0),
                    href: `/pages/${p.id}`,
                    updatedAt: p.updatedAt,
                });
            }
        }
    }

    if (wantTypes.has('collection')) {
        const collections = await readAll<CollectionDef>(ctx, 'collections');
        for (const c of collections) {
            const hit = scoreText(`${c.name}\n${c.description}`, terms);
            if (hit.score > 0) {
                results.push({
                    id: c.id,
                    type: 'collection',
                    title: c.name,
                    snippet: c.description || 'Collection',
                    source: 'workspace',
                    matchedTerms: hit.matched,
                    score: hit.score,
                    href: `/collections/${c.id}`,
                    updatedAt: c.updatedAt,
                });
            }
        }

        if (wantTypes.has('record')) {
            for (const c of collections) {
                const records = await readAll<CollectionRecord>(ctx, `collection_records:${c.id}`);
                for (const r of records) {
                    const blob = Object.values(r.properties).map(String).join(' ');
                    const hit = scoreText(blob, terms);
                    if (hit.score > 0) {
                        const title =
                            String(r.properties['Name'] ?? r.properties['name'] ?? 'Record') ||
                            'Record';
                        results.push({
                            id: r.id,
                            type: 'record',
                            title,
                            snippet: snippetFor(blob, terms, title),
                            source: c.name,
                            matchedTerms: hit.matched,
                            score: hit.score,
                            href: `/collections/${c.id}`,
                            updatedAt: r.updatedAt,
                        });
                    }
                }
            }
        }
    }

    if (wantTypes.has('source')) {
        const sources = await readAll<SourceRecord>(ctx, 'sources');
        for (const s of sources) {
            const hit = scoreText(s.displayName, terms);
            if (hit.score > 0) {
                results.push({
                    id: s.id,
                    type: 'source',
                    title: s.displayName,
                    snippet: `${s.sourceType.replace('_', ' ')} · ${s.status}`,
                    source: 'sources',
                    matchedTerms: hit.matched,
                    score: hit.score,
                    href: '/sources',
                    updatedAt: s.updatedAt,
                });
            }
        }
    }

    if (wantTypes.has('entity')) {
        const entities = await readAll<EntityRecord>(ctx, 'entities');
        for (const e of entities) {
            const text = `${e.canonicalName}\n${e.aliases.join(' ')}\n${e.summary}`;
            const hit = scoreText(text, terms);
            if (hit.score > 0) {
                results.push({
                    id: e.id,
                    type: 'entity',
                    title: e.canonicalName,
                    snippet: e.summary || `${e.type} · ${e.mentions.length} mentions`,
                    source: 'entities',
                    matchedTerms: hit.matched,
                    score: hit.score + e.mentions.length * 0.1,
                    href: `/entities/${e.id}`,
                    updatedAt: e.updatedAt,
                });
            }
        }
    }

    results.sort((a, b) => b.score - a.score);
    return { results: results.slice(0, MAX_RESULTS) };
});

function scoreText(text: string, terms: string[]): { score: number; matched: string[] } {
    if (!text) return { score: 0, matched: [] };
    const lower = text.toLowerCase();
    const matched: string[] = [];
    let score = 0;
    for (const term of terms) {
        let from = 0;
        let count = 0;
        while (true) {
            const i = lower.indexOf(term, from);
            if (i === -1) break;
            count += 1;
            from = i + term.length;
        }
        if (count > 0) {
            matched.push(term);
            score += count;
        }
    }
    return { score, matched };
}

function snippetFor(text: string, terms: string[], fallback: string): string {
    if (!text) return fallback;
    const lower = text.toLowerCase();
    for (const term of terms) {
        const i = lower.indexOf(term);
        if (i !== -1) {
            const start = Math.max(0, i - 60);
            const end = Math.min(text.length, i + 120);
            const prefix = start > 0 ? '… ' : '';
            const suffix = end < text.length ? ' …' : '';
            return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
        }
    }
    return text.slice(0, 160).replace(/\s+/g, ' ').trim();
}
