import { newId } from './ids';

export interface ExtractedDocData {
    tags: string[];
    wikiLinks: string[];
}

function stripCodeBlocksAndInlineCode(markdown: string): string {
    return markdown.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ');
}

function normalizeTag(raw: string): string {
    return raw.trim().toLowerCase().replace(/^#+/, '').replace(/\/+/g, '/').slice(0, 80);
}

export function extractDocData(markdown: string): ExtractedDocData {
    const content = stripCodeBlocksAndInlineCode(markdown || '');
    const tagSet = new Set<string>();
    const wikiSet = new Set<string>();

    const tagRegex = /(^|[\s([{-])#([a-zA-Z0-9][a-zA-Z0-9/_-]{0,79})\b/gm;
    let tagMatch: RegExpExecArray | null = null;
    while ((tagMatch = tagRegex.exec(content)) !== null) {
        const normalized = normalizeTag(tagMatch[2] || '');
        if (normalized) tagSet.add(normalized);
    }

    const wikiRegex = /\[\[([^\]\n]{1,200})\]\]/g;
    let linkMatch: RegExpExecArray | null = null;
    while ((linkMatch = wikiRegex.exec(content)) !== null) {
        const targetTitle = (linkMatch[1] || '').trim();
        if (targetTitle) wikiSet.add(targetTitle);
    }

    return {
        tags: [...tagSet],
        wikiLinks: [...wikiSet],
    };
}

interface PersistExtractionInput {
    workspaceId: string;
    pageId: string;
    markdown: string;
    userSub: string | null;
}

/**
 * Persist extracted tags and outgoing wiki-link edges for one page.
 * Re-runs are idempotent: existing wiki_link edges from this page are replaced.
 */
export async function persistDocExtraction(sql: any, input: PersistExtractionInput): Promise<void> {
    const { workspaceId, pageId, markdown, userSub } = input;
    const extracted = extractDocData(markdown);

    await sql`UPDATE pages
        SET tags = ${JSON.stringify(extracted.tags)}::jsonb,
            updated_by = COALESCE(${userSub}, updated_by),
            updated_at = NOW()
        WHERE id = ${pageId} AND workspace_id = ${workspaceId}`;

    await sql`DELETE FROM page_edges
        WHERE workspace_id = ${workspaceId}
          AND from_page_id = ${pageId}
          AND edge_type = 'wiki_link'`;

    for (const title of extracted.wikiLinks) {
        const targetRows = await sql`SELECT id FROM pages
                WHERE workspace_id = ${workspaceId}
                  AND deleted_at IS NULL
                  AND lower(title) = lower(${title})
                ORDER BY updated_at DESC
                LIMIT 1`;
        const toPageId = targetRows[0]?.id || null;
        await sql`INSERT INTO page_edges
            (id, workspace_id, from_page_id, to_page_id, to_external_url, edge_type, source, confidence)
            VALUES (${newId('edge')}, ${workspaceId}, ${pageId}, ${toPageId}, NULL, 'wiki_link', ${title}, NULL)`;
    }
}
