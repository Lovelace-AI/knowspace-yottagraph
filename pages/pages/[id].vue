<template>
    <div class="page-view" v-if="page">
        <div class="page-main">
            <div class="breadcrumbs" v-if="breadcrumbs.length > 0">
                <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.id">
                    <NuxtLink :to="`/pages/${crumb.id}`" class="crumb">
                        <span class="crumb-emoji">{{ crumb.emoji || '📄' }}</span>
                        {{ crumb.title || 'Untitled' }}
                    </NuxtLink>
                    <span class="crumb-sep" v-if="idx < breadcrumbs.length - 1 || true">/</span>
                </template>
            </div>

            <div class="title-row">
                <button class="emoji-button" @click="cycleEmoji" :title="'Change emoji'">
                    {{ page.emoji || '📄' }}
                </button>
                <input
                    ref="titleInput"
                    v-model="titleDraft"
                    class="title-input"
                    placeholder="Untitled"
                    @blur="onTitleBlur"
                    @keydown.enter.prevent="onTitleEnter"
                />
                <div class="title-actions">
                    <v-tooltip :text="page.is_favorite ? 'Unfavorite' : 'Add to favorites'">
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                size="small"
                                variant="text"
                                :color="page.is_favorite ? 'amber' : ''"
                                @click="toggleFavorite"
                            >
                                <v-icon>{{
                                    page.is_favorite ? 'mdi-star' : 'mdi-star-outline'
                                }}</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-tooltip text="Toggle context panel">
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                size="small"
                                variant="text"
                                @click="showPanel = !showPanel"
                            >
                                <v-icon>{{
                                    showPanel
                                        ? 'mdi-page-layout-sidebar-right'
                                        : 'mdi-page-layout-body'
                                }}</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-menu>
                        <template #activator="{ props }">
                            <v-btn icon size="small" variant="text" v-bind="props">
                                <v-icon>mdi-dots-horizontal</v-icon>
                            </v-btn>
                        </template>
                        <v-list density="compact">
                            <v-list-item
                                title="New child page"
                                prepend-icon="mdi-file-tree"
                                @click="createChild"
                            />
                            <v-list-item
                                title="Delete page"
                                prepend-icon="mdi-delete-outline"
                                @click="confirmDelete"
                            />
                        </v-list>
                    </v-menu>
                </div>
            </div>

            <div class="metadata-row">
                <span class="meta-chip">
                    <v-icon size="14">mdi-clock-outline</v-icon>
                    Updated {{ formatRelative(page.updated_at) }}
                </span>
                <span
                    class="meta-chip"
                    v-if="page.import_status && page.import_status !== 'native'"
                >
                    <v-icon size="14">mdi-import</v-icon>
                    {{ page.import_status }}
                </span>
                <span class="meta-chip" v-if="children.length > 0">
                    <v-icon size="14">mdi-file-tree</v-icon>
                    {{ children.length }} child page{{ children.length === 1 ? '' : 's' }}
                </span>
                <span class="meta-chip" v-if="saving">
                    <v-icon size="14">mdi-content-save-outline</v-icon>
                    Saving…
                </span>
                <span class="meta-chip muted-chip" v-else-if="lastSavedLabel">
                    Saved {{ lastSavedLabel }}
                </span>
            </div>

            <div class="editor-toggle">
                <v-btn-toggle
                    v-model="viewMode"
                    mandatory
                    variant="text"
                    density="compact"
                    color="primary"
                >
                    <v-btn value="render" size="small">Read</v-btn>
                    <v-btn value="edit" size="small">Edit</v-btn>
                    <v-btn value="split" size="small">Split</v-btn>
                </v-btn-toggle>
            </div>

            <div class="editor-area" :class="`mode-${viewMode}`">
                <textarea
                    v-show="viewMode === 'edit' || viewMode === 'split'"
                    v-model="contentDraft"
                    class="md-editor"
                    placeholder="Write in Markdown. Headings, lists, **bold**, *italic*, `code`, and [links](#) all work."
                    @input="onContentInput"
                ></textarea>
                <div
                    v-show="viewMode === 'render' || viewMode === 'split'"
                    class="md-render"
                    v-html="renderedHtml"
                ></div>
            </div>

            <div v-if="children.length > 0" class="child-section">
                <h3 class="child-heading">Inside this page</h3>
                <div class="child-grid">
                    <NuxtLink
                        v-for="c in children"
                        :key="c.id"
                        :to="`/pages/${c.id}`"
                        class="child-card"
                    >
                        <span class="child-emoji">{{ c.emoji || '📄' }}</span>
                        <span class="child-title">{{ c.title || 'Untitled' }}</span>
                    </NuxtLink>
                </div>
            </div>
        </div>

        <aside v-if="showPanel" class="context-panel">
            <v-tabs v-model="panelTab" density="compact" color="primary" grow>
                <v-tab value="outline">Outline</v-tab>
                <v-tab value="source">Source</v-tab>
                <v-tab value="entities">Entities</v-tab>
                <v-tab value="ai">AI</v-tab>
            </v-tabs>

            <div class="panel-body">
                <div v-if="panelTab === 'outline'">
                    <div v-if="outline.length === 0" class="muted">
                        Headings will appear here as you write.
                    </div>
                    <a
                        v-for="(h, idx) in outline"
                        :key="idx"
                        :href="`#${h.id}`"
                        class="outline-item"
                        :style="{ paddingLeft: 4 + (h.level - 1) * 12 + 'px' }"
                    >
                        {{ h.text }}
                    </a>
                </div>

                <div v-else-if="panelTab === 'source'">
                    <div class="src-block">
                        <div class="src-label">Origin</div>
                        <div class="src-value">
                            {{
                                page.import_status === 'native'
                                    ? 'Created in Knowspace'
                                    : page.import_status
                            }}
                        </div>
                    </div>
                    <div class="src-block">
                        <div class="src-label">Created</div>
                        <div class="src-value">{{ formatFull(page.created_at) }}</div>
                    </div>
                    <div class="src-block">
                        <div class="src-label">Updated</div>
                        <div class="src-value">{{ formatFull(page.updated_at) }}</div>
                    </div>
                    <div class="src-block" v-if="page.source_id">
                        <div class="src-label">Source ID</div>
                        <div class="src-value mono">{{ page.source_id }}</div>
                    </div>
                    <div class="src-block">
                        <div class="src-label">Page ID</div>
                        <div class="src-value mono">{{ page.id }}</div>
                    </div>
                </div>

                <div v-else-if="panelTab === 'entities'">
                    <div class="muted">
                        Entity extraction runs in Phase 5 — once enabled, mentions of people,
                        organizations, products and concepts will appear here linked to canonical
                        entity pages.
                    </div>
                </div>

                <div v-else-if="panelTab === 'ai'">
                    <p class="muted">
                        Ask a question grounded in this workspace. Results are based on Postgres
                        full-text matches across your pages.
                    </p>
                    <v-textarea
                        v-model="askInput"
                        rows="3"
                        auto-grow
                        placeholder="e.g. What did we decide about pricing?"
                        density="compact"
                        variant="outlined"
                        hide-details
                    />
                    <v-btn
                        size="small"
                        color="primary"
                        :loading="asking"
                        :disabled="!askInput.trim()"
                        class="mt-2"
                        @click="submitAsk"
                    >
                        Ask workspace
                    </v-btn>
                    <div v-if="askAnswer" class="ask-answer">
                        <div class="answer-text">{{ askAnswer.answer }}</div>
                        <div v-if="askAnswer.citations.length > 0" class="citations">
                            <div class="src-label" style="margin-top: 12px">Sources</div>
                            <NuxtLink
                                v-for="c in askAnswer.citations"
                                :key="c.page_id"
                                :to="`/pages/${c.page_id}`"
                                class="citation-item"
                            >
                                <span class="emoji-slot">{{ c.emoji || '📄' }}</span>
                                <div>
                                    <div class="citation-title">{{ c.title }}</div>
                                    <div class="citation-snippet">{{ c.snippet }}</div>
                                </div>
                            </NuxtLink>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <v-dialog v-model="deleteDialog" max-width="420">
            <v-card>
                <v-card-title>Delete this page?</v-card-title>
                <v-card-text>
                    This moves "{{ page.title || 'Untitled' }}" to the trash. Child pages keep their
                    content but lose their parent reference.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" @click="doDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
    <div v-else-if="loading" class="loading">Loading page…</div>
    <div v-else class="loading">Page not found.</div>
