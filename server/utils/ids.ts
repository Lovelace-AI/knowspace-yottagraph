/**
 * Pure id helpers shared by server routes and the notion-prep CLI.
 * Keeps `notionImport.ts` importable from a vanilla Node script
 * without dragging in Nitro's `useRuntimeConfig` (which `workspace.ts`
 * needs for cookie unsealing).
 */

export function newId(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix}_${time}${rand}`;
}

export function slugify(input: string): string {
    return (input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
