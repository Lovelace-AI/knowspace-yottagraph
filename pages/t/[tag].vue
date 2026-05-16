<template>
    <div class="tag-page d-flex flex-column fill-height">
        <header class="page-header flex-shrink-0">
            <div class="eyebrow">Tag</div>
            <h1 class="page-title">#{{ tag }}</h1>
            <p class="page-sub">
                {{ filteredPages.length }} of {{ pages.length }} doc{{
                    pages.length === 1 ? '' : 's'
                }}
            </p>
        </header>

        <div class="view-row flex-shrink-0">
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
            <v-text-field
                v-model="searchQuery"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                bg-color="surface-variant"
                class="search-input"
                placeholder="Fuzzy search docs in this tag…"
            />
            <span v-if="!canRenderTable" class="hint"
                >Table view appears when docs share frontmatter keys.</span
            >
        </div>

        <div class="results-pane flex-grow-1 overflow-y-auto">
            <div v-if="loading" class="muted">Loading docs…</div>
            <div v-else-if="errorMessage" class="muted">{{ errorMessage }}</div>
            <div v-else-if="filteredPages.length === 0" class="muted">
                {{
                    pages.length === 0 ? 'No docs for this tag yet.' : 'No docs match your search.'
                }}
            </div>

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
                        <tr v-for="doc in filteredPages" :key="doc.id">
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
                <NuxtLink
                    v-for="doc in filteredPages"
                    :key="doc.id"
                    :to="`/pages/${doc.id}`"
                    class="doc-card"
                >
                    <div class="title">{{ doc.emoji || '📄' }} {{ doc.title || 'Untitled' }}</div>
                    <div class="snippet">
                        {{ snippet(doc.markdown_body || doc.content_markdown || '') }}
                    </div>
                    <div class="time">{{ formatRelative(doc.updated_at) }}</div>
                </NuxtLink>
            </div>
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
    const errorMessage = ref('');
    const searchQuery = ref('');
    const viewMode = ref<'list' | 'table'>('list');
    const loadSeq = ref(0);

    const tableKeys = computed(() => {
        if (filteredPages.value.length === 0) return [];
        const keyCounts = new Map<string, number>();
        for (const p of filteredPages.value) {
            const keys = Object.keys(p.frontmatter || {});
            for (const key of keys) {
                keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
            }
        }
        return [...keyCounts.entries()]
            .filter(([, count]) => count >= Math.ceil(filteredPages.value.length * 0.6))
            .map(([key]) => key)
            .sort();
    });

    const canRenderTable = computed(() => tableKeys.value.length > 0);

    const filteredPages = computed(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return pages.value;
        const scored = pages.value
            .map((doc) => {
                const title = String(doc.title || '').toLowerCase();
                const body = String(doc.markdown_body || doc.content_markdown || '').toLowerCase();
                const haystack = `${title}\n${body}`;
                return {
                    doc,
                    score: fuzzyScore(haystack, q),
                };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
        return scored.map((x) => x.doc);
    });

    async function loadTag() {
        const seq = ++loadSeq.value;
        loading.value = true;
        errorMessage.value = '';
        pages.value = [];
        try {
            const res = await $fetch<{ pages: TaggedPage[] }>(
                `/api/tags/${encodeURIComponent(tag.value)}`
            );
            if (seq !== loadSeq.value) return;
            pages.value = res.pages || [];
            if (viewMode.value === 'table' && !canRenderTable.value) viewMode.value = 'list';
        } catch {
            if (seq !== loadSeq.value) return;
            errorMessage.value = 'Could not load docs for this tag.';
            pages.value = [];
        } finally {
            if (seq === loadSeq.value) loading.value = false;
        }
    }

    watch(
        tag,
        () => {
            searchQuery.value = '';
            void loadTag();
        },
        { immediate: true }
    );

    function snippet(md: string): string {
        return stripMarkdown(md || '', 180);
    }

    function stringifyCell(v: unknown): string {
        if (Array.isArray(v)) return v.join(', ');
        if (v === null || v === undefined || v === '') return '—';
        return String(v);
    }

    function fuzzyScore(haystack: string, needle: string): number {
        if (!needle) return 1;
        if (haystack.includes(needle)) return 1000 - Math.max(0, haystack.indexOf(needle));
        let score = 0;
        let hIdx = 0;
        let streak = 0;
        for (let nIdx = 0; nIdx < needle.length; nIdx++) {
            const ch = needle[nIdx];
            const found = haystack.indexOf(ch, hIdx);
            if (found === -1) return 0;
            if (found === hIdx) streak++;
            else streak = 1;
            score += 5 + streak * 2;
            hIdx = found + 1;
        }
        return score;
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
        padding: 28px 36px 40px;
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
        margin: 16px 0 14px;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
    }
    .search-input {
        min-width: 280px;
        max-width: 520px;
        flex: 1 1 320px;
    }
    .hint {
        font-size: 0.8rem;
        color: var(--lv-silver, #888);
    }
    .results-pane {
        padding-bottom: 28px;
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
