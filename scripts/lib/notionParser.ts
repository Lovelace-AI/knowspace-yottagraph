import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Pure-ish library for parsing a Notion workspace export directory tree
 * into the Knowspace data model. No DB writes — produces a `ParsedExport`
 * that downstream code (a server route, a CLI committer, a SQL emitter)
 * can consume.
 *
 * Notion export conventions handled here:
 *   - Each page is a `.md` file. The trailing 32-hex chunk on the
 *     filename is the Notion ID; the rest is the human-readable title.
 *   - A page's children live in a sibling folder with the same
 *     human-readable name (no hex, no extension).
 *   - A database is a `.csv` file; the variant ending in `_all.csv` is
 *     the full-column export. View-only `.csv` files (without `_all`)
 *     are alternate views of the same database and we skip them.
 *   - A database may have row-pages: `.md` files in a sibling folder
 *     with the database's stripped name. We import them as collection
 *     records linked to a per-row page.
 *   - Internal links inside `.md` look like
 *     `[Title](Some%20Folder/Some%20Page%2032hex.md)` — relative,
 *     URL-encoded, may end in `.md`, `.csv`, or other.
 *   - In CSV cells, references look like
 *     `Display Name (https://www.notion.so/<32hex>?pvs=21)`.
 */

export interface NotionPage {
    /** Synthetic Knowspace id (we mint it). */
    id: string;
    /** Notion's 32-hex id, if recoverable. */
    notion_id: string | null;
    title: string;
    emoji: string | null;
    parent_id: string | null;
    /** Path inside the export, kept for provenance + report. */
    source_path: string;
    /** Set to a collection id when this page is a row of a CSV-imported collection. */
    collection_id: string | null;
    content_markdown: string;
    /** Bytes of the original .md file, for reporting. */
    bytes: number;
}

export interface NotionCollectionField {
    name: string;
    /** Heuristic: text | number | date | select | multi_select | url | checkbox | person | relation */
    field_type: string;
}

export interface NotionCollectionRecord {
    id: string;
    /** Linked detail page (if a row-page exists), else null. */
    page_id: string | null;
    properties: Record<string, string>;
}

export interface NotionCollection {
    id: string;
    title: string;
    notion_id: string | null;
    parent_id: string | null;
    source_path: string;
    fields: NotionCollectionField[];
    records: NotionCollectionRecord[];
    excluded?: boolean;
    excluded_reason?: string;
}

export interface ParseStats {
    pages: number;
    collections: number;
    collection_records: number;
    excluded_collections: number;
    excluded_collection_rows: number;
    skipped_view_csvs: number;
    unsupported_files: number;
    bytes_markdown: number;
    bytes_csv: number;
}

export interface ParsedExport {
    root_path: string;
    excluded_collection_names: string[];
    pages: NotionPage[];
    collections: NotionCollection[];
    /** Notion 32-hex id → minted page or collection id. */
    notion_id_index: Record<string, { kind: 'page' | 'collection'; id: string }>;
    /** Stripped filename (lowercased, no hex, no ext) → ids that match. */
    title_index: Record<string, Array<{ kind: 'page' | 'collection'; id: string }>>;
    stats: ParseStats;
    warnings: string[];
}

const NOTION_HEX = /[0-9a-f]{32}/i;
const TRAILING_HEX = /(?:^|\s)([0-9a-f]{32})$/i;

function stripNotionHex(name: string): { clean: string; hex: string | null } {
    const m = TRAILING_HEX.exec(name);
    if (m) return { clean: name.slice(0, m.index).trim(), hex: m[1].toLowerCase() };
    return { clean: name.trim(), hex: null };
}

function basenameWithoutExt(file: string): { stem: string; ext: string } {
    const base = path.basename(file);
    const dot = base.lastIndexOf('.');
    if (dot < 0) return { stem: base, ext: '' };
    return { stem: base.slice(0, dot), ext: base.slice(dot + 1).toLowerCase() };
}

/**
 * Mint a stable id from a source path. The `_n_` infix marks an
 * id as Notion-imported so re-imports update existing rows
 * (`ON CONFLICT (id) DO UPDATE`) and never collide with the
 * timestamp-keyed ids that native page creation mints.
 */
function mintId(prefix: 'pg' | 'col' | 'rec', source_path: string): string {
    const h = createHash('sha1').update(source_path).digest('hex').slice(0, 16);
    return `${prefix}_n_${h}`;
}

