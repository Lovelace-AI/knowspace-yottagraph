export default defineEventHandler(async (event) => {
    const url = String(getQuery(event).url || '').trim();
    if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing url' });
    if (!/^https?:\/\//i.test(url)) {
        throw createError({ statusCode: 400, statusMessage: 'Only http(s) URLs are supported' });
    }

    try {
        const html = await $fetch<string>(url, {
            responseType: 'text',
            timeout: 5000,
        });
        const titleMatch = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = (titleMatch?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 220);
        return { title: title || new URL(url).hostname };
    } catch {
        return { title: new URL(url).hostname };
    }
});
