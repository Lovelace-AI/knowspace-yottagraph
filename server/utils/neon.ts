import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Check whether DATABASE_URL is set without attempting a connection.
 */
export function isDbConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
}

/**
 * Get the Neon query function. Returns null when DATABASE_URL is not
 * available (local dev, Cursor Cloud, missing provisioning).
 */
export function getDb(): NeonQueryFunction<false, false> | null {
    if (_sql) return _sql;
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    _sql = neon(url);
    return _sql;
}