/**
 * Parse a CSV string into rows, handling quoted fields with embedded
 * commas, newlines, and escaped quotes. Notion's exports are RFC-4180
 * compliant.
 */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            cell += ch;
            i++;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            i++;
            continue;
        }
        if (ch === ',') {
            row.push(cell);
            cell = '';
            i++;
            continue;
        }
        if (ch === '\n' || ch === '\r') {
            row.push(cell);
            cell = '';
            rows.push(row);
            row = [];
            if (ch === '\r' && text[i + 1] === '\n') i += 2;
            else i++;
            continue;
        }
        cell += ch;
        i++;
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

function inferFieldType(values: string[]): string {
    const sample = values.filter((v) => v && v.trim().length > 0).slice(0, 50);
    if (sample.length === 0) return 'text';
    const isNumber = sample.every((v) => /^-?\d+(\.\d+)?$/.test(v.trim()));
    if (isNumber) return 'number';
    const isDate = sample.every((v) =>
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{4}-\d{2}-\d{2}|^[A-Z][a-z]+ \d{1,2}, \d{4}/.test(v.trim())
    );
    if (isDate) return 'date';
    const isUrl = sample.every((v) => /^https?:\/\//.test(v.trim()));
    if (isUrl) return 'url';
    const isCheckbox = sample.every((v) => /^(yes|no|true|false|on|off)$/i.test(v.trim()));
    if (isCheckbox) return 'checkbox';
    const hasMulti = sample.some((v) => v.includes(', '));
    const distinct = new Set(sample.map((v) => v.trim().toLowerCase())).size;
    if (!hasMulti && distinct <= Math.max(8, Math.floor(sample.length / 4))) return 'select';
    if (hasMulti) return 'multi_select';
    return 'text';
}

interface WalkContext {
    root: string;
    excluded: Set<string>;
    out: ParsedExport;
}

function isHexOnly(name: string): boolean {
    return /^[0-9a-f]{32}$/i.test(name.trim());
}

/**
 * Group sibling entries by their stripped (clean, no hex) name so a
 * `Foo HEX.md` page and its `Foo HEX/` (or `Foo/`) child folder land in
 * one bucket.
 */
function groupSiblings(
    dir: string
): Map<string, { mdFile?: string; csvFullFile?: string; csvViewFiles: string[]; folder?: string }> {
    const groups = new Map<
        string,
        { mdFile?: string; csvFullFile?: string; csvViewFiles: string[]; folder?: string }
    >();
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return groups;
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const { clean } = stripNotionHex(entry.name);
            const key = clean.toLowerCase();
            const g = groups.get(key) || { csvViewFiles: [] };
            g.folder = full;
            groups.set(key, g);
            continue;
        }
        const { stem, ext } = basenameWithoutExt(entry.name);
        if (ext === 'md') {
            const { clean } = stripNotionHex(stem);
            const key = clean.toLowerCase();
            const g = groups.get(key) || { csvViewFiles: [] };
            g.mdFile = full;
            groups.set(key, g);
            continue;
        }
        if (ext === 'csv') {
            const isAll = stem.endsWith('_all');
            const stemNoAll = isAll ? stem.slice(0, -'_all'.length) : stem;
            const { clean } = stripNotionHex(stemNoAll);
            const key = clean.toLowerCase();
            const g = groups.get(key) || { csvViewFiles: [] };
            if (isAll) g.csvFullFile = full;
            else g.csvViewFiles.push(full);
            groups.set(key, g);
            continue;
        }
    }
    return groups;
}

function readPageContent(file: string): { title: string; emoji: string | null; body: string } {
    const text = fs.readFileSync(file, 'utf-8');
    const lines = text.split('\n');
    let title = '';
    let emoji: string | null = null;
    let bodyStart = 0;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const m = lines[i].match(/^# (.+)$/);
        if (m) {
            title = m[1].trim();
            const emojiMatch = title.match(/^(\p{Extended_Pictographic})\s+(.+)$/u);
            if (emojiMatch) {
                emoji = emojiMatch[1];
                title = emojiMatch[2];
            }
            bodyStart = i + 1;
            break;
        }
    }
    const body = lines.slice(bodyStart).join('\n').replace(/^\s+/, '');
    return { title, emoji, body };
}

function walkDir(dir: string, parentId: string | null, ctx: WalkContext): void {
    const groups = groupSiblings(dir);
    for (const [, g] of groups) {
        if (g.csvFullFile) {
            handleCollection(g.csvFullFile, g.folder, parentId, ctx);
            ctx.out.stats.skipped_view_csvs += g.csvViewFiles.length;
            continue;
        }
        if (g.mdFile) {
            handlePageFile(g.mdFile, g.folder || null, parentId, ctx);
            continue;
        }
        if (g.folder) {
            handleFolderOnly(g.folder, parentId, ctx);
            continue;
        }
        ctx.out.stats.unsupported_files += g.csvViewFiles.length;
    }
}

