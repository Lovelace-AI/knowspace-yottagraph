<template>
    <div class="page" v-if="entity">
        <div class="crumbs">
            <NuxtLink to="/entities">Entities</NuxtLink>
            <span class="sep">/</span>
            <span>{{ entity.canonical_name }}</span>
        </div>

        <header class="hero">
            <div class="hero-type">{{ entity.entity_type || 'Entity' }}</div>
            <h1 class="hero-name">{{ entity.canonical_name }}</h1>
            <p class="hero-summary" v-if="entity.summary">{{ entity.summary }}</p>
            <div class="meta-row">
                <span class="meta">
                    <v-icon size="14">mdi-format-list-text</v-icon>
                    {{ mentions.length }} mention{{ mentions.length === 1 ? '' : 's' }}
                </span>
                <span class="meta" v-if="entity.confidence">
                    <v-icon size="14">mdi-shield-check-outline</v-icon>
                    Confidence {{ (entity.confidence * 100).toFixed(0) }}%
                </span>
                <span class="meta" v-if="entity.yottagraph_entity_id">
                    <v-icon size="14">mdi-graph-outline</v-icon>
                    Linked to Lovelace graph
                </span>
            </div>
        </header>

        <section class="block">
            <h2 class="block-title">Mentioned in</h2>
            <div v-if="mentions.length === 0" class="muted">
                No mentions recorded yet. The enrichment pipeline (Phase 5) will populate this list
                as it processes pages and indexed documents.
            </div>
            <div v-else class="mention-list">
                <NuxtLink
                    v-for="m in mentions"
                    :key="m.id"
                    :to="m.page_id ? `/pages/${m.page_id}` : '#'"
                    class="mention-row"
                >
                    <span class="mention-emoji">{{ m.page_emoji || '📄' }}</span>
                    <div class="mention-meta">
                        <div class="mention-title">{{ m.page_title || 'External document' }}</div>
                        <div class="mention-snippet">{{ m.context_snippet }}</div>
                    </div>
                </NuxtLink>
            </div>
        </section>

        <section class="block" v-if="related.length > 0">
            <h2 class="block-title">Related entities</h2>
            <div class="related-grid">
                <NuxtLink
                    v-for="r in related"
                    :key="r.other_id"
                    :to="`/entities/${r.other_id}`"
                    class="related-card"
                >
                    <div class="related-type">{{ r.other_type }}</div>
                    <div class="related-name">{{ r.other_name }}</div>
                    <div class="related-rel">{{ r.relationship_type }}</div>
                </NuxtLink>
            </div>
        </section>

        <section class="block">
            <h2 class="block-title">Provenance</h2>
            <div class="src-block">
                <div class="src-label">Canonical ID</div>
                <div class="src-value mono">{{ entity.id }}</div>
            </div>
            <div class="src-block" v-if="entity.yottagraph_entity_id">
                <div class="src-label">Lovelace graph ID</div>
                <div class="src-value mono">{{ entity.yottagraph_entity_id }}</div>
            </div>
            <div class="src-block">
                <div class="src-label">Updated</div>
                <div class="src-value">{{ formatFull(entity.updated_at) }}</div>
            </div>
        </section>
    </div>
    <div v-else-if="loading" class="loading">Loading entity…</div>
    <div v-else class="loading">Entity not found.</div>
</template>

<script setup lang="ts">
    import { ref, watch } from 'vue';

    interface EntityResp {
        entity: {
            id: string;
            canonical_name: string;
            entity_type: string | null;
            summary: string | null;
            confidence: number | null;
            yottagraph_entity_id: string | null;
            updated_at: string;
        };
        mentions: Array<{
            id: string;
            page_id: string | null;
            page_title: string | null;
            page_emoji: string | null;
            context_snippet: string;
        }>;
        related: Array<{
            other_id: string;
            other_name: string;
            other_type: string | null;
            relationship_type: string | null;
        }>;
    }

    const route = useRoute();
    const entity = ref<EntityResp['entity'] | null>(null);
    const mentions = ref<EntityResp['mentions']>([]);
    const related = ref<EntityResp['related']>([]);
    const loading = ref(true);

    async function load(id: string) {
        loading.value = true;
        try {
            const res = await $fetch<EntityResp>(`/api/entities/${id}`);
            entity.value = res.entity;
            mentions.value = res.mentions || [];
            related.value = res.related || [];
        } catch {
            entity.value = null;
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => route.params.id,
        (id) => {
            if (typeof id === 'string') load(id);
        },
        { immediate: true }
    );

    function formatFull(iso: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleString();
    }
</script>

<style scoped>
    .page {
        padding: 32px 48px 80px;
        max-width: 920px;
        margin: 0 auto;
    }
    .crumbs {
        font-size: 0.78rem;
        color: var(--lv-silver, #888);
        margin-bottom: 16px;
    }
    .crumbs a {
        color: var(--lv-silver, #aaa);
        text-decoration: none;
    }
    .crumbs a:hover {
        color: #fff;
    }
    .sep {
        margin: 0 6px;
        color: rgba(255, 255, 255, 0.25);
    }

    .hero {
        margin-bottom: 36px;
    }
    .hero-type {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin-bottom: 6px;
    }
    .hero-name {
        font-family: var(--font-headline, serif);
        font-weight: 400;
        font-size: 2.2rem;
        margin: 0 0 8px;
    }
    .hero-summary {
        color: var(--lv-silver, #ccc);
        font-size: 1rem;
        line-height: 1.5;
        max-width: 700px;
    }
    .meta-row {
        display: flex;
        gap: 18px;
        margin-top: 16px;
        flex-wrap: wrap;
    }
    .meta {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8rem;
        color: var(--lv-silver, #888);
    }

    .block {
        margin-bottom: 36px;
    }
    .block-title {
        font-family: var(--font-mono, monospace);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--lv-silver, #888);
        margin: 0 0 12px;
    }
    .muted {
        color: var(--lv-silver, #888);
        font-size: 0.9rem;
        line-height: 1.5;
    }

    .mention-list {
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        overflow: hidden;
    }
    .mention-row {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        text-decoration: none;
        color: inherit;
    }
    .mention-row:last-child {
        border-bottom: none;
    }
    .mention-row:hover {
        background: rgba(255, 255, 255, 0.03);
    }
    .mention-emoji {
        font-size: 1.2rem;
    }
    .mention-title {
        font-weight: 500;
        font-size: 0.92rem;
    }
    .mention-snippet {
        font-size: 0.82rem;
        color: var(--lv-silver, #aaa);
        margin-top: 2px;
        line-height: 1.4;
    }

    .related-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
    }
    .related-card {
        display: block;
        padding: 12px 14px;
        border-radius: 8px;
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        text-decoration: none;
        color: inherit;
    }
    .related-card:hover {
        border-color: rgba(63, 234, 0, 0.4);
    }
    .related-type {
        font-family: var(--font-mono, monospace);
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
    }
    .related-name {
        font-weight: 500;
        margin: 4px 0;
    }
    .related-rel {
        font-size: 0.78rem;
        color: var(--lv-silver, #aaa);
    }

    .src-block {
        margin-bottom: 12px;
    }
    .src-label {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin-bottom: 4px;
    }
    .src-value {
        font-size: 0.88rem;
        color: #e5e5e5;
    }
    .src-value.mono {
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
        word-break: break-all;
        color: var(--lv-silver, #bbb);
    }

    .loading {
        padding: 60px;
        text-align: center;
        color: var(--lv-silver, #888);
    }
</style>
