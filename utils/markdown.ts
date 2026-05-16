import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
    gfm: true,
    breaks: true,
});

export interface ParsedFrontmatter {
    data: Record<string, unknown>;
    body: string;
}

function parseScalar(raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed
            .slice(1, -1)
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
    }
    return trimmed.replace(/^['"]|['"]$/g, '');
}

/**
 * Lightweight frontmatter parser for doc metadata.
 * Supports `---` block with simple `key: value` pairs and inline arrays.
 */
export function parseFrontmatter(md: string | null | undefined): ParsedFrontmatter {
    const text = md || '';
    if (!text.startsWith('---\n')) return { data: {}, body: text };
    const endIdx = text.indexOf('\n---\n', 4);
    if (endIdx === -1) return { data: {}, body: text };

    const yamlRaw = text.slice(4, endIdx);
    const body = text.slice(endIdx + 5);
    const data: Record<string, unknown> = {};
    for (const line of yamlRaw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sep = trimmed.indexOf(':');
        if (sep <= 0) continue;
        const key = trimmed.slice(0, sep).trim();
        const val = trimmed.slice(sep + 1);
        if (!key) continue;
        data[key] = parseScalar(val);
    }
    return { data, body };
}

export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
    const keys = Object.keys(data || {}).filter((k) => k.trim());
    if (keys.length === 0) return body || '';
    const lines = keys.map((key) => {
        const value = data[key];
        if (Array.isArray(value)) return `${key}: [${value.join(', ')}]`;
        if (typeof value === 'boolean' || typeof value === 'number')
            return `${key}: ${String(value)}`;
        return `${key}: ${String(value ?? '').replace(/\n/g, ' ')}`;
    });
    return `---\n${lines.join('\n')}\n---\n${body || ''}`;
}

function rewriteWikiLinks(md: string): string {
    return (md || '').replace(/\[\[([^\]\n]{1,200})\]\]/g, (_m, title) => {
        const clean = String(title || '').trim();
        if (!clean) return '';
        return `[${clean}](/search?q=${encodeURIComponent(clean)})`;
    });
}

/**
 * Render a Markdown string to safe HTML for display in a page view.
 * Runs synchronously and assumes a browser DOM is available (used in
 * client components only). Safe to call with empty / null / undefined.
 */
export function renderMarkdown(md: string | null | undefined): string {
    if (!md) return '';
    const { body } = parseFrontmatter(md);
    const raw = marked.parse(rewriteWikiLinks(body), { async: false }) as string;
    if (typeof window === 'undefined') return raw;
    return DOMPurify.sanitize(raw, {
        ALLOWED_ATTR: [
            'href',
            'title',
            'alt',
            'src',
            'class',
            'id',
            'target',
            'rel',
            'colspan',
            'rowspan',
        ],
        ALLOW_DATA_ATTR: false,
    });
}

/**
 * Strip Markdown formatting for previews / snippets / search results.
 */
export function stripMarkdown(md: string | null | undefined, maxLen = 200): string {
    if (!md) return '';
    const { body } = parseFrontmatter(md);
    const plain = body
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*_>\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return plain.length > maxLen ? plain.slice(0, maxLen - 1) + '…' : plain;
}
