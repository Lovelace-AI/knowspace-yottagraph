import 'dotenv/config';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDb } from '../server/utils/neon';
import { ensureSchema } from '../server/utils/schema';

interface Mapping {
    record_id: string;
    old_page_id: string | null;
    new_page_id: string;
}

interface MigrationReport {
    workspace_id: string;
    mappings: Mapping[];
}

function parseArgs(argv: string[]) {
    let report = '';
    let dryRun = false;
    let force = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--report' && argv[i + 1]) {
            report = argv[i + 1];
            i++;
        } else if (arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '--force') {
            force = true;
        }
    }
    if (!report) {
        throw new Error('Missing --report <path-to-migration-report.json>');
    }
    return { report, dryRun, force };
}

async function main() {
    const { report, dryRun, force } = parseArgs(process.argv.slice(2));
    const reportPath = path.resolve(report);
    if (!fs.existsSync(reportPath)) throw new Error(`Report not found: ${reportPath}`);
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as MigrationReport;
    const mappings = Array.isArray(parsed.mappings) ? parsed.mappings : [];
    if (mappings.length === 0) {
        console.log('[rollback-record-links] report contains no mappings. Nothing to rollback.');
        return;
    }

    const sql = getDb();
    if (!sql) throw new Error('DATABASE_URL missing');
    await ensureSchema();

    let reverted = 0;
    let skipped = 0;
    console.log(
        `[rollback-record-links] workspace=${parsed.workspace_id} mappings=${mappings.length} dry_run=${dryRun ? 'yes' : 'no'} force=${force ? 'yes' : 'no'}`
    );

    for (const m of mappings) {
        const currentRows: any =
            await sql`SELECT page_id FROM collection_records WHERE id = ${m.record_id} LIMIT 1`;
        const current = currentRows[0]?.page_id ?? null;
        if (!force && current !== m.new_page_id) {
            skipped++;
            continue;
        }
        if (!dryRun) {
            await sql`UPDATE collection_records SET page_id = ${m.old_page_id} WHERE id = ${m.record_id}`;
        }
        reverted++;
    }

    console.log(
        `[rollback-record-links] done reverted=${reverted} skipped=${skipped} mode=${dryRun ? 'dry-run' : 'apply'}`
    );
}

main().catch((err) => {
    console.error('[rollback-record-links] failed:', err);
    process.exit(1);
});
