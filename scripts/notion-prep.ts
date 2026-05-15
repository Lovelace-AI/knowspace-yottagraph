#!/usr/bin/env tsx
/**
 * notion-prep: walk a local Notion workspace export and either inspect
 * (dry-run), emit a JSON bundle, write directly to a Postgres database,
 * or POST the bundle to a deployed Knowspace instance.
 *
 * Usage examples:
 *
 *   # Dry-run: print stats and section breakdown only.
 *   npx tsx scripts/notion-prep.ts --path "import/notion workspace /Export-..."
 *
 *   # Emit a portable JSON bundle for later use.
 *   npx tsx scripts/notion-prep.ts --path "..." --out import/bundle.json \
 *       --exclude "Contacts,Accounts,Engagements,Opportunities,Campaigns"
 *
 *   # Direct DB commit (requires DATABASE_URL in env, e.g. via `vercel env pull`).
 *   DATABASE_URL=$(cat .env.production | grep DATABASE_URL | cut -d= -f2-) \
 *     npx tsx scripts/notion-prep.ts --path "..." --commit \
 *       --exclude "Contacts,Accounts,Engagements,Opportunities,Campaigns"
 *
 *   # Upload the bundle to a deployed Knowspace via service API key.
 *   npx tsx scripts/notion-prep.ts --path "..." \
 *       --upload https://knowspace.yottagraph.app \
 *       --api-key "$KNOWSPACE_API_KEY" \
 *       --exclude "Contacts,Accounts,Engagements,Opportunities,Campaigns"
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseNotionExport, rewriteLinks, type ParsedExport } from './lib/notionParser';

interface Args {
    path: string;
    exclude: string[];
    out: string | null;
    commit: boolean;
    upload: string | null;
    apiKey: string | null;
    quiet: boolean;
}

function parseArgs(): Args {
    const argv = process.argv.slice(2);
    const out: Args = {
        path: '',
        exclude: [],
        out: null,
        commit: false,
        upload: null,
        apiKey: null,
        quiet: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--path') out.path = argv[++i];
        else if (a === '--exclude')
            out.exclude = argv[++i]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        else if (a === '--out') out.out = argv[++i];
        else if (a === '--commit') out.commit = true;
        else if (a === '--upload') out.upload = argv[++i];
        else if (a === '--api-key') out.apiKey = argv[++i];
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

Required:
  --path <dir>       Notion export root directory

Output modes (combine freely):
  --out <file>       Write the parsed bundle as JSON
  --commit           Write directly to Postgres via DATABASE_URL
  --upload <baseUrl> POST bundle to <baseUrl>/api/imports/notion/commit-bundle
  --api-key <key>    X-Api-Key for --upload (defaults to env QSAPI_KEY)
  (no output flags)  Dry run — report only

Filtering:
  --exclude <list>   Comma-separated collection names to skip

Other:
  --quiet            Suppress per-section breakdown
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

function buildBundle(parsed: ParsedExport, linkResolved: number, linkUnresolved: number) {
    return {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        source_root: parsed.root_path,
        excluded_collection_names: parsed.excluded_collection_names,
        stats: parsed.stats,
        link_stats: { resolved: linkResolved, unresolved: linkUnresolved },
        pages: parsed.pages,
        collections: parsed.collections.filter((c) => !c.excluded),
    };
}

async function commitDirect(bundle: ReturnType<typeof buildBundle>): Promise<void> {
    if (!process.env.DATABASE_URL) {
        console.error(`
--commit requires DATABASE_URL in the environment. Two ways to get it:
  1. vercel env pull .env.production && export $(grep DATABASE_URL .env.production)
  2. Pull from the Broadchurch portal's secrets API into your shell.
`);
        process.exit(1);
    }
    console.log(
        `\nCommitting ${bundle.pages.length} pages and ${bundle.collections.length} collections to Postgres…`
    );
    const { commitBundle } = await import('../server/utils/notionImport');
    const { ensureSchema } = await import('../server/utils/schema');
    const { getDb } = await import('../server/utils/neon');

    const userSub = process.env.IMPORT_USER_SUB || 'cli-import';
    const workspaceId = process.env.WORKSPACE_ID || 'ws_default';

    await ensureSchema();
    const sql = getDb()!;
    await sql`INSERT INTO workspaces (id, name, slug, owner_sub)
        VALUES (${workspaceId}, 'Knowspace', 'default', ${userSub})
        ON CONFLICT (id) DO NOTHING`;

    const result = await commitBundle(bundle, { workspaceId, userSub });
    console.log('\nCommit complete:');
    console.log(`  batch_id:             ${result.batch_id}`);
    console.log(`  source_id:            ${result.source_id}`);
    console.log(`  pages_inserted:       ${result.pages_inserted}`);
    console.log(`  pages_updated:        ${result.pages_updated}`);
    console.log(`  collections_inserted: ${result.collections_inserted}`);
    console.log(`  records_inserted:     ${result.records_inserted}`);
    console.log(`  duration:             ${(result.duration_ms / 1000).toFixed(1)}s`);
}

async function uploadToDeployment(
    bundle: ReturnType<typeof buildBundle>,
    baseUrl: string,
    apiKey: string | null
): Promise<void> {
    const key = apiKey || process.env.QS_API_KEY || process.env.KNOWSPACE_API_KEY || null;
    if (!key) {
        console.error(`
--upload requires an API key. Provide one of:
  --api-key <key>           on the command line
  QS_API_KEY=<key>          in env (the qs_api_key from broadchurch.yaml)
  KNOWSPACE_API_KEY=<key>   in env
`);
        process.exit(1);
    }
    const url = baseUrl.replace(/\/$/, '') + '/api/imports/notion/commit-bundle';
    console.log(
        `\nUploading bundle (${bundle.pages.length} pages, ${bundle.collections.length} collections) to ${url}…`
    );
    const t0 = Date.now();
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': key,
        },
        body: JSON.stringify(bundle),
    });
    const text = await res.text();
    if (!res.ok) {
        console.error(`Upload failed (${res.status}): ${text}`);
        process.exit(1);
    }
    let result: any;
    try {
        result = JSON.parse(text);
    } catch {
        result = { raw: text };
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nUpload complete in ${elapsed}s:`);
    if (result.batch_id) console.log(`  batch_id:             ${result.batch_id}`);
    if (result.source_id) console.log(`  source_id:            ${result.source_id}`);
    if (typeof result.pages_inserted === 'number')
        console.log(`  pages_inserted:       ${result.pages_inserted}`);
    if (typeof result.pages_updated === 'number')
        console.log(`  pages_updated:        ${result.pages_updated}`);
    if (typeof result.collections_inserted === 'number')
        console.log(`  collections_inserted: ${result.collections_inserted}`);
    if (typeof result.records_inserted === 'number')
        console.log(`  records_inserted:     ${result.records_inserted}`);
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

    const excludedDetail = parsed.collections.filter((c) => c.excluded);
    if (excludedDetail.length > 0) {
        console.log('\n=== Excluded collections ===');
        for (const c of excludedDetail) {
            console.log(`  - "${c.title}" (${c.source_path})`);
        }
    }

    if (!args.quiet) reportSections(parsed);

    const bundle = buildBundle(parsed, linkResult.resolved, linkResult.unresolved);

    if (args.out) {
        const outDir = path.dirname(args.out);
        if (outDir && !fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(bundle));
        const outBytes = fs.statSync(args.out).size;
        console.log(`\nWrote bundle: ${args.out} (${fmtBytes(outBytes)})`);
    }

    if (args.commit) await commitDirect(bundle);
    if (args.upload) await uploadToDeployment(bundle, args.upload, args.apiKey);

    if (!args.out && !args.commit && !args.upload) {
        console.log('\n(Dry run — nothing written. Use --out, --commit, or --upload.)');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
