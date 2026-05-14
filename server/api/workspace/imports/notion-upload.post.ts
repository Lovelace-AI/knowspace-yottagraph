// Notion export upload scaffold.
//
// The real implementation would persist the zip in object storage, queue a
// background job, extract Markdown/HTML/CSV/attachments, create pages and
// collections, and resolve internal links. For the MVP we accept the upload
// metadata, create a source + import batch record, and synthesize a small
// number of "imported" pages from the manifest the client sends so the
// Import Center has visible activity. A future job runner can replace the
// inline logic without changing the API shape.

import { newId, nowIso, readAll, requireAuth, writeOne } from '../../../utils/workspace';
import { extractEntities } from '../../../utils/entityExtractor';
import type {
    EntityRecord,
    ImportBatch,
    PageRecord,
    SourceRecord,
} from '../../../../utils/knowspaceTypes';

interface UploadBody {
    fileName: string;
    fileSize: number;
    manifest?: ManifestEntry[];
}

interface ManifestEntry {
    path: string;
    title?: string;
    contentMarkdown?: string;
    type?: 'page' | 'csv';
}

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const body = await readBody<UploadBody>(event);
    if (!body?.fileName) {
        throw createError({ statusCode: 400, statusMessage: 'fileName required' });
    }

    const now = nowIso();

    const source: SourceRecord = {
        id: newId('src'),
        sourceType: 'notion_export',
        displayName: body.fileName,
        status: 'syncing',
        config: { fileName: body.fileName, fileSize: body.fileSize },
        createdAt: now,
        updatedAt: now,
    };
    await writeOne(ctx, 'sources', source);

    const stats = {
        pagesImported: 0,
        collectionsImported: 0,
        attachmentsImported: 0,
        linksResolved: 0,
        linksUnresolved: 0,
        warnings: 0,
    };
    const errors: string[] = [];
    const notes: string[] = [];

    const manifest = body.manifest ?? sampleManifest(body.fileName);

    const created: PageRecord[] = [];
    const titleIndex = new Map<string, string>();

    for (const entry of manifest) {
        if (entry.type === 'csv') {
            stats.collectionsImported += 1;
            continue;
        }
        const id = newId('pg');
        const title = entry.title || prettyTitleFromPath(entry.path);
        const page: PageRecord = {
            id,
            title,
            slug: slugify(title),
            emoji: '📄',
            parentId: null,
            contentMarkdown: entry.contentMarkdown || `# ${title}\n\n_Imported from ${entry.path}_`,
            tags: ['imported'],
            sourceId: source.id,
            sourceObjectId: entry.path,
            importStatus: 'imported',
            importPath: entry.path,
            favorite: false,
            createdAt: now,
            updatedAt: now,
        };
        await writeOne(ctx, 'pages', page);
        created.push(page);
        titleIndex.set(title.toLowerCase(), id);
        stats.pagesImported += 1;
    }

    // Naive parent inference: assign by directory depth.
    for (const page of created) {
        if (!page.importPath) continue;
        const parentDir = page.importPath.split('/').slice(0, -1).join('/');
        if (!parentDir) continue;
        const candidate = created.find((p) => p.importPath === parentDir);
        if (candidate) {
            page.parentId = candidate.id;
            await writeOne(ctx, 'pages', page);
        }
    }

    // Naive internal-link resolution by title match.
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    for (const page of created) {
        let rewritten = page.contentMarkdown;
        let dirty = false;
        let match: RegExpExecArray | null;
        const matches: RegExpExecArray[] = [];
        while ((match = linkPattern.exec(page.contentMarkdown)) !== null) matches.push(match);
        for (const m of matches) {
            const label = m[1];
            const href = m[2];
            if (/^https?:\/\//.test(href)) continue;
            const targetId = titleIndex.get(label.toLowerCase());
            if (targetId) {
                rewritten = rewritten.replace(m[0], `[${label}](/pages/${targetId})`);
                stats.linksResolved += 1;
                dirty = true;
            } else {
                stats.linksUnresolved += 1;
                notes.push(`Unresolved link "${label}" in ${page.title}`);
            }
        }
        if (dirty) {
            page.contentMarkdown = rewritten;
            await writeOne(ctx, 'pages', page);
        }
    }

    // Mock entity enrichment over imported pages.
    if (created.length) {
        const existingEntities = await readAll<EntityRecord>(ctx, 'entities');
        const byKey = new Map(existingEntities.map((e) => [e.canonicalName.toLowerCase(), e]));
        for (const page of created) {
            const extracted = extractEntities(`${page.title}\n\n${page.contentMarkdown}`);
            for (const cand of extracted) {
                const key = cand.name.toLowerCase();
                const prior = byKey.get(key);
                if (prior) {
                    if (!prior.mentions.some((m) => m.pageId === page.id)) {
                        prior.mentions.push({
                            pageId: page.id,
                            snippet: cand.snippet,
                            confidence: cand.confidence,
                        });
                        prior.confidence = Math.min(1, prior.confidence + 0.03);
                        prior.updatedAt = now;
                        await writeOne(ctx, 'entities', prior);
                    }
                } else {
                    const entity: EntityRecord = {
                        id: newId('ent'),
                        canonicalName: cand.name,
                        type: cand.type,
                        aliases: [],
                        confidence: cand.confidence,
                        summary: '',
                        mentions: [
                            {
                                pageId: page.id,
                                snippet: cand.snippet,
                                confidence: cand.confidence,
                            },
                        ],
                        relatedIds: [],
                        createdAt: now,
                        updatedAt: now,
                    };
                    await writeOne(ctx, 'entities', entity);
                    byKey.set(key, entity);
                }
            }
        }
    }

    const batch: ImportBatch = {
        id: newId('imp'),
        sourceId: source.id,
        fileName: body.fileName,
        fileSize: body.fileSize,
        status: 'completed',
        startedAt: now,
        completedAt: nowIso(),
        stats,
        errors,
        notes,
    };
    await writeOne(ctx, 'imports', batch);

    source.status = 'connected';
    source.updatedAt = nowIso();
    await writeOne(ctx, 'sources', source);

    return { batch, source };
});

function sampleManifest(fileName: string): ManifestEntry[] {
    const base = fileName.replace(/\.zip$/i, '');
    return [
        {
            path: `${base}/Welcome.md`,
            title: 'Welcome',
            contentMarkdown: `# Welcome to your imported workspace\n\nThis is a sample import generated from \`${fileName}\`.\n\nThe Notion importer will normally extract Markdown, HTML, and CSV files from the zip you upload. For this MVP we created a small demonstration set so you can explore the workspace shell.\n\nLinked: [Product Strategy](#) and [Hiring Plan](#).`,
        },
        {
            path: `${base}/Product Strategy.md`,
            title: 'Product Strategy',
            contentMarkdown: `# Product Strategy\n\nKnowspace turns exported workspaces into living knowledge layers backed by YottaGraph entity enrichment. The product organizes meaning, not just documents.`,
        },
        {
            path: `${base}/Hiring Plan.md`,
            title: 'Hiring Plan',
            contentMarkdown: `# Hiring Plan\n\n- Senior engineer (full stack)\n- Knowledge-graph engineer\n- Designer (information density and editor experience)`,
        },
        {
            path: `${base}/Meetings/Kickoff.md`,
            title: 'Kickoff Meeting',
            contentMarkdown: `# Kickoff Meeting\n\nDiscussed Knowspace MVP scope with the founding team.`,
        },
    ];
}

function prettyTitleFromPath(path: string): string {
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ');
}

function slugify(input: string): string {
    return (
        input
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'untitled'
    );
}
