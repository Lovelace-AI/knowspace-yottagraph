<template>
    <div class="d-flex flex-column fill-height list-layout">
        <div class="flex-shrink-0 list-header">
            <div>
                <div class="eyebrow">Sources</div>
                <h1 class="title">Connected sources</h1>
                <p class="sub">
                    Knowspace indexes content from external sources. Imported Notion exports and
                    Google Drive connections both appear here.
                </p>
            </div>
        </div>

        <div class="flex-grow-1 overflow-y-auto list-body">
            <div class="connectors">
                <v-card class="connector-card">
                    <div class="connector-head">
                        <div class="connector-icon notion">📓</div>
                        <div>
                            <div class="connector-title">Notion export</div>
                            <div class="connector-sub">
                                Upload a Notion export zip. The Import Center handles parsing.
                            </div>
                        </div>
                    </div>
                    <v-btn variant="tonal" prepend-icon="mdi-tray-arrow-down" to="/import">
                        Open Import Center
                    </v-btn>
                </v-card>

                <v-card class="connector-card">
                    <div class="connector-head">
                        <div class="connector-icon google">G</div>
                        <div>
                            <div class="connector-title">Google Drive</div>
                            <div class="connector-sub">
                                Index Google Docs without forcing users out of Google Docs.
                            </div>
                        </div>
                    </div>
                    <v-btn
                        variant="tonal"
                        prepend-icon="mdi-google-drive"
                        @click="connectGoogle"
                        :loading="connectingGoogle"
                    >
                        Connect Google Drive
                    </v-btn>
                </v-card>
            </div>

            <h2 class="section-title">All sources</h2>
            <div v-if="loading" class="centered"><v-progress-circular indeterminate /></div>
            <div v-else-if="!sources.length" class="empty-block">
                <v-icon icon="mdi-source-branch" size="32" class="mb-2" />
                <div class="empty-title">No sources connected</div>
                <div class="empty-sub">Upload a Notion export or connect Google Drive above.</div>
            </div>
            <div v-else class="source-list">
                <v-card v-for="s in sources" :key="s.id" class="source-row">
                    <div class="source-info">
                        <div class="source-title">
                            <span class="source-type-icon">{{ typeIcon(s.sourceType) }}</span>
                            {{ s.displayName }}
                        </div>
                        <div class="source-meta">
                            {{ s.sourceType.replace('_', ' ') }} · Added
                            {{ formatDate(s.createdAt) }}
                        </div>
                    </div>
                    <div class="source-status">
                        <v-chip :color="statusColor(s.status)">{{ s.status }}</v-chip>
                        <v-btn
                            v-if="s.config && (s.config as any).externalUrl"
                            variant="text"
                            size="small"
                            :href="(s.config as any).externalUrl"
                            target="_blank"
                            prepend-icon="mdi-open-in-new"
                        >
                            Open
                        </v-btn>
                        <v-btn
                            icon
                            size="small"
                            variant="text"
                            color="error"
                            @click="removeSource(s.id)"
                        >
                            <v-icon size="18">mdi-trash-can-outline</v-icon>
                        </v-btn>
                    </div>
                </v-card>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';
    import type { SourceRecord } from '~/utils/knowspaceTypes';

    const knowspace = useKnowspace();
    const sources = ref<SourceRecord[]>([]);
    const loading = ref(true);
    const connectingGoogle = ref(false);

    async function load() {
        loading.value = true;
        try {
            sources.value = await knowspace.listSources();
        } finally {
            loading.value = false;
        }
    }
    onMounted(load);

    async function connectGoogle() {
        // OAuth scaffold: in production this would open Google's consent screen.
        // For the MVP we register a placeholder source so downstream views work.
        connectingGoogle.value = true;
        try {
            await knowspace.createSource({
                sourceType: 'google_drive',
                displayName: 'My Google Drive',
                status: 'connected',
                config: {
                    note: 'Placeholder connection — real OAuth flow not yet wired up.',
                    externalUrl: 'https://drive.google.com/',
                },
            });
            await load();
        } finally {
            connectingGoogle.value = false;
        }
    }

    async function removeSource(id: string) {
        await knowspace.deleteSource(id);
        await load();
    }

    function typeIcon(t: SourceRecord['sourceType']): string {
        switch (t) {
            case 'notion_export':
                return '📓';
            case 'google_drive':
            case 'google_doc':
                return '🟦';
            case 'upload':
                return '📎';
            default:
                return '🔗';
        }
    }

    function statusColor(status: SourceRecord['status']) {
        switch (status) {
            case 'connected':
                return 'success';
            case 'syncing':
                return 'info';
            case 'error':
                return 'error';
            case 'pending':
                return 'warning';
            default:
                return undefined;
        }
    }

    function formatDate(iso?: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleString();
    }
</script>

<style scoped>
    .list-layout {
        background: var(--lv-background, #0a0a0a);
    }

    .list-header {
        padding: 36px 40px 20px;
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

    .list-body {
        padding: 24px 40px 48px;
    }

    .connectors {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
    }

    .connector-card {
        padding: 20px !important;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
    }

    .connector-head {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .connector-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        background: rgba(255, 255, 255, 0.04);
    }

    .connector-title {
        font-weight: 500;
    }

    .connector-sub {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.85rem;
        max-width: 300px;
    }

    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.05rem;
        margin-bottom: 12px;
    }

    .centered {
        display: flex;
        justify-content: center;
        padding: 32px;
    }

    .empty-block {
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 32px;
        text-align: center;
        color: rgba(255, 255, 255, 0.6);
    }

    .empty-title {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .empty-sub {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.45);
    }

    .source-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .source-row {
        padding: 14px 18px !important;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    }

    .source-title {
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .source-type-icon {
        width: 22px;
        text-align: center;
    }

    .source-meta {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 4px;
    }

    .source-status {
        display: flex;
        align-items: center;
        gap: 8px;
    }
</style>
