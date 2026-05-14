<template>
    <div class="page">
        <header class="page-header">
            <div>
                <div class="eyebrow">Knowspace · Workspace</div>
                <h1 class="page-title">Sources</h1>
                <p class="page-sub">
                    Sources are the external systems Knowspace pulls knowledge from. Connect one to
                    start importing or indexing content.
                </p>
            </div>
        </header>

        <section class="connector-grid">
            <v-card class="connector-card">
                <div class="connector-icon">
                    <v-icon size="36" color="primary">mdi-tray-arrow-down</v-icon>
                </div>
                <div class="connector-name">Notion Export</div>
                <div class="connector-desc">
                    Upload a Notion workspace zip. Pages, attachments, and CSV databases are
                    converted into Knowspace pages and collections.
                </div>
                <v-btn color="primary" variant="flat" to="/import" size="small">
                    Open Import Center
                </v-btn>
            </v-card>

            <v-card class="connector-card">
                <div class="connector-icon">
                    <v-icon size="36" color="primary">mdi-google-drive</v-icon>
                </div>
                <div class="connector-name">Google Drive</div>
                <div class="connector-desc">
                    Index Docs and folders without leaving Google. Knowspace stores metadata +
                    content for search and entity linking.
                </div>
                <v-btn
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="connectGoogleDrive"
                    :loading="connecting"
                >
                    Connect Drive
                </v-btn>
                <div class="connector-note">OAuth scaffold — full sync arrives in Phase 4.</div>
            </v-card>
        </section>

        <section class="block">
            <h2 class="block-title">Connected sources</h2>
            <div v-if="loading" class="muted">Loading…</div>
            <div v-else-if="sources.length === 0" class="muted empty-line">
                No sources connected yet.
            </div>
            <div v-else class="source-list">
                <div v-for="s in sources" :key="s.id" class="source-row">
                    <div class="source-icon">
                        <v-icon size="22" color="primary">{{ iconFor(s.source_type) }}</v-icon>
                    </div>
                    <div class="source-meta">
                        <div class="source-name">{{ s.display_name }}</div>
                        <div class="source-sub">
                            {{ s.source_type }} · {{ s.object_count }} object{{
                                s.object_count === 1 ? '' : 's'
                            }}
                            · created {{ formatRelative(s.created_at) }}
                        </div>
                    </div>
                    <v-chip :color="statusColor(s.status)" size="small" variant="flat">
                        {{ s.status }}
                    </v-chip>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    interface SourceRow {
        id: string;
        source_type: string;
        display_name: string;
        status: string;
        object_count: number;
        created_at: string;
    }

    const sources = ref<SourceRow[]>([]);
    const loading = ref(true);
    const connecting = ref(false);
    const { notify } = useNotification();

    async function load() {
        loading.value = true;
        try {
            const res = await $fetch<{ sources: SourceRow[] }>('/api/sources');
            sources.value = res.sources || [];
        } finally {
            loading.value = false;
        }
    }

    async function connectGoogleDrive() {
        connecting.value = true;
        try {
            await $fetch('/api/sources', {
                method: 'POST',
                body: { source_type: 'google_drive', display_name: 'Google Drive' },
            });
            notify(
                'Drive source registered. OAuth handshake and document sync arrive in Phase 4.',
                'info'
            );
            await load();
        } catch (err: any) {
            notify(`Connect failed: ${err?.statusMessage || err?.message || err}`, 'error');
        } finally {
            connecting.value = false;
        }
    }

    function iconFor(type: string): string {
        if (type === 'notion_export') return 'mdi-cloud-download-outline';
        if (type === 'google_drive') return 'mdi-google-drive';
        if (type === 'google_doc') return 'mdi-file-document-outline';
        if (type === 'upload') return 'mdi-upload';
        return 'mdi-database-outline';
    }

    function statusColor(status: string): string {
        if (status === 'active' || status === 'ready' || status === 'idle') return 'primary';
        if (status === 'pending' || status === 'queued' || status === 'running') return 'info';
        if (status === 'error') return 'error';
        return 'grey';
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
        return d.toLocaleDateString();
    }

    onMounted(load);
</script>

<style scoped>
    .page {
        padding: 40px 48px 80px;
        max-width: 1100px;
        margin: 0 auto;
    }
    .page-header {
        margin-bottom: 32px;
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

    .connector-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 40px;
    }
    .connector-card {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: var(--lv-surface, #141414) !important;
    }
    .connector-name {
        font-weight: 500;
        font-size: 1.1rem;
    }
    .connector-desc {
        color: var(--lv-silver, #aaa);
        font-size: 0.86rem;
        line-height: 1.5;
        flex-grow: 1;
    }
    .connector-note {
        font-size: 0.74rem;
        color: var(--lv-silver, #888);
        font-style: italic;
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
        font-size: 0.88rem;
    }
    .empty-line {
        padding: 12px 0;
    }

    .source-list {
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        overflow: hidden;
    }
    .source-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .source-row:last-child {
        border-bottom: none;
    }
    .source-meta {
        flex: 1 1 auto;
    }
    .source-name {
        font-weight: 500;
        font-size: 0.95rem;
    }
    .source-sub {
        font-size: 0.78rem;
        color: var(--lv-silver, #888);
        margin-top: 2px;
        font-family: var(--font-mono, monospace);
    }
</style>
