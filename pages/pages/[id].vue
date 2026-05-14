<template>
    <div class="d-flex fill-height page-view">
        <div class="page-main d-flex flex-column">
            <div v-if="loading" class="loading-block">
                <v-progress-circular indeterminate />
            </div>
            <div v-else-if="error" class="error-block">
                <v-alert type="error" variant="tonal">{{ error }}</v-alert>
            </div>
            <template v-else-if="page">
                <div class="flex-shrink-0 page-header">
                    <div class="page-meta-row">
                        <NuxtLink to="/pages" class="back-link">
                            <v-icon size="14">mdi-arrow-left</v-icon> Pages
                        </NuxtLink>
                        <div class="meta-chips">
                            <v-chip v-if="page.importStatus === 'imported'" color="info">
                                Imported
                            </v-chip>
                            <v-chip v-for="t in page.tags" :key="t">{{ t }}</v-chip>
                        </div>
                        <div class="meta-actions">
                            <v-btn
                                icon
                                size="small"
                                variant="text"
                                :color="page.favorite ? 'warning' : undefined"
                                @click="toggleFavorite"
                            >
                                <v-icon>{{
                                    page.favorite ? 'mdi-star' : 'mdi-star-outline'
                                }}</v-icon>
                            </v-btn>
                            <v-btn
                                v-if="!editing"
                                variant="text"
                                size="small"
                                prepend-icon="mdi-pencil"
                                @click="startEdit"
                                >Edit</v-btn
                            >
                            <v-btn
                                v-else
                                color="primary"
                                size="small"
                                prepend-icon="mdi-check"
                                @click="saveEdit"
                                :loading="saving"
                                >Save</v-btn
                            >
                            <v-btn
                                icon
                                size="small"
                                variant="text"
                                color="error"
                                @click="confirmDelete = true"
                            >
                                <v-icon>mdi-trash-can-outline</v-icon>
                            </v-btn>
                        </div>
                    </div>

                    <div class="title-row">
                        <span class="title-emoji">{{ page.emoji || '📄' }}</span>
                        <input
                            v-if="editing"
                            v-model="draftTitle"
                            class="title-input"
                            placeholder="Untitled"
                        />
                        <h1 v-else class="page-title">{{ page.title }}</h1>
                    </div>

                    <div class="timestamps">
                        Created {{ formatDate(page.createdAt) }} · Updated
                        {{ formatDate(page.updatedAt) }}
                    </div>
                </div>

                <div class="flex-grow-1 overflow-y-auto page-body">
                    <textarea
                        v-if="editing"
                        v-model="draftContent"
                        class="editor"
                        placeholder="Write in Markdown…"
                    />
                    <div
                        v-else-if="page.contentMarkdown.trim()"
                        class="markdown-body"
                        v-html="renderedHtml"
                    />
                    <div v-else class="empty-content">
                        <v-icon icon="mdi-text-box-outline" size="32" class="mb-2" />
                        <div>This page is empty. Click Edit to add Markdown content.</div>
                    </div>
                </div>
            </template>
        </div>

        <aside class="page-context">
            <v-tabs v-model="contextTab" density="compact" align-tabs="start">
                <v-tab value="source">Source</v-tab>
                <v-tab value="entities">Entities</v-tab>
                <v-tab value="backlinks">Backlinks</v-tab>
                <v-tab value="ai">AI</v-tab>
            </v-tabs>
            <v-window v-model="contextTab" class="context-window">
                <v-window-item value="source">
                    <div v-if="page" class="context-panel">
                        <div class="context-row">
                            <span class="context-label">Origin</span>
                            <span class="context-value">
                                {{
                                    page.importStatus === 'imported'
                                        ? 'Imported from Notion'
                                        : 'Created in app'
                                }}
                            </span>
                        </div>
                        <div v-if="page.importPath" class="context-row">
                            <span class="context-label">Original path</span>
                            <span class="context-value mono">{{ page.importPath }}</span>
                        </div>
                        <div v-if="page.sourceId" class="context-row">
                            <span class="context-label">Source ID</span>
                            <span class="context-value mono">{{ page.sourceId }}</span>
                        </div>
                        <div class="context-row">
                            <span class="context-label">Created</span>
                            <span class="context-value">{{ formatDate(page.createdAt) }}</span>
                        </div>
                        <div class="context-row">
                            <span class="context-label">Updated</span>
                            <span class="context-value">{{ formatDate(page.updatedAt) }}</span>
                        </div>
                    </div>
                </v-window-item>

                <v-window-item value="entities">
                    <div class="context-panel">
                        <div v-if="!pageEntities.length" class="context-empty">
                            No entities detected for this page yet.
                        </div>
                        <NuxtLink
                            v-for="e in pageEntities"
                            :key="e.id"
                            :to="`/entities/${e.id}`"
                            class="entity-pill"
                        >
                            <span class="entity-name">{{ e.canonicalName }}</span>
                            <span class="entity-type">{{ e.type }}</span>
                        </NuxtLink>
                    </div>
                </v-window-item>

                <v-window-item value="backlinks">
                    <div class="context-panel">
                        <div v-if="!backlinks.length" class="context-empty">
                            No pages link here yet.
                        </div>
                        <NuxtLink
                            v-for="b in backlinks"
                            :key="b.id"
                            :to="`/pages/${b.id}`"
                            class="backlink-row"
                        >
                            <span class="backlink-emoji">{{ b.emoji || '📄' }}</span>
                            <span class="backlink-title">{{ b.title }}</span>
                        </NuxtLink>
                    </div>
                </v-window-item>

                <v-window-item value="ai">
                    <div class="context-panel">
                        <v-textarea
                            v-model="aiQuestion"
                            rows="2"
                            variant="outlined"
                            density="compact"
                            placeholder="Ask about this workspace…"
                            hide-details
                        />
                        <v-btn
                            class="mt-2"
                            color="primary"
                            size="small"
                            :loading="aiLoading"
                            :disabled="!aiQuestion.trim()"
                            @click="askAi"
                            >Ask</v-btn
                        >
                        <div v-if="aiAnswer" class="ai-answer">
                            <div class="markdown-body" v-html="renderedAnswer"></div>
                            <div v-if="aiAnswer.citations.length" class="citations">
                                <div class="citations-title">Citations</div>
                                <NuxtLink
                                    v-for="(c, idx) in aiAnswer.citations"
                                    :key="c.pageId + idx"
                                    :to="`/pages/${c.pageId}`"
                                    class="citation-link"
                                >
                                    [{{ idx + 1 }}] {{ c.pageTitle }}
                                </NuxtLink>
                            </div>
                        </div>
                    </div>
                </v-window-item>
            </v-window>
        </aside>

        <v-dialog v-model="confirmDelete" max-width="420">
            <v-card>
                <v-card-title>Delete page?</v-card-title>
                <v-card-text>
                    This will permanently remove "{{ page?.title }}". Child pages will be reparented
                    to the workspace root.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="confirmDelete = false">Cancel</v-btn>
                    <v-btn color="error" variant="flat" @click="performDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref, watch } from 'vue';
    import { renderMarkdown } from '~/utils/markdown';
    import type { AskAnswer, EntityRecord, PageRecord } from '~/utils/knowspaceTypes';

    const route = useRoute();
    const router = useRouter();
    const knowspace = useKnowspace();

    const page = ref<PageRecord | null>(null);
    const allPages = ref<PageRecord[]>([]);
    const entities = ref<EntityRecord[]>([]);
    const loading = ref(true);
    const error = ref<string>('');

    const editing = ref(false);
    const draftTitle = ref('');
    const draftContent = ref('');
    const saving = ref(false);
    const confirmDelete = ref(false);

    const contextTab = ref<'source' | 'entities' | 'backlinks' | 'ai'>('source');
    const aiQuestion = ref('');
    const aiAnswer = ref<AskAnswer | null>(null);
    const aiLoading = ref(false);

    async function loadAll() {
        const id = route.params.id as string;
        loading.value = true;
        error.value = '';
        try {
            const [p, pages, ents] = await Promise.all([
                knowspace.getPage(id),
                $fetch<PageRecord[]>('/api/workspace/pages/list'),
                knowspace.listEntities(),
            ]);
            page.value = p;
            allPages.value = pages;
            entities.value = ents;
            if (route.query.edit) startEdit();
        } catch (err: any) {
            error.value = err?.message || 'Failed to load page';
        } finally {
            loading.value = false;
        }
    }

    onMounted(loadAll);
    watch(
        () => route.params.id,
        () => loadAll()
    );

    const renderedHtml = computed(() =>
        page.value ? renderMarkdown(page.value.contentMarkdown) : ''
    );

    const renderedAnswer = computed(() =>
        aiAnswer.value ? renderMarkdown(aiAnswer.value.answerMarkdown) : ''
    );

    const pageEntities = computed<EntityRecord[]>(() => {
        if (!page.value) return [];
        return entities.value.filter((e) => e.mentions.some((m) => m.pageId === page.value!.id));
    });

    const backlinks = computed<PageRecord[]>(() => {
        if (!page.value) return [];
        const target = `/pages/${page.value.id}`;
        const titleLower = page.value.title.toLowerCase();
        return allPages.value.filter((p) => {
            if (p.id === page.value!.id) return false;
            return (
                p.contentMarkdown.includes(target) ||
                (titleLower.length >= 3 && p.contentMarkdown.toLowerCase().includes(titleLower))
            );
        });
    });

    function startEdit() {
        if (!page.value) return;
        editing.value = true;
        draftTitle.value = page.value.title;
        draftContent.value = page.value.contentMarkdown;
    }

    async function saveEdit() {
        if (!page.value) return;
        saving.value = true;
        try {
            const next = await knowspace.updatePage(page.value.id, {
                title: draftTitle.value.trim() || 'Untitled',
                contentMarkdown: draftContent.value,
            });
            page.value = next;
            editing.value = false;
            entities.value = await knowspace.listEntities();
            if (route.query.edit) router.replace({ query: {} });
        } finally {
            saving.value = false;
        }
    }

    async function toggleFavorite() {
        if (!page.value) return;
        const next = await knowspace.updatePage(page.value.id, {
            favorite: !page.value.favorite,
        });
        page.value = next;
    }

    async function performDelete() {
        if (!page.value) return;
        const id = page.value.id;
        confirmDelete.value = false;
        await knowspace.deletePage(id);
        router.push('/pages');
    }

    async function askAi() {
        if (!aiQuestion.value.trim()) return;
        aiLoading.value = true;
        try {
            aiAnswer.value = await knowspace.ask(aiQuestion.value.trim());
        } finally {
            aiLoading.value = false;
        }
    }

    function formatDate(iso?: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleString();
    }
