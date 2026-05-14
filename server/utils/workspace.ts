// Knowspace workspace storage utilities.
//
// KV (Upstash Redis) is the system of record for the MVP. Every "collection"
// of workspace objects is stored as a Redis hash whose fields are object IDs
// and whose values are JSON-serialized records. This keeps the data model
// portable -- a later migration to Postgres can mirror the same shapes.
//
// All routes scope writes by workspace ID. For now there is a single
// "default" workspace per user, identified by the cookie's user sub.

import { getRedis } from './redis';
import { unsealCookie } from './cookies';
import type { H3Event, EventHandlerRequest } from 'h3';

export interface AuthedContext {
    userId: string;
    workspaceId: string;
}

export async function requireAuth(event: H3Event<EventHandlerRequest>): Promise<AuthedContext> {
    const cookie = await unsealCookie(event);
    if (!cookie?.user?.sub) {
        throw createError({ statusCode: 401, statusMessage: 'Not authenticated' });
    }
    const userId = String(cookie.user.sub);
    return { userId, workspaceId: 'default' };
}

function safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function wsKey(ctx: AuthedContext, collection: string): string {
    return `kw:${safeId(ctx.userId)}:${safeId(ctx.workspaceId)}:${collection}`;
}

export function newId(prefix: string = 'id'): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${ts}${rand}`;
}

export async function readAll<T>(ctx: AuthedContext, collection: string): Promise<T[]> {
    const redis = getRedis();
    if (!redis) return [];
    const map = (await redis.hgetall(wsKey(ctx, collection))) as Record<string, unknown> | null;
    if (!map) return [];
    const items: T[] = [];
    for (const v of Object.values(map)) {
        items.push(parseValue<T>(v));
    }
    return items;
}

export async function readOne<T>(
    ctx: AuthedContext,
    collection: string,
    id: string
): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.hget<unknown>(wsKey(ctx, collection), id);
    if (raw == null) return null;
    return parseValue<T>(raw);
}

export async function writeOne<T extends { id: string }>(
    ctx: AuthedContext,
    collection: string,
    item: T
): Promise<void> {
    const redis = getRedis();
    if (!redis) {
        throw createError({
            statusCode: 503,
            statusMessage:
                'KV not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN, or deploy to a Vercel env where KV is provisioned.',
        });
    }
    await redis.hset(wsKey(ctx, collection), { [item.id]: JSON.stringify(item) });
}

export async function deleteOne(ctx: AuthedContext, collection: string, id: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    await redis.hdel(wsKey(ctx, collection), id);
}

// Upstash returns values either as already-parsed objects (when stored via the
// JSON-aware SDK) or as JSON strings. Handle both.
function parseValue<T>(value: unknown): T {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return value as unknown as T;
        }
    }
    return value as T;
}

export function nowIso(): string {
    return new Date().toISOString();
}
