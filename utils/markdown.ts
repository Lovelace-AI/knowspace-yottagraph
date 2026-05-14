import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
    gfm: true,
    breaks: true,
});

/**
 * Render a Markdown string to safe HTML for display in a page view.
 * Runs synchronously and assumes a browser DOM is available (used in
 * client components only). Safe to call with empty / null / undefined.
 */
export function renderMarkdown(md: string | null | undefined): string {
    if (!md) return '';
    const raw = marked.parse(md, { async: false }) as string;
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
    const plain = md
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*_>\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return plain.length > maxLen ? plain.slice(0, maxLen - 1) + '…' : plain;
}
