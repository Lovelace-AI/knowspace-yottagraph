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
                    ref="editorRef"
                    v-model="contentDraft"
                    class="md-editor"
                    placeholder="Write in Markdown. Headings, lists, **bold**, *italic*, `code`, and [links](#) all work."
                    @input="onContentInput"
                    @paste="onEditorPaste"
                    @keyup="onEditorCursorUpdate"
                    @click="onEditorCursorUpdate"
                    @keydown="onEditorKeydown"
                ></textarea>
                <div v-if="showCompletionBox" class="completion-box">
                    <button
                        v-for="option in completionOptions"
                        :key="option.value"
                        class="completion-option"
                        @mousedown.prevent="applyCompletion(option.value)"
                    >
                        <span class="completion-main">{{ option.label }}</span>
                        <span class="completion-meta" v-if="option.meta">{{ option.meta }}</span>
                    </button>
                </div>
                <div
                    v-show="viewMode === 'render' || viewMode === 'split'"
                    class="md-render"
                    v-html="renderedHtml"
                    @mouseover="onRenderHover"
                    @mouseleave="hideWikiPreview"
                ></div>
                <div
                    v-if="wikiPreview.visible"
                    class="wiki-preview"
                    :style="{ left: wikiPreview.x + 'px', top: wikiPreview.y + 'px' }"
                >
                    <div class="wiki-preview-title">{{ wikiPreview.title }}</div>
                    <div class="wiki-preview-snippet">{{ wikiPreview.snippet }}</div>
                </div>
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
                <v-tab value="links">Links</v-tab>
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

                <BacklinksPanel v-else-if="panelTab === 'links'" :page-id="page.id" />
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
    import BacklinksPanel from '~/components/BacklinksPanel.vue';

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
    const editorRef = ref<HTMLTextAreaElement | null>(null);
    const showPanel = ref(true);
    const panelTab = ref<'outline' | 'links'>('outline');
    const viewMode = ref<'render' | 'edit' | 'split'>('edit');
    const saving = ref(false);
    const lastSavedAt = ref<number | null>(null);
    const deleteDialog = ref(false);

    const EMOJI_CYCLE = ['📄', '📝', '📓', '📚', '🗂️', '💡', '🧠', '🔬', '🎯', '🚀', '🌱'];
    const tagCatalog = ref<Array<{ tag: string; usage_count: number }>>([]);
    const completionMode = ref<'tag' | 'wiki' | null>(null);
    const completionQuery = ref('');
    const completionStart = ref(0);
    const completionEnd = ref(0);
    const wikiPreview = ref({
        visible: false,
        x: 0,
        y: 0,
        title: '',
        snippet: '',
    });

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
        void loadTagCatalog();
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

    const completionOptions = computed(() => {
        if (completionMode.value === 'tag') {
            const q = completionQuery.value.toLowerCase();
            return tagCatalog.value
                .filter((t) => !q || t.tag.includes(q))
                .slice(0, 8)
                .map((t) => ({
                    value: t.tag,
                    label: `#${t.tag}`,
                    meta: `${t.usage_count} docs`,
                }));
        }
        if (completionMode.value === 'wiki') {
            const q = completionQuery.value.toLowerCase();
            return (nav.pages.value || [])
                .filter((p) => !q || (p.title || '').toLowerCase().includes(q))
                .slice(0, 8)
                .map((p) => ({
                    value: p.title || 'Untitled',
                    label: p.title || 'Untitled',
                    meta: p.emoji || '📄',
                }));
        }
        return [];
    });

    const showCompletionBox = computed(
        () =>
            (completionMode.value === 'tag' || completionMode.value === 'wiki') &&
            completionOptions.value.length > 0
    );

    async function loadTagCatalog() {
        try {
            const res = await $fetch<{ tags: Array<{ tag: string; usage_count: number }> }>(
                '/api/tags?limit=200'
            );
            tagCatalog.value = res.tags || [];
        } catch {
            tagCatalog.value = [];
        }
    }

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
        onEditorCursorUpdate();
        scheduleSave();
    }
    function onTitleBlur() {
        scheduleSave();
    }
    function onTitleEnter() {
        (titleInput.value as HTMLInputElement | null)?.blur();
    }

    function onEditorCursorUpdate() {
        const el = editorRef.value;
        if (!el) {
            completionMode.value = null;
            return;
        }
        const cursor = el.selectionStart || 0;
        const before = contentDraft.value.slice(0, cursor);

        const wikiMatch = before.match(/\[\[([^\]\n]*)$/);
        if (wikiMatch) {
            completionMode.value = 'wiki';
            completionQuery.value = wikiMatch[1] || '';
            completionStart.value = cursor - wikiMatch[0].length;
            completionEnd.value = cursor;
            return;
        }

        const tagMatch = before.match(/(^|[\s([{-])#([a-zA-Z0-9/_-]*)$/);
        if (tagMatch) {
            completionMode.value = 'tag';
            completionQuery.value = tagMatch[2] || '';
            completionStart.value = cursor - (tagMatch[2] || '').length - 1;
            completionEnd.value = cursor;
            return;
        }

        completionMode.value = null;
    }

    function onEditorKeydown(evt: KeyboardEvent) {
        if (!showCompletionBox.value) return;
        if (evt.key === 'Enter' || evt.key === 'Tab') {
            evt.preventDefault();
            const first = completionOptions.value[0];
            if (first) applyCompletion(first.value);
        }
        if (evt.key === 'Escape') {
            completionMode.value = null;
        }
    }

    function applyCompletion(value: string) {
        const el = editorRef.value;
        if (!el || !completionMode.value) return;

        const before = contentDraft.value.slice(0, completionStart.value);
        const after = contentDraft.value.slice(completionEnd.value);
        let insertion = '';
        let cursorOffset = 0;
        if (completionMode.value === 'tag') {
            insertion = `#${value}`;
            cursorOffset = insertion.length;
        } else {
            insertion = `[[${value}]]`;
            cursorOffset = insertion.length;
        }
        contentDraft.value = before + insertion + after;
        completionMode.value = null;
        nextTick(() => {
            const newPos = before.length + cursorOffset;
            el.focus();
            el.setSelectionRange(newPos, newPos);
            onEditorCursorUpdate();
            scheduleSave();
        });
    }

    async function onEditorPaste(evt: ClipboardEvent) {
        const el = editorRef.value;
        if (!el) return;
        const text = evt.clipboardData?.getData('text/plain')?.trim() || '';
        if (!/^https?:\/\/\S+$/i.test(text)) return;

        evt.preventDefault();
        let title = '';
        try {
            const res = await $fetch<{ title: string }>('/api/url-title', {
                query: { url: text },
            });
            title = (res.title || '').trim();
        } catch {
            title = '';
        }
        const replacement = `[${title || text}](${text})`;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || start;
        contentDraft.value =
            contentDraft.value.slice(0, start) + replacement + contentDraft.value.slice(end);
        const nextPos = start + replacement.length;
        nextTick(() => {
            el.setSelectionRange(nextPos, nextPos);
            scheduleSave();
        });
    }

    async function onRenderHover(evt: MouseEvent) {
        const target = evt.target as HTMLElement | null;
        const anchor = target?.closest('a') as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        const match = href.match(/\/search\?q=([^&]+)/);
        if (!match) return;
        const title = decodeURIComponent(match[1] || '').trim();
        if (!title) return;
        try {
            const res = await $fetch<{ found: boolean; snippet: string; title?: string }>(
                '/api/pages/preview',
                { query: { title } }
            );
            if (!res.found) return;
            wikiPreview.value = {
                visible: true,
                x: evt.clientX + 16,
                y: evt.clientY + 16,
                title: res.title || title,
                snippet: res.snippet || '',
            };
        } catch {
            // ignore
        }
    }

    function hideWikiPreview() {
        wikiPreview.value.visible = false;
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
        position: relative;
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
    .completion-box {
        position: absolute;
        left: 12px;
        top: 52px;
        z-index: 5;
        min-width: 260px;
        max-width: 380px;
        max-height: 240px;
        overflow: auto;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        background: #171717;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
    }
    .completion-option {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        border: none;
        background: transparent;
        color: #e5e5e5;
        text-align: left;
        padding: 8px 10px;
        cursor: pointer;
    }
    .completion-option:hover {
        background: rgba(63, 234, 0, 0.09);
    }
    .completion-main {
        font-size: 0.82rem;
    }
    .completion-meta {
        font-size: 0.74rem;
        color: var(--lv-silver, #999);
    }
    .wiki-preview {
        position: fixed;
        z-index: 20;
        max-width: 320px;
        background: #141414;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.45);
        padding: 8px 10px;
    }
    .wiki-preview-title {
        font-size: 0.82rem;
        font-weight: 600;
        margin-bottom: 4px;
    }
    .wiki-preview-snippet {
        font-size: 0.76rem;
        color: var(--lv-silver, #aaa);
        line-height: 1.4;
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