</template>

<script setup lang="ts">
    import { computed, nextTick, onMounted, ref, watch } from 'vue';

    import { renderMarkdown } from '~/utils/markdown';
    import { useWorkspaceNav } from '~/composables/useWorkspaceNav';

    interface PageRecord {
        id: string;
        title: string;
        emoji: string | null;
        content_markdown: string;
        parent_page_id: string | null;
        source_id: string | null;
        is_favorite: boolean;
        import_status: string;
        created_at: string;
        updated_at: string;
    }
    interface Crumb {
        id: string;
        title: string;
        emoji: string | null;
    }
    interface ChildLink {
        id: string;
        title: string;
        emoji: string | null;
    }

    const route = useRoute();
    const router = useRouter();
    const nav = useWorkspaceNav();

    const page = ref<PageRecord | null>(null);
    const breadcrumbs = ref<Crumb[]>([]);
    const children = ref<ChildLink[]>([]);
    const loading = ref(true);
    const titleDraft = ref('');
    const contentDraft = ref('');
    const titleInput = ref<HTMLInputElement | null>(null);
    const showPanel = ref(true);
    const panelTab = ref<'outline' | 'source' | 'entities' | 'ai'>('outline');
    const viewMode = ref<'render' | 'edit' | 'split'>('edit');
    const saving = ref(false);
    const lastSavedAt = ref<number | null>(null);
    const deleteDialog = ref(false);

    const askInput = ref('');
    const asking = ref(false);
    const askAnswer = ref<null | {
        answer: string;
        citations: { page_id: string; title: string; emoji: string | null; snippet: string }[];
    }>(null);

    const EMOJI_CYCLE = ['📄', '📝', '📓', '📚', '🗂️', '💡', '🧠', '🔬', '🎯', '🚀', '🌱'];

    async function loadPage(id: string) {
        loading.value = true;
        try {
            const res = await $fetch<{
                page: PageRecord;
                breadcrumbs: Crumb[];
                children: ChildLink[];
            }>(`/api/pages/${id}`);
            page.value = res.page;
            breadcrumbs.value = res.breadcrumbs || [];
            children.value = res.children || [];
            titleDraft.value = res.page.title || '';
            contentDraft.value = res.page.content_markdown || '';
            askAnswer.value = null;
        } catch (err) {
            console.error('Load page failed:', err);
            page.value = null;
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => route.params.id,
        (id) => {
            if (typeof id === 'string') loadPage(id);
        },
        { immediate: true }
    );

    onMounted(() => {
        nextTick(() => {
            if (page.value?.title === 'Untitled' && titleInput.value) {
                titleInput.value.focus();
                titleInput.value.select();
            }
        });
    });

    const renderedHtml = computed(() => renderMarkdown(contentDraft.value));

    const outline = computed(() => {
        const lines = (contentDraft.value || '').split('\n');
        const out: { level: number; text: string; id: string }[] = [];
        for (const line of lines) {
            const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
            if (m) {
                const text = m[2];
                out.push({
                    level: m[1].length,
                    text,
                    id: text
                        .toLowerCase()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/\s+/g, '-'),
                });
            }
        }
        return out;
    });

    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleSave() {
        if (!page.value) return;
        saving.value = true;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 600);
    }

    async function saveNow() {
        if (!page.value) return;
        const id = page.value.id;
        const newTitle = titleDraft.value.trim() || 'Untitled';
        const patch: Record<string, unknown> = {};
        if (newTitle !== page.value.title) patch.title = newTitle;
        if (contentDraft.value !== page.value.content_markdown) {
            patch.content_markdown = contentDraft.value;
        }
        if (Object.keys(patch).length === 0) {
            saving.value = false;
            return;
        }
        try {
            await $fetch(`/api/pages/${id}`, { method: 'PATCH', body: patch });
            if (page.value) {
                page.value.title = newTitle;
                page.value.content_markdown = contentDraft.value;
                page.value.updated_at = new Date().toISOString();
            }
            lastSavedAt.value = Date.now();
            await nav.refresh();
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            saving.value = false;
        }
    }

    function onContentInput() {
        scheduleSave();
    }
    function onTitleBlur() {
        scheduleSave();
    }
    function onTitleEnter() {
        (titleInput.value as HTMLInputElement | null)?.blur();
    }

    async function cycleEmoji() {
        if (!page.value) return;
        const cur = page.value.emoji || '📄';
        const idx = EMOJI_CYCLE.indexOf(cur);
        const next = EMOJI_CYCLE[(idx + 1) % EMOJI_CYCLE.length];
        page.value.emoji = next;
        await $fetch(`/api/pages/${page.value.id}`, {
            method: 'PATCH',
            body: { emoji: next },
        });
        await nav.refresh();
    }

    async function toggleFavorite() {
        if (!page.value) return;
        const newVal = !page.value.is_favorite;
        page.value.is_favorite = newVal;
        await $fetch(`/api/pages/${page.value.id}`, {
            method: 'PATCH',
            body: { is_favorite: newVal },
        });
        await nav.refresh();
    }

    async function createChild() {
        if (!page.value) return;
        const created = await nav.createPage({
            title: 'Untitled',
            parent_page_id: page.value.id,
        });
        await router.push(`/pages/${created.id}`);
    }

    function confirmDelete() {
        deleteDialog.value = true;
    }

    async function doDelete() {
        if (!page.value) return;
        await nav.deletePage(page.value.id);
        deleteDialog.value = false;
        const parent = page.value.parent_page_id;
        if (parent) await router.push(`/pages/${parent}`);
        else await router.push('/');
    }

    async function submitAsk() {
        if (!askInput.value.trim()) return;
        asking.value = true;
        try {
            const res = await $fetch<{ answer: string; citations: any[] }>('/api/ask', {
                method: 'POST',
                body: { question: askInput.value.trim(), page_id: page.value?.id },
            });
            askAnswer.value = { answer: res.answer, citations: res.citations || [] };
        } catch (err) {
            console.error('Ask failed:', err);
        } finally {
            asking.value = false;
        }
    }

    function formatRelative(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'just now';
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const day = Math.floor(hr / 24);
        if (day < 7) return `${day}d ago`;
        return d.toLocaleDateString();
    }

    function formatFull(iso: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleString();
    }

    const lastSavedLabel = computed(() => {
        if (!lastSavedAt.value) return '';
        const sec = Math.floor((Date.now() - lastSavedAt.value) / 1000);
        if (sec < 5) return 'just now';
        if (sec < 60) return `${sec}s ago`;
        return formatRelative(new Date(lastSavedAt.value).toISOString());
    });
