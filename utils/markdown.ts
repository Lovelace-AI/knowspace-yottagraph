// Minimal Markdown renderer.
//
// Intentionally tiny -- no external dependencies. Supports:
//   - headings (#, ##, ###)
//   - paragraphs and blank-line separation
//   - bold (**), italic (*), inline code (`)
//   - unordered lists (-, *)
//   - ordered lists (1.)
//   - blockquotes (>)
//   - fenced code blocks (```)
//   - links [text](url) and internal /pages/<id> rewriting
//   - autolinked plain URLs
//
// HTML output is escaped for raw text. Internal-link rewriting is done by
// callers; this renderer treats /pages/<id> as a regular link.

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInline(raw: string): string {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
        const safeHref = href.replace(/"/g, '&quot;');
        const isInternal = safeHref.startsWith('/');
        const target = isInternal ? '' : ' target="_blank" rel="noopener"';
        return `<a href="${safeHref}"${target}>${label}</a>`;
    });
    s = s.replace(
        /(^|\s)(https?:\/\/[^\s<]+)/g,
        '$1<a href="$2" target="_blank" rel="noopener">$2</a>'
    );
    return s;
}

export function renderMarkdown(markdown: string): string {
    if (!markdown) return '';
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let i = 0;
    let inUl = false;
    let inOl = false;
    let inBlockquote = false;

    const closeLists = () => {
        if (inUl) {
            out.push('</ul>');
            inUl = false;
        }
        if (inOl) {
            out.push('</ol>');
            inOl = false;
        }
        if (inBlockquote) {
            out.push('</blockquote>');
            inBlockquote = false;
        }
    };

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('```')) {
            closeLists();
            const lang = line.slice(3).trim();
            const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
            const codeLines: string[] = [];
            i += 1;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i]);
                i += 1;
            }
            i += 1;
            out.push(`<pre${langAttr}><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            closeLists();
            const level = headingMatch[1].length;
            out.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
            i += 1;
            continue;
        }

        if (/^\s*[-*]\s+/.test(line)) {
            if (!inUl) {
                closeLists();
                out.push('<ul>');
                inUl = true;
            }
            const content = line.replace(/^\s*[-*]\s+/, '');
            out.push(`<li>${renderInline(content)}</li>`);
            i += 1;
            continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            if (!inOl) {
                closeLists();
                out.push('<ol>');
                inOl = true;
            }
            const content = line.replace(/^\s*\d+\.\s+/, '');
            out.push(`<li>${renderInline(content)}</li>`);
            i += 1;
            continue;
        }

        if (/^\s*>\s?/.test(line)) {
            if (!inBlockquote) {
                closeLists();
                out.push('<blockquote>');
                inBlockquote = true;
            }
            out.push(`<p>${renderInline(line.replace(/^\s*>\s?/, ''))}</p>`);
            i += 1;
            continue;
        }

        if (!line.trim()) {
            closeLists();
            i += 1;
            continue;
        }

        closeLists();
        const paragraph: string[] = [line];
        i += 1;
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|>\s?|```)/.test(lines[i])
        ) {
            paragraph.push(lines[i]);
            i += 1;
        }
        out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    }

    closeLists();
    return out.join('\n');
}