function handleFolderOnly(folder: string, parentId: string | null, ctx: WalkContext): void {
    const folderName = path.basename(folder);
    if (isHexOnly(folderName)) {
        walkDir(folder, parentId, ctx);
        return;
    }
    const { clean } = stripNotionHex(folderName);
    const source_path = path.relative(ctx.root, folder);
    const id = mintId('pg', source_path);
    const page: NotionPage = {
        id,
        notion_id: null,
        title: clean,
        emoji: null,
        parent_id: parentId,
        source_path,
        collection_id: null,
        content_markdown: '',
        bytes: 0,
    };
    ctx.out.pages.push(page);
    ctx.out.stats.pages++;
    ctx.out.title_index[clean.toLowerCase()] = (
        ctx.out.title_index[clean.toLowerCase()] || []
    ).concat([{ kind: 'page', id }]);
    walkDir(folder, id, ctx);
}

function handlePageFile(
    mdFile: string,
    childFolder: string | null,
    parentId: string | null,
    ctx: WalkContext
): void {
    const base = path.basename(mdFile);
    const { stem } = basenameWithoutExt(base);
    const { clean, hex } = stripNotionHex(stem);
    const source_path = path.relative(ctx.root, mdFile);
    const id = mintId('pg', source_path);
    const stat = fs.statSync(mdFile);
    const { title, emoji, body } = readPageContent(mdFile);
    const finalTitle = title || clean || 'Untitled';
    const page: NotionPage = {
        id,
        notion_id: hex,
        title: finalTitle,
        emoji,
        parent_id: parentId,
        source_path,
        collection_id: null,
        content_markdown: body,
        bytes: stat.size,
    };
    ctx.out.pages.push(page);
    ctx.out.stats.pages++;
    ctx.out.stats.bytes_markdown += stat.size;
    if (hex) ctx.out.notion_id_index[hex] = { kind: 'page', id };
    ctx.out.title_index[finalTitle.toLowerCase()] = (
        ctx.out.title_index[finalTitle.toLowerCase()] || []
    ).concat([{ kind: 'page', id }]);
    if (childFolder) walkDir(childFolder, id, ctx);
}

function handleCollection(
    csvFile: string,
    rowFolder: string | undefined,
    parentId: string | null,
    ctx: WalkContext
): void {
    const base = path.basename(csvFile);
    const { stem } = basenameWithoutExt(base);
    const stemNoAll = stem.endsWith('_all') ? stem.slice(0, -'_all'.length) : stem;
    const { clean, hex } = stripNotionHex(stemNoAll);
    const source_path = path.relative(ctx.root, csvFile);
    const id = mintId('col', source_path);
    const stat = fs.statSync(csvFile);
    ctx.out.stats.bytes_csv += stat.size;

    const excluded = ctx.excluded.has(clean.toLowerCase());
    const collection: NotionCollection = {
        id,
        title: clean,
        notion_id: hex,
        parent_id: parentId,
        source_path,
        fields: [],
        records: [],
    };

    if (excluded) {
        collection.excluded = true;
        collection.excluded_reason = `name "${clean}" matches exclusion list`;
        ctx.out.collections.push(collection);
        ctx.out.stats.excluded_collections++;
        if (rowFolder) {
            const rowFiles = countMarkdownFiles(rowFolder);
            ctx.out.stats.excluded_collection_rows += rowFiles;
        }
        return;
    }

    const csvText = fs.readFileSync(csvFile, 'utf-8');
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
        ctx.out.collections.push(collection);
        ctx.out.stats.collections++;
        return;
    }
    const header = rows[0];
    const data = rows.slice(1).filter((r) => r.length > 0 && r.some((c) => c.trim() !== ''));

    const columnsValues: string[][] = header.map((_, ci) => data.map((r) => r[ci] || ''));
    collection.fields = header.map((name, ci) => ({
        name: name.trim() || `Field ${ci + 1}`,
        field_type: inferFieldType(columnsValues[ci]),
    }));

    let rowFolderGroups: Map<
        string,
        { mdFile?: string; folder?: string; csvViewFiles: string[]; csvFullFile?: string }
    > | null = null;
    if (rowFolder) rowFolderGroups = groupSiblings(rowFolder);

    for (const row of data) {
        const props: Record<string, string> = {};
        for (let ci = 0; ci < header.length; ci++) {
            props[header[ci].trim() || `Field ${ci + 1}`] = (row[ci] || '').trim();
        }
        const recId = mintId('rec', `${source_path}#${ctx.out.stats.collection_records}`);
        let pageId: string | null = null;
        const nameCell = row[0] || '';
        if (rowFolderGroups && nameCell) {
            const key = nameCell.trim().toLowerCase();
            const match = rowFolderGroups.get(key);
            if (match?.mdFile) {
                handlePageFile(match.mdFile, match.folder || null, parentId, ctx);
                const lastPage = ctx.out.pages[ctx.out.pages.length - 1];
                if (lastPage) {
                    lastPage.collection_id = id;
                    pageId = lastPage.id;
                }
            }
        }
        collection.records.push({ id: recId, page_id: pageId, properties: props });
        ctx.out.stats.collection_records++;
    }

    ctx.out.collections.push(collection);
    ctx.out.stats.collections++;
    if (hex) ctx.out.notion_id_index[hex] = { kind: 'collection', id };
    ctx.out.title_index[clean.toLowerCase()] = (
        ctx.out.title_index[clean.toLowerCase()] || []
    ).concat([{ kind: 'collection', id }]);
}