</script>

<style scoped>
    .page-view {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        height: 100%;
        overflow: hidden;
    }

    .page-main {
        overflow-y: auto;
        padding: 40px 48px 80px;
        max-width: 100%;
    }

    .breadcrumbs {
        font-size: 0.78rem;
        color: var(--lv-silver, #888);
        margin-bottom: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }
    .crumb {
        color: var(--lv-silver, #aaa);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .crumb:hover {
        color: #fff;
    }
    .crumb-emoji {
        font-size: 0.85rem;
    }
    .crumb-sep {
        color: rgba(255, 255, 255, 0.25);
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .emoji-button {
        font-size: 2rem;
        background: none;
        border: 1px dashed transparent;
        border-radius: 8px;
        padding: 2px 6px;
        cursor: pointer;
        line-height: 1;
        transition: border-color 100ms ease;
    }
    .emoji-button:hover {
        border-color: rgba(255, 255, 255, 0.15);
    }

    .title-input {
        flex: 1 1 auto;
        background: transparent;
        border: none;
        outline: none;
        color: #fff;
        font-family: var(--font-headline, serif);
        font-size: 2rem;
        font-weight: 500;
        letter-spacing: 0.005em;
        padding: 4px 0;
    }
    .title-input::placeholder {
        color: rgba(255, 255, 255, 0.25);
    }

    .title-actions {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .metadata-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 18px;
        color: var(--lv-silver, #888);
        font-size: 0.78rem;
    }
    .meta-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .muted-chip {
        opacity: 0.7;
    }

    .editor-toggle {
        margin-bottom: 12px;
    }

    .editor-area {
        display: grid;
        gap: 24px;
        align-items: start;
    }
    .editor-area.mode-edit {
        grid-template-columns: 1fr;
    }
    .editor-area.mode-render {
        grid-template-columns: 1fr;
    }
    .editor-area.mode-split {
        grid-template-columns: 1fr 1fr;
    }

    .md-editor {
        width: 100%;
        min-height: 60vh;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 16px;
        color: #e5e5e5;
        font-family: var(--font-mono, ui-monospace, monospace);
        font-size: 0.92rem;
        line-height: 1.55;
        resize: vertical;
        outline: none;
    }
    .md-editor:focus {
        border-color: rgba(63, 234, 0, 0.4);
    }

    .md-render {
        min-height: 60vh;
        padding: 12px 4px;
        line-height: 1.65;
        font-size: 1rem;
        color: #e5e5e5;
    }
    .md-render :deep(h1),
    .md-render :deep(h2),
    .md-render :deep(h3),
    .md-render :deep(h4) {
        font-family: var(--font-headline, serif);
        font-weight: 500;
        letter-spacing: 0.005em;
        margin-top: 1.6em;
        margin-bottom: 0.4em;
        line-height: 1.25;
    }
    .md-render :deep(h1) {
        font-size: 1.6rem;
    }
    .md-render :deep(h2) {
        font-size: 1.3rem;
    }
    .md-render :deep(h3) {
        font-size: 1.1rem;
    }
    .md-render :deep(p) {
        margin: 0.6em 0;
    }
    .md-render :deep(ul),
    .md-render :deep(ol) {
        padding-left: 1.4em;
        margin: 0.6em 0;
    }
    .md-render :deep(code) {
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 0.9em;
    }
    .md-render :deep(pre) {
        background: rgba(255, 255, 255, 0.05);
        padding: 12px 14px;
        border-radius: 8px;
        overflow-x: auto;
    }
    .md-render :deep(pre code) {
        background: transparent;
        padding: 0;
    }
    .md-render :deep(blockquote) {
        border-left: 3px solid rgba(63, 234, 0, 0.5);
        padding-left: 14px;
        color: var(--lv-silver, #ccc);
        margin: 0.8em 0;
    }
    .md-render :deep(a) {
        color: #3fea00;
    }
    .md-render :deep(table) {
        border-collapse: collapse;
        margin: 1em 0;
    }
    .md-render :deep(th),
    .md-render :deep(td) {
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 6px 10px;
    }

    .child-section {
        margin-top: 48px;
    }
    .child-heading {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin: 0 0 10px;
    }
    .child-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
    }
    .child-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.05);
        text-decoration: none;
        color: inherit;
    }
    .child-card:hover {
        border-color: rgba(63, 234, 0, 0.35);
    }
    .child-emoji {
        font-size: 1.1rem;
    }
    .child-title {
        font-size: 0.88rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .context-panel {
        border-left: 1px solid rgba(255, 255, 255, 0.06);
        background: var(--lv-surface, #141414);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .panel-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 16px 16px 32px;
    }

    .outline-item {
        display: block;
        padding: 4px 0;
        color: var(--lv-silver, #ccc);
        text-decoration: none;
        font-size: 0.86rem;
    }
    .outline-item:hover {
        color: #fff;
    }

    .src-block {
        margin-bottom: 14px;
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
        font-size: 0.86rem;
        color: #e5e5e5;
    }
    .src-value.mono {
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
        word-break: break-all;
        color: var(--lv-silver, #bbb);
    }

    .muted {
        color: var(--lv-silver, #888);
        font-size: 0.85rem;
        line-height: 1.5;
    }

    .ask-answer {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .answer-text {
        font-size: 0.9rem;
        color: #e5e5e5;
        white-space: pre-wrap;
    }
    .citation-item {
        display: flex;
        gap: 8px;
        padding: 8px 0;
        text-decoration: none;
        color: inherit;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .emoji-slot {
        font-size: 1.1rem;
        flex-shrink: 0;
    }
    .citation-title {
        font-weight: 500;
        font-size: 0.85rem;
    }
    .citation-snippet {
        font-size: 0.78rem;
        color: var(--lv-silver, #999);
        margin-top: 2px;
    }

    .loading {
        padding: 40px;
        text-align: center;
        color: var(--lv-silver, #888);
    }
</style>