</script>

<style scoped>
    .page-view {
        background: var(--lv-background, #0a0a0a);
    }

    .page-main {
        flex: 1;
        min-width: 0;
    }

    .loading-block,
    .error-block {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 64px;
    }

    .page-header {
        padding: 32px 48px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .page-meta-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
        flex-wrap: wrap;
    }

    .back-link {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.8rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .back-link:hover {
        color: var(--lv-green, #3fea00);
    }

    .meta-chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    .meta-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .title-emoji {
        font-size: 2rem;
    }

    .page-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 2.2rem;
        margin: 0;
    }

    .title-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--font-headline);
        font-size: 2.2rem;
        color: white;
    }

    .timestamps {
        margin-top: 12px;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
    }

    .page-body {
        padding: 24px 48px 64px;
    }

    .editor {
        width: 100%;
        min-height: 500px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 16px;
        color: white;
        font-family: var(--font-mono);
        font-size: 0.95rem;
        line-height: 1.55;
        resize: vertical;
    }

    .editor:focus {
        outline: none;
        border-color: var(--lv-green, #3fea00);
    }

    .empty-content {
        text-align: center;
        padding: 64px 24px;
        color: rgba(255, 255, 255, 0.45);
    }

    .markdown-body :deep(h1),
    .markdown-body :deep(h2),
    .markdown-body :deep(h3) {
        font-family: var(--font-headline);
        font-weight: 400;
        margin-top: 1.4em;
        margin-bottom: 0.4em;
    }

    .markdown-body :deep(h1) {
        font-size: 1.6rem;
    }

    .markdown-body :deep(h2) {
        font-size: 1.3rem;
    }

    .markdown-body :deep(h3) {
        font-size: 1.1rem;
    }

    .markdown-body :deep(p) {
        line-height: 1.65;
        color: rgba(255, 255, 255, 0.86);
        margin-bottom: 0.8em;
    }

    .markdown-body :deep(ul),
    .markdown-body :deep(ol) {
        padding-left: 1.4em;
        margin-bottom: 0.8em;
    }

    .markdown-body :deep(li) {
        line-height: 1.65;
        margin-bottom: 4px;
    }

    .markdown-body :deep(blockquote) {
        border-left: 3px solid rgba(255, 255, 255, 0.2);
        padding: 4px 12px;
        color: rgba(255, 255, 255, 0.7);
        margin: 12px 0;
    }

    .markdown-body :deep(code) {
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 6px;
        border-radius: 4px;
        font-family: var(--font-mono);
        font-size: 0.88em;
    }

    .markdown-body :deep(pre) {
        background: rgba(255, 255, 255, 0.04);
        padding: 14px 16px;
        border-radius: 8px;
        overflow-x: auto;
        font-family: var(--font-mono);
        font-size: 0.85em;
        margin-bottom: 1em;
    }

    .markdown-body :deep(a) {
        color: var(--lv-green, #3fea00);
    }

    .page-context {
        width: 320px;
        flex-shrink: 0;
        border-left: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.012);
        display: flex;
        flex-direction: column;
    }

    .context-window {
        flex: 1;
        overflow-y: auto;
    }

    .context-panel {
        padding: 16px;
    }

    .context-row {
        display: flex;
        flex-direction: column;
        margin-bottom: 12px;
    }

    .context-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 2px;
    }

    .context-value {
        font-size: 0.85rem;
    }

    .context-value.mono {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        word-break: break-all;
    }

    .context-empty {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.85rem;
        padding: 6px 0;
    }

    .entity-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 6px;
        text-decoration: none;
        color: rgba(255, 255, 255, 0.85);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        margin-bottom: 6px;
    }

    .entity-pill:hover {
        border-color: var(--lv-green, #3fea00);
    }

    .entity-name {
        font-size: 0.85rem;
    }

    .entity-type {
        font-family: var(--font-mono);
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.4);
    }

    .backlink-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 6px;
        text-decoration: none;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.85rem;
        margin-bottom: 4px;
    }

    .backlink-row:hover {
        background: rgba(255, 255, 255, 0.04);
    }

    .ai-answer {
        margin-top: 16px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.02);
        font-size: 0.85rem;
    }

    .citations {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .citations-title {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 4px;
    }

    .citation-link {
        font-size: 0.78rem;
        color: var(--lv-green, #3fea00);
        text-decoration: none;
    }

    .citation-link:hover {
        text-decoration: underline;
    }
</style>
