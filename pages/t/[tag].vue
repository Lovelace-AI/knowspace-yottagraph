<template>
    <div class="tag-page">
        <header class="page-header">
            <div class="eyebrow">Tag</div>
            <h1 class="page-title">#{{ tag }}</h1>
            <p class="page-sub">{{ pages.length }} doc{{ pages.length === 1 ? '' : 's' }}</p>
        </header>

        <div class="view-row">
            <v-btn-toggle
                v-model="viewMode"
                density="compact"
                color="primary"
                mandatory
                variant="text"
            >
                <v-btn value="list" size="small">List</v-btn>
                <v-btn value="table" size="small" :disabled="!canRenderTable">Table</v-btn>
            </v-btn-toggle>
            <span v-if="!canRenderTable" class="hint"
                >Table view appears when docs share frontmatter keys.</span
            >
        </div>

        <div v-if="loading" class="muted">Loading docs…</div>
        <div v-else-if="pages.length === 0" class="muted">No docs for this tag yet.</div>

        <div v-else-if="viewMode === 'table' && canRenderTable">
            <v-table density="compact" class="table">
                <thead>
                    <tr>
                        <th>Doc</th>
                        <th v-for="key in tableKeys" :key="key">{{ key }}</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="doc in pages" :key="doc.id">
                        <td>
                            <NuxtLink :to="`/pages/${doc.id}`" class="doc-link">
                                {{ doc.emoji || '📄' }} {{ doc.title || 'Untitled' }}
                            </NuxtLink>
                        </td>
                        <td v-for="key in tableKeys" :key="`${doc.id}-${key}`">
                            {{ stringifyCell(doc.frontmatter?.[key]) }}
                        </td>
                        <td>{{ formatRelative(doc.updated_at) }}</td>
                    </tr>
                </tbody>
            </v-table>
        </div>

        <div v-else class="list">
            <NuxtLink v-for="doc in pages" :key="doc.id" :to="`/pages/${doc.id}`" class="doc-card">
                <div class="title">{{ doc.emoji || '📄' }} {{ doc.title || 'Untitled' }}</div>
                <div class="snippet">
                    {{ snippet(doc.markdown_body || doc.content_markdown || '') }}
                </div>
                <div class="time">{{ formatRelative(doc.updated_at) }}</div>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import { stripMarkdown } from '~/utils/markdown';

    interface TaggedPage {
        id: string;
        title: string;
        emoji: string | null;
        content_markdown: string;
        markdown_body?: string;
        updated_at: string;
        frontmatter?: Record<string, unknown>;
    }

    const route = useRoute();
    const tag = computed(() =>
        decodeURIComponent((route.params.tag as string) || '').toLowerCase()
    );
    const loading = ref(false);
    const pages = ref<TaggedPage[]>([]);
    const viewMode = ref<'list' | 'table'>('list');

    const tableKeys = computed(() => {
        if (pages.value.length === 0) return [];
        const keyCounts = new Map<string, number>();
        for (const p of pages.value) {
            const keys = Object.keys(p.frontmatter || {});
            for (const key of keys) {
                keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
            }
        }
        return [...keyCounts.entries()]
            .filter(([, count]) => count >= Math.ceil(pages.value.length * 0.6))
            .map(([key]) => key)
            .sort();
    });

    const canRenderTable = computed(() => tableKeys.value.length > 0);

    async function loadTag() {
        loading.value = true;
        try {
            const res = await $fetch<{ pages: TaggedPage[] }>(
                `/api/tags/${encodeURIComponent(tag.value)}`
            );
            pages.value = res.pages || [];
            if (viewMode.value === 'table' && !canRenderTable.value) viewMode.value = 'list';
        } finally {
            loading.value = false;
        }
    }

    watch(tag, () => void loadTag(), { immediate: true });

    function snippet(md: string): string {
        return stripMarkdown(md || '', 180);
    }

    function stringifyCell(v: unknown): string {
        if (Array.isArray(v)) return v.join(', ');
        if (v === null || v === undefined || v === '') return '—';
        return String(v);
    }

    function formatRelative(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'now';
        if (min < 60) return `${min}m`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h`;
        const day = Math.floor(hr / 24);
        if (day < 7) return `${day}d`;
        return d.toLocaleDateString();
    }
</script>

<style scoped>
    .tag-page {
        padding: 40px 48px 80px;
    }
    .eyebrow {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--lv-silver, #888);
    }
    .page-title {
        margin: 4px 0;
        font-size: 2rem;
        font-family: var(--font-headline, serif);
        font-weight: 400;
    }
    .page-sub {
        color: var(--lv-silver, #999);
    }
    .view-row {
        margin: 16px 0;
        display: flex;
        gap: 12px;
        align-items: center;
    }
    .hint {
        font-size: 0.8rem;
        color: var(--lv-silver, #888);
    }
    .list {
        display: grid;
        gap: 8px;
    }
    .doc-card {
        display: block;
        text-decoration: none;
        color: inherit;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.01);
    }
    .doc-card:hover {
        border-color: rgba(63, 234, 0, 0.35);
    }
    .title {
        font-size: 0.92rem;
        font-weight: 500;
    }
    .snippet {
        margin-top: 4px;
        font-size: 0.82rem;
        color: var(--lv-silver, #aaa);
    }
    .time {
        margin-top: 6px;
        font-size: 0.72rem;
        color: var(--lv-silver, #888);
        font-family: var(--font-mono, monospace);
    }
    .muted {
        color: var(--lv-silver, #888);
    }
    .table {
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
    }
    .doc-link {
        color: inherit;
        text-decoration: none;
    }
</style>
