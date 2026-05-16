<template>
    <div class="page">
        <header class="page-header">
            <div>
                <div class="eyebrow">Knowspace · Retrieval</div>
                <h1 class="page-title">Search &amp; ask</h1>
                <p class="page-sub">
                    Find pages, collections, entities, and indexed documents — or ask a grounded
                    question and get an answer with citations.
                </p>
            </div>
        </header>

        <div class="search-bar">
            <v-text-field
                v-model="query"
                density="comfortable"
                variant="outlined"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search or ask…"
                autofocus
                @keydown.enter="runAll"
            />
            <v-btn color="primary" :loading="searching" @click="runAll">Search</v-btn>
            <v-btn
                color="secondary"
                variant="tonal"
                :loading="asking"
                :disabled="!query.trim()"
                @click="runAsk"
            >
                <v-icon size="16" class="mr-1">mdi-message-question-outline</v-icon>
                Ask workspace
            </v-btn>
        </div>

        <div class="filter-row">
            <v-chip-group v-model="typeFilters" multiple column>
                <v-chip filter value="page" variant="outlined">Pages</v-chip>
                <v-chip filter value="collection" variant="outlined">Collections</v-chip>
                <v-chip filter value="entity" variant="outlined">Entities</v-chip>
                <v-chip filter value="tag" variant="outlined">Tags</v-chip>
            </v-chip-group>
        </div>

        <section v-if="askAnswer" class="ask-block">
            <div class="ask-header">
                <v-icon size="18" color="primary">mdi-message-question-outline</v-icon>
                <span class="ask-label">Workspace answer</span>
            </div>
            <div class="ask-text">{{ askAnswer.answer }}</div>
            <div v-if="askAnswer.citations.length > 0" class="citations">
                <div class="citation-label">Sources</div>
                <NuxtLink
                    v-for="c in askAnswer.citations"
                    :key="c.page_id"
                    :to="`/pages/${c.page_id}`"
                    class="citation-row"
                >
                    <span class="emoji">{{ c.emoji || '📄' }}</span>
                    <div>
                        <div class="citation-title">{{ c.title }}</div>
                        <div class="citation-snippet">{{ c.snippet }}</div>
                    </div>
                </NuxtLink>
            </div>
        </section>

        <section class="results">
            <div v-if="searching" class="muted">Searching…</div>
            <div v-else-if="!searched" class="muted">
                Enter a query to search across pages, collections, and entities. Use
                <strong>Ask workspace</strong> to get a grounded answer with citations.
            </div>
            <div v-else-if="results.length === 0" class="muted">
                No results for "{{ lastQuery }}".
            </div>
            <div v-else>
                <div class="result-meta">
                    {{ results.length }} result{{ results.length === 1 ? '' : 's' }} for
                    <strong>{{ lastQuery }}</strong>
                </div>
                <NuxtLink
                    v-for="r in results"
                    :key="`${r.type}-${r.id}`"
                    :to="resultLink(r)"
                    class="result-row"
                >
                    <span class="result-emoji">{{ resultEmoji(r) }}</span>
                    <div class="result-body">
                        <div class="result-line">
                            <span class="result-type">{{ r.type }}</span>
                            <span class="result-title">{{ r.title || 'Untitled' }}</span>
                        </div>
                        <div class="result-snippet" v-if="r.snippet">{{ r.snippet }}</div>
                    </div>
                    <div class="result-time" v-if="r.updated_at">
                        {{ formatRelative(r.updated_at) }}
                    </div>
                </NuxtLink>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    interface ResultRow {
        type: 'page' | 'collection' | 'entity' | 'tag';
        id: string;
        title: string;
        emoji?: string | null;
        snippet?: string;
        updated_at?: string;
    }

    const route = useRoute();
    const router = useRouter();
    const query = ref('');
    const results = ref<ResultRow[]>([]);
    const searching = ref(false);
    const searched = ref(false);
    const lastQuery = ref('');
    const typeFilters = ref<string[]>(['page', 'collection', 'entity', 'tag']);

    const asking = ref(false);
    const askAnswer = ref<null | {
        answer: string;
        citations: { page_id: string; title: string; emoji: string | null; snippet: string }[];
    }>(null);

    async function runSearch() {
        const q = query.value.trim();
        if (!q) return;
        searching.value = true;
        lastQuery.value = q;
        try {
            const res = await $fetch<{ results: ResultRow[] }>('/api/search', {
                method: 'POST',
                body: { q, types: typeFilters.value },
            });
            results.value = res.results || [];
            searched.value = true;
            router.replace({ query: { ...route.query, q } });
        } finally {
            searching.value = false;
        }
    }

    async function runAsk() {
        const q = query.value.trim();
        if (!q) return;
        asking.value = true;
        try {
            const res = await $fetch<{
                answer: string;
                citations: {
                    page_id: string;
                    title: string;
                    emoji: string | null;
                    snippet: string;
                }[];
            }>('/api/ask', {
                method: 'POST',
                body: { question: q },
            });
            askAnswer.value = { answer: res.answer, citations: res.citations || [] };
        } finally {
            asking.value = false;
        }
    }

    async function runAll() {
        askAnswer.value = null;
        await runSearch();
    }

    function resultLink(r: ResultRow) {
        if (r.type === 'page') return `/pages/${r.id}`;
        if (r.type === 'collection') return `/collections/${r.id}`;
        if (r.type === 'tag') return `/t/${encodeURIComponent(r.id)}`;
        return `/entities/${r.id}`;
    }
    function resultEmoji(r: ResultRow) {
        if (r.emoji) return r.emoji;
        if (r.type === 'collection') return '🗂️';
        if (r.type === 'entity') return '🧩';
        if (r.type === 'tag') return '#';
        return '📄';
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

    onMounted(() => {
        const initial = (route.query.q as string) || '';
        if (initial) {
            query.value = initial;
            runSearch();
        }
    });
</script>

<style scoped>
    .page {
        padding: 40px 48px 80px;
        max-width: 920px;
        margin: 0 auto;
    }
    .page-header {
        margin-bottom: 24px;
    }
    .eyebrow {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin-bottom: 6px;
    }
    .page-title {
        font-family: var(--font-headline, serif);
        font-weight: 400;
        font-size: 2rem;
        margin: 0 0 8px;
    }
    .page-sub {
        color: var(--lv-silver, #aaa);
        max-width: 620px;
        margin: 0;
    }

    .search-bar {
        display: flex;
        gap: 10px;
        margin-bottom: 14px;
        align-items: stretch;
    }
    .search-bar :deep(.v-text-field) {
        flex: 1 1 auto;
    }

    .filter-row {
        margin-bottom: 20px;
    }

    .ask-block {
        background: rgba(0, 59, 255, 0.06);
        border: 1px solid rgba(0, 59, 255, 0.2);
        padding: 18px;
        border-radius: 12px;
        margin-bottom: 28px;
    }
    .ask-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
    }
    .ask-label {
        font-family: var(--font-mono, monospace);
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--lv-silver, #aaa);
    }
    .ask-text {
        font-size: 0.95rem;
        line-height: 1.5;
        color: #f0f0f0;
    }
    .citations {
        margin-top: 14px;
    }
    .citation-label {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--lv-silver, #888);
        margin-bottom: 6px;
    }
    .citation-row {
        display: flex;
        gap: 10px;
        padding: 8px 0;
        text-decoration: none;
        color: inherit;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .citation-row:first-of-type {
        border-top: none;
    }
    .emoji {
        font-size: 1.1rem;
    }
    .citation-title {
        font-weight: 500;
        font-size: 0.88rem;
    }
    .citation-snippet {
        font-size: 0.8rem;
        color: var(--lv-silver, #aaa);
        margin-top: 2px;
    }

    .result-meta {
        font-size: 0.82rem;
        color: var(--lv-silver, #888);
        margin-bottom: 12px;
    }
    .result-row {
        display: flex;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.05);
        margin-bottom: 8px;
    }
    .result-row:hover {
        border-color: rgba(63, 234, 0, 0.4);
    }
    .result-emoji {
        font-size: 1.4rem;
    }
    .result-body {
        flex: 1 1 auto;
        min-width: 0;
    }
    .result-line {
        display: flex;
        gap: 10px;
        align-items: baseline;
    }
    .result-type {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--lv-silver, #888);
    }
    .result-title {
        font-weight: 500;
        font-size: 0.95rem;
    }
    .result-snippet {
        font-size: 0.82rem;
        color: var(--lv-silver, #aaa);
        margin-top: 4px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .result-time {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        color: var(--lv-silver, #888);
        flex-shrink: 0;
        align-self: center;
    }

    .muted {
        color: var(--lv-silver, #888);
        font-size: 0.9rem;
        padding: 12px 0;
    }
</style>
