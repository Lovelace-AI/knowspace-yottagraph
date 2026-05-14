import type { H3Event } from 'h3';

import { getDb } from './neon';
import { ensureSchema } from './schema';
import { unsealCookie } from './cookies';

const DEFAULT_WORKSPACE_ID = 'ws_default';
const DEFAULT_WORKSPACE_SLUG = 'default';
const DEFAULT_WORKSPACE_NAME = 'Knowspace';

/**
 * Identify the signed-in user from the request cookie (or fall back to the
 * dev-mode bypass user). Used to attribute pages and AI answers.
 */
export async function getUserSub(event: H3Event): Promise<string | null> {
    try {
        const cookie = await unsealCookie(event);
        return cookie?.user?.sub || null;
    } catch {
        return null;
    }
}

/**
 * For the MVP, every signed-in user shares a single workspace. We seed it on
 * first access and return its id. Future versions can introduce
 * multi-workspace selection.
 *
 * Returns null when Postgres is not configured (local dev, no DATABASE_URL).
 */
export async function getOrCreateDefaultWorkspace(event: H3Event): Promise<string | null> {
    const sql = getDb();
    if (!sql) return null;
    const ready = await ensureSchema();
    if (!ready) return null;

    const ownerSub = await getUserSub(event);

    const rows = await sql`SELECT id FROM workspaces WHERE id = ${DEFAULT_WORKSPACE_ID} LIMIT 1`;
    if (rows.length > 0) return DEFAULT_WORKSPACE_ID;

    await sql`INSERT INTO workspaces (id, name, slug, owner_sub)
        VALUES (${DEFAULT_WORKSPACE_ID}, ${DEFAULT_WORKSPACE_NAME}, ${DEFAULT_WORKSPACE_SLUG}, ${ownerSub})
        ON CONFLICT (id) DO NOTHING`;

    return DEFAULT_WORKSPACE_ID;
}

/**
 * Compact, URL-safe id. Not cryptographic — just unique within a workspace.
 */
export function newId(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix}_${time}${rand}`;
}

/**
 * Slugify a title for use in URLs / Notion-import path matching.
 */
export function slugify(input: string): string {
    return (input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
