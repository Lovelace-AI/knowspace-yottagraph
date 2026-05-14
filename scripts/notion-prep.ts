#!/usr/bin/env tsx
/**
 * notion-prep: walk a local Notion workspace export and produce a small
 * Knowspace bundle (JSON) that can be uploaded via the Import Center,
 * piped into Postgres directly, or just inspected as a dry-run report.
 *
 * Usage:
 *   npx tsx scripts/notion-prep.ts --path "import/notion workspace /Export-..." \
 *       --exclude "Contacts,Accounts,Engagements,Opportunities,Campaigns" \
 *       --out import/knowspace-bundle.json
 *
 * Flags:
 *   --path <dir>      (required) path to the Notion export root
 *   --exclude <list>  comma-separated database names to skip
 *   --out <file>      where to write the bundle (default: skip, dry-run only)
 *   --quiet           suppress per-section breakdown
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseNotionExport, rewriteLinks, type ParsedExport } from './lib/notionParser';

interface Args {
    path: string;
    exclude: string[];
    out: string | null;
    quiet: boolean;
}

function parseArgs(): Args {
    const argv = process.argv.slice(2);
    const out: Args = { path: '', exclude: [], out: null, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--path') out.path = argv[++i];
        else if (a === '--exclude')
            out.exclude = argv[++i]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        else if (a === '--out') out.out = argv[++i];
        else if (a === '--quiet') out.quiet = true;
        else if (a === '--help' || a === '-h') {
            printHelp();
            process.exit(0);
        }
    }
    if (!out.path) {
        console.error('Error: --path is required');
        printHelp();
        process.exit(1);
    }
    return out;
}

function printHelp() {
    console.error(`
Usage: npx tsx scripts/notion-prep.ts --path <export-dir> [options]

Options:
  --path <dir>      Notion export root directory (required)
  --exclude <list>  Comma-separated collection names to skip
  --out <file>      Write the parsed bundle as JSON to this path
  --quiet           Suppress per-section summary
`);
}

function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function pad(s: string, n: number): string {
    return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function reportSections(parsed: ParsedExport): void {
    const bySection: Record<
        string,
        { pages: number; cols: number; bytes: number; excluded: number }
    > = {};
    function topSection(rel: string): string {
        const first = rel.split(path.sep)[0];
        return first || '(root)';
    }
    for (const p of parsed.pages) {
        const s = topSection(p.source_path);
        bySection[s] = bySection[s] || { pages: 0, cols: 0, bytes: 0, excluded: 0 };
        bySection[s].pages++;
        bySection[s].bytes += p.bytes;
    }
    for (const c of parsed.collections) {
        const s = topSection(c.source_path);
        bySection[s] = bySection[s] || { pages: 0, cols: 0, bytes: 0, excluded: 0 };
        if (c.excluded) bySection[s].excluded++;
        else bySection[s].cols++;
    }
    console.log('\n=== By section ===');
    console.log(
        pad('Section', 30) +
            pad('Pages', 10) +
            pad('Collections', 14) +
            pad('Excluded', 10) +
            'Markdown bytes'
    );
    for (const [name, s] of Object.entries(bySection).sort()) {
        console.log(
            pad(name, 30) +
                pad(String(s.pages), 10) +
                pad(String(s.cols), 14) +
                pad(String(s.excluded), 10) +
                fmtBytes(s.bytes)
        );
    }
}

async function main() {
    const args = parseArgs();
    if (!fs.existsSync(args.path)) {
        console.error(`Path does not exist: ${args.path}`);
        process.exit(1);
    }
    console.log(`Parsing Notion export at: ${args.path}`);
    if (args.exclude.length > 0) {
        console.log(`Exclusion list: ${args.exclude.join(', ')}`);
    } else {
        console.log('No exclusions applied.');
    }

    const t0 = Date.now();
    const parsed = parseNotionExport(args.path, args.exclude);
    const t1 = Date.now();
    console.log(`Parsed in ${((t1 - t0) / 1000).toFixed(1)}s`);

    const linkResult = rewriteLinks(parsed);
    const t2 = Date.now();
    console.log(`Resolved internal links in ${((t2 - t1) / 1000).toFixed(1)}s`);

    const s = parsed.stats;
    console.log('\n=== Totals ===');
    console.log(`  Pages imported:           ${s.pages}`);
    console.log(`  Collections imported:     ${s.collections}`);
    console.log(`  Collection records:       ${s.collection_records}`);
    console.log(`  Collections EXCLUDED:     ${s.excluded_collections}`);
    console.log(`  Excluded collection rows: ${s.excluded_collection_rows}`);
    console.log(`  View-only CSVs skipped:   ${s.skipped_view_csvs}`);
    console.log(`  Markdown bytes:           ${fmtBytes(s.bytes_markdown)}`);
    console.log(`  CSV bytes:                ${fmtBytes(s.bytes_csv)}`);
    console.log(`  Internal links resolved:  ${linkResult.resolved}`);
    console.log(`  Internal links unresolved:${linkResult.unresolved}`);
    if (linkResult.unresolved_examples.length > 0) {
        console.log(`    Example unresolved targets:`);
        for (const ex of linkResult.unresolved_examples) console.log(`      - ${ex}`);
    }

    const excludedDetail = parsed.collections.filter((c) => c.excluded);
    if (excludedDetail.length > 0) {
        console.log('\n=== Excluded collections ===');
        for (const c of excludedDetail) {
            console.log(`  - "${c.title}" (${c.source_path})`);
        }
    }

    if (!args.quiet) reportSections(parsed);

    if (args.out) {
        const outDir = path.dirname(args.out);
        if (outDir && !fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const bundle = {
            schema_version: 1,
            generated_at: new Date().toISOString(),
            source_root: args.path,
            excluded_collection_names: parsed.excluded_collection_names,
            stats: parsed.stats,
            link_stats: {
                resolved: linkResult.resolved,
                unresolved: linkResult.unresolved,
            },
            pages: parsed.pages,
            collections: parsed.collections.filter((c) => !c.excluded),
        };
        fs.writeFileSync(args.out, JSON.stringify(bundle));
        const outBytes = fs.statSync(args.out).size;
        console.log(`\nWrote bundle: ${args.out} (${fmtBytes(outBytes)})`);
    } else {
        console.log('\n(Dry run — no bundle written. Pass --out <file> to emit JSON.)');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