function countMarkdownFiles(dir: string): number {
    let count = 0;
    const stack = [dir];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(cur, e.name);
            if (e.isDirectory()) stack.push(full);
            else if (e.isFile() && e.name.endsWith('.md')) count++;
        }
    }
    return count;
}

/**
 * Resolve internal Notion-export links inside Markdown to either an
 * internal `/pages/<id>` URL or, failing that, leave the link alone but
 * record an unresolved warning.
 */
export function rewriteLinks(parsed: ParsedExport): {
    resolved: number;
    unresolved: number;
    unresolved_examples: string[];
} {
    let resolved = 0;
    let unresolved = 0;
    const unresolved_examples: string[] = [];

    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;

    function resolveTarget(target: string): string | null {
        const decoded = decodeURIComponent(target);
        const hex = NOTION_HEX.exec(decoded);
        if (hex) {
            const idx = parsed.notion_id_index[hex[0].toLowerCase()];
            if (idx) {
                if (idx.kind === 'page') return `/pages/${idx.id}`;
                return `/collections/${idx.id}`;
            }
        }
        const stem = path
            .basename(decoded)
            .replace(/\.(md|csv)$/i, '')
            .replace(/_all$/i, '');
        const { clean } = stripNotionHex(stem);
        const matches = parsed.title_index[clean.toLowerCase()];
        if (matches && matches.length > 0) {
            const m = matches[0];
            if (m.kind === 'page') return `/pages/${m.id}`;
            return `/collections/${m.id}`;
        }
        return null;
    }

    for (const page of parsed.pages) {
        if (!page.content_markdown) continue;
        page.content_markdown = page.content_markdown.replace(linkRe, (whole, label, target) => {
            if (/^https?:\/\//i.test(target)) {
                const hex = NOTION_HEX.exec(target);
                if (hex) {
                    const idx = parsed.notion_id_index[hex[0].toLowerCase()];
                    if (idx) {
                        resolved++;
                        return `[${label}](${idx.kind === 'page' ? `/pages/${idx.id}` : `/collections/${idx.id}`})`;
                    }
                }
                return whole;
            }
            const link = resolveTarget(target);
            if (link) {
                resolved++;
                return `[${label}](${link})`;
            }
            unresolved++;
            if (unresolved_examples.length < 10) unresolved_examples.push(target);
            return whole;
        });
    }

    return { resolved, unresolved, unresolved_examples };
}

/**
 * Parse an entire Notion workspace export rooted at `rootPath`, applying
 * the given exclusion list (case-insensitive match against the cleaned
 * collection names).
 */
export function parseNotionExport(
    rootPath: string,
    excludedCollectionNames: string[] = []
): ParsedExport {
    const out: ParsedExport = {
        root_path: rootPath,
        excluded_collection_names: excludedCollectionNames.map((s) => s.toLowerCase()),
        pages: [],
        collections: [],
        notion_id_index: {},
        title_index: {},
        stats: {
            pages: 0,
            collections: 0,
            collection_records: 0,
            excluded_collections: 0,
            excluded_collection_rows: 0,
            skipped_view_csvs: 0,
            unsupported_files: 0,
            bytes_markdown: 0,
            bytes_csv: 0,
        },
        warnings: [],
    };
    const ctx: WalkContext = {
        root: rootPath,
        excluded: new Set(excludedCollectionNames.map((s) => s.toLowerCase())),
        out,
    };
    walkDir(rootPath, null, ctx);
    return out;
}
