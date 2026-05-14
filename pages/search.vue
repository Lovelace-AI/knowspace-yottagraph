<template>
    <div class="d-flex flex-column fill-height">
        <div class="flex-shrink-0 header">
            <div class="eyebrow">Search</div>
            <h1 class="title">Search the workspace</h1>
            <p class="sub">
                Keyword search across pages, collections, records, sources, and entities. Future
                versions will layer in semantic and graph-aware retrieval.
            </p>
            <div class="search-row">
                <v-text-field
                    v-model="query"
                    placeholder="Ask a question or type keywords…"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                    prepend-inner-icon="mdi-magnify"
                    autofocus
                    @keydown.enter="runSearch"
                />
                <v-btn color="primary" :loading="loading" @click="runSearch">Search</v-btn>
            </div>
            <div class="filter-row">
                <v-btn-toggle v-model="typeFilters" multiple density="comfortable">
                    <v-btn
                        v-for="t in availableFilters"
                        :key="t.value"
                        :value="t.value"
                        :prepend-icon="t.icon"
                    >
                        {{ t.label }}
                    </v-btn>
                </v-btn-toggle>
            </div>
        </div>

        <div class="flex-grow-1 overflow-y-auto body">
            <div v-if="!hasSearched" class="placeholder">
                Enter keywords above to search. Each result includes a snippet, source, and
                relevance score.
            </div>
            <div v-else-if="loading" class="centered">
                <v-progress-circular indeterminate />
            </div>
            <div v-else-if="!filteredResults.length" class="empty">
                No results for "{{ lastQuery }}". Try fewer or simpler keywords.
            </div>
            <div v-else class="results">
                <NuxtLink
                    v-for="r in filteredResults"
                    :key="`${r.type}-${r.id}`"
                    :to="r.href"
                    class="result"
                >
                    <div class="result-head">
                        <v-chip>{{ r.type }}</v-chip>
                        <span class="result-title">{{ r.title }}</span>
                        <span class="result-score">{{ r.score.toFixed(1) }}</span>
                    </div>
                    <div class="result-snippet">{{ r.snippet }}</div>
                    <div class="result-meta">
                        Source: {{ r.source }}
                        <template v-if="r.matchedTerms.length">
                            · Matched:
                            <span v-for="t in r.matchedTerms" :key="t" class="matched">{{
                                t
                            }}</span>
                        </template>
                        <template v-if="r.updatedAt"> · {{ formatDate(r.updatedAt) }} </template>
                    </div>
                </NuxtLink>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref, watch } from 'vue';
    import type { SearchResult } from '~/utils/knowspaceTypes';

    const route = useRoute();
    const router = useRouter();
    const knowspace = useKnowspace();

    const query = ref('');
    const lastQuery = ref('');
    const loading = ref(false);
    const hasSearched = ref(false);
    const results = ref<SearchResult[]>([]);
    const typeFilters = ref<SearchResult['type'][]>([]);

    const availableFilters: Array<{ value: SearchResult['type']; label: string; icon: string }> = [
        { value: 'page', label: 'Pages', icon: 'mdi-file-document-outline' },
        { value: 'collection', label: 'Collections', icon: 'mdi-table-large' },
        { value: 'record', label: 'Records', icon: 'mdi-format-list-bulleted' },
        { value: 'source', label: 'Sources', icon: 'mdi-source-branch' },
        { value: 'entity', label: 'Entities', icon: 'mdi-graph-outline' },
    ];

    const filteredResults = computed(() => {
        if (!typeFilters.value.length) return results.value;
        return results.value.filter((r) => typeFilters.value.includes(r.type));
    });

    onMounted(async () => {
        if (typeof route.query.q === 'string' && route.query.q) {
            query.value = route.query.q;
            await runSearch();
        }
    });

    watch(
        () => route.query.q,
        async (q) => {
            if (typeof q === 'string' && q !== lastQuery.value) {
                query.value = q;
                await runSearch();
            }
        }
    );

    async function runSearch() {
        const q = query.value.trim();
        if (!q) return;
        loading.value = true;
        hasSearched.value = true;
        lastQuery.value = q;
        try {
            const data = await knowspace.search(q);
            results.value = data.results;
            if (route.query.q !== q) {
                router.replace({ query: { ...route.query, q } });
            }
        } finally {
            loading.value = false;
        }
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString();
    }
</script>

<style scoped>
    .header {
        padding: 32px 40px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .eyebrow {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--lv-green, #3fea00);
        margin-bottom: 4px;
    }

    .title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.85rem;
        margin-bottom: 4px;
    }

    .sub {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.9rem;
        max-width: 580px;
    }

    .search-row {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        align-items: center;
    }

    .filter-row {
        margin-top: 14px;
    }

    .body {
        padding: 24px 40px 64px;
    }

    .placeholder,
    .empty {
        text-align: center;
        padding: 60px 24px;
        color: rgba(255, 255, 255, 0.45);
    }

    .centered {
        display: flex;
        justify-content: center;
        padding: 40px;
    }

    .results {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .result {
        display: block;
        padding: 14px 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.015);
        text-decoration: none;
        color: inherit;
    }

    .result:hover {
        border-color: var(--lv-green, #3fea00);
    }

    .result-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
    }

    .result-title {
        font-weight: 500;
        flex: 1;
    }

    .result-score {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.4);
    }

    .result-snippet {
        color: rgba(255, 255, 255, 0.78);
        font-size: 0.88rem;
        line-height: 1.5;
        margin-bottom: 6px;
    }

    .result-meta {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.45);
    }

    .matched {
        background: rgba(63, 234, 0, 0.12);
        color: var(--lv-green, #3fea00);
        padding: 1px 6px;
        border-radius: 4px;
        margin-left: 4px;
        font-family: var(--font-mono);
        font-size: 0.7rem;
    }
</style>
