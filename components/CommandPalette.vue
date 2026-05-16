<template>
    <v-dialog v-model="open" max-width="760">
        <v-card class="palette-card">
            <v-card-text class="pa-3">
                <v-text-field
                    ref="inputRef"
                    v-model="query"
                    density="compact"
                    variant="outlined"
                    hide-details
                    autofocus
                    prepend-inner-icon="mdi-magnify"
                    placeholder="Search docs, tags… or type a new title"
                    @keydown.down.prevent="move(1)"
                    @keydown.up.prevent="move(-1)"
                    @keydown.enter.prevent="selectActive"
                />
                <div class="result-list">
                    <button
                        v-for="(item, idx) in results"
                        :key="`${item.type}-${item.id}`"
                        class="result-row"
                        :class="{ active: idx === activeIdx }"
                        @mousedown.prevent="selectItem(item)"
                    >
                        <span class="kind">{{ item.type }}</span>
                        <span class="title">{{ item.title }}</span>
                        <span class="snippet" v-if="item.snippet">{{ item.snippet }}</span>
                    </button>
                    <button
                        v-if="query.trim()"
                        class="result-row create-row"
                        :class="{ active: activeIdx === results.length }"
                        @mousedown.prevent="createDoc(query.trim())"
                    >
                        <span class="kind">create</span>
                        <span class="title">Create “{{ query.trim() }}”</span>
                    </button>
                    <button
                        v-if="query.trim()"
                        class="result-row ask-row"
                        :class="{ active: activeIdx === results.length + 1 }"
                        @mousedown.prevent="askWorkspace(query.trim())"
                    >
                        <span class="kind">ask</span>
                        <span class="title">Ask workspace: “{{ query.trim() }}”</span>
                    </button>
                </div>
                <div v-if="askAnswer" class="ask-answer">
                    <div class="ask-title">Answer</div>
                    <div class="ask-text">{{ askAnswer.answer }}</div>
                </div>
                <div class="help-line">Cmd+K to open · Esc to close · Enter to jump</div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
    import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
    import { useWorkspaceNav } from '~/composables/useWorkspaceNav';

    interface SearchResult {
        type: 'page' | 'collection' | 'entity' | 'tag';
        id: string;
        title: string;
        snippet?: string;
    }

    const open = ref(false);
    const query = ref('');
    const results = ref<SearchResult[]>([]);
    const activeIdx = ref(0);
    const inputRef = ref<any>(null);
    const router = useRouter();
    const nav = useWorkspaceNav();
    const askAnswer = ref<null | { answer: string }>(null);

    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    watch(query, () => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => void runSearch(), 120);
    });

    watch(open, async (v) => {
        if (v) {
            activeIdx.value = 0;
            await nextTick();
            inputRef.value?.focus?.();
        } else {
            query.value = '';
            results.value = [];
            askAnswer.value = null;
        }
    });

    async function runSearch() {
        const q = query.value.trim();
        if (!q) {
            results.value = [];
            activeIdx.value = 0;
            return;
        }
        const res = await $fetch<{ results: SearchResult[] }>('/api/search', {
            method: 'POST',
            body: { q, types: ['page', 'collection', 'entity', 'tag'], limit: 10 },
        });
        results.value = res.results || [];
        activeIdx.value = 0;
    }

    function routeFor(item: SearchResult): string {
        if (item.type === 'page') return `/pages/${item.id}`;
        if (item.type === 'tag') return `/t/${encodeURIComponent(item.id)}`;
        if (item.type === 'collection') return `/collections/${item.id}`;
        return `/entities/${item.id}`;
    }

    async function selectItem(item: SearchResult) {
        open.value = false;
        await router.push(routeFor(item));
    }

    async function createDoc(title: string) {
        const created = await nav.createPage({ title: title || 'Untitled' });
        open.value = false;
        await router.push(`/pages/${created.id}`);
    }

    async function selectActive() {
        const createIdx = results.value.length;
        const askIdx = results.value.length + 1;
        if (activeIdx.value === createIdx && query.value.trim()) {
            await createDoc(query.value.trim());
            return;
        }
        if (activeIdx.value === askIdx && query.value.trim()) {
            await askWorkspace(query.value.trim());
            return;
        }
        const current = results.value[activeIdx.value];
        if (current) await selectItem(current);
    }

    function move(delta: number) {
        const max = results.value.length + (query.value.trim() ? 2 : 0) - 1;
        if (max < 0) return;
        const next = activeIdx.value + delta;
        if (next < 0) activeIdx.value = max;
        else if (next > max) activeIdx.value = 0;
        else activeIdx.value = next;
    }

    function onKey(evt: KeyboardEvent) {
        if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === 'k') {
            evt.preventDefault();
            open.value = !open.value;
            return;
        }
        if (evt.key.toLowerCase() === 'd' && evt.metaKey && !evt.shiftKey && !evt.ctrlKey) {
            evt.preventDefault();
            void openDailyNote();
        }
        if (evt.key === 'Escape' && open.value) {
            evt.preventDefault();
            open.value = false;
        }
    }

    async function openDailyNote() {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const title = date;
        const existing = nav.pages.value.find((p) => (p.title || '').trim() === title);
        if (existing) {
            await router.push(`/pages/${existing.id}`);
            return;
        }
        const created = await nav.createPage({
            title,
            content_markdown: `# ${title}\n\n#daily\n`,
        });
        await router.push(`/pages/${created.id}`);
    }

    async function askWorkspace(question: string) {
        const q = question.trim();
        if (!q) return;
        const res = await $fetch<{ answer: string }>('/api/ask', {
            method: 'POST',
            body: { question: q },
        });
        askAnswer.value = { answer: res.answer || '' };
    }

    onMounted(() => {
        window.addEventListener('keydown', onKey);
    });
    onUnmounted(() => {
        window.removeEventListener('keydown', onKey);
    });
</script>

<style scoped>
    .palette-card {
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .result-list {
        margin-top: 10px;
        max-height: 360px;
        overflow: auto;
    }
    .result-row {
        width: 100%;
        border: 1px solid transparent;
        background: transparent;
        color: inherit;
        text-align: left;
        padding: 9px 10px;
        border-radius: 8px;
        margin-bottom: 4px;
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr);
        gap: 10px;
        cursor: pointer;
    }
    .result-row.active {
        border-color: rgba(63, 234, 0, 0.35);
        background: rgba(63, 234, 0, 0.08);
    }
    .kind {
        font-family: var(--font-mono, monospace);
        text-transform: uppercase;
        letter-spacing: 0.09em;
        font-size: 0.68rem;
        color: var(--lv-silver, #888);
    }
    .title {
        font-size: 0.88rem;
        font-weight: 500;
    }
    .snippet {
        grid-column: 2;
        font-size: 0.76rem;
        color: var(--lv-silver, #aaa);
    }
    .create-row .title {
        color: #9df87a;
    }
    .ask-row .title {
        color: #8ec8ff;
    }
    .ask-answer {
        margin-top: 8px;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        background: rgba(0, 59, 255, 0.07);
    }
    .ask-title {
        font-family: var(--font-mono, monospace);
        font-size: 0.68rem;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--lv-silver, #aaa);
        margin-bottom: 4px;
    }
    .ask-text {
        font-size: 0.84rem;
        white-space: pre-wrap;
        line-height: 1.4;
    }
    .help-line {
        margin-top: 8px;
        font-size: 0.72rem;
        color: var(--lv-silver, #888);
    }
</style>
