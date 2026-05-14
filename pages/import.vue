<template>
    <div class="d-flex flex-column fill-height list-layout">
        <div class="flex-shrink-0 list-header">
            <div>
                <div class="eyebrow">Import Center</div>
                <h1 class="title">Notion workspace import</h1>
                <p class="sub">
                    Drop in a Notion export zip and we'll inventory pages, collections, attachments,
                    and unresolved internal links. This MVP scaffold builds a demonstration import
                    so the rest of the workspace has visible content; real zip parsing is wired up
                    in the import pipeline.
                </p>
            </div>
        </div>

        <div class="flex-grow-1 overflow-y-auto list-body">
            <div
                class="dropzone"
                :class="{ dragging }"
                @dragover.prevent="dragging = true"
                @dragleave.prevent="dragging = false"
                @drop.prevent="onDrop"
            >
                <v-icon icon="mdi-tray-arrow-down" size="36" class="mb-2" />
                <div class="dz-title">Drop a Notion export here</div>
                <div class="dz-sub">…or click to choose a .zip file</div>
                <input ref="fileInput" type="file" accept=".zip" hidden @change="onFile" />
                <v-btn
                    class="mt-3"
                    variant="tonal"
                    prepend-icon="mdi-folder-open-outline"
                    @click="fileInput?.click()"
                    :loading="uploading"
                >
                    Choose file
                </v-btn>
            </div>

            <h2 class="section-title">Batches</h2>
            <div v-if="loading" class="centered"><v-progress-circular indeterminate /></div>
            <div v-else-if="!batches.length" class="empty-block">
                <v-icon icon="mdi-tray-full" size="32" class="mb-2" />
                <div class="empty-title">No imports yet</div>
                <div class="empty-sub">Imported batches will appear here with their reports.</div>
            </div>
            <div v-else class="batch-list">
                <v-card v-for="b in batches" :key="b.id" class="batch-card">
                    <div class="batch-head">
                        <div>
                            <div class="batch-title">{{ b.fileName }}</div>
                            <div class="batch-meta">
                                {{ formatDate(b.startedAt) }} · {{ humanSize(b.fileSize) }} ·
                                <span class="status-pill" :data-status="b.status">
                                    {{ b.status }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="report-grid">
                        <div class="report-stat">
                            <div class="report-val">{{ b.stats.pagesImported }}</div>
                            <div class="report-label">Pages</div>
                        </div>
                        <div class="report-stat">
                            <div class="report-val">{{ b.stats.collectionsImported }}</div>
                            <div class="report-label">Collections</div>
                        </div>
                        <div class="report-stat">
                            <div class="report-val">{{ b.stats.linksResolved }}</div>
                            <div class="report-label">Links resolved</div>
                        </div>
                        <div class="report-stat" :class="{ warn: b.stats.linksUnresolved > 0 }">
                            <div class="report-val">{{ b.stats.linksUnresolved }}</div>
                            <div class="report-label">Unresolved</div>
                        </div>
                        <div class="report-stat" :class="{ warn: b.errors.length > 0 }">
                            <div class="report-val">{{ b.errors.length }}</div>
                            <div class="report-label">Errors</div>
                        </div>
                    </div>

                    <div v-if="b.notes.length" class="notes">
                        <div class="notes-title">Review queue</div>
                        <ul>
                            <li v-for="(n, i) in b.notes.slice(0, 6)" :key="i">{{ n }}</li>
                        </ul>
                        <div v-if="b.notes.length > 6" class="more">
                            +{{ b.notes.length - 6 }} more
                        </div>
                    </div>
                </v-card>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';
    import type { ImportBatch } from '~/utils/knowspaceTypes';

    const knowspace = useKnowspace();
    const batches = ref<ImportBatch[]>([]);
    const loading = ref(true);
    const uploading = ref(false);
    const dragging = ref(false);
    const fileInput = ref<HTMLInputElement | null>(null);
    const { showSuccess, showError } = useNotification();

    async function load() {
        loading.value = true;
        try {
            batches.value = await knowspace.listImports();
        } finally {
            loading.value = false;
        }
    }
    onMounted(load);

    async function onFile(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        await uploadFile(file);
        target.value = '';
    }

    async function onDrop(event: DragEvent) {
        dragging.value = false;
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.zip')) {
            showError('Please drop a .zip export');
            return;
        }
        await uploadFile(file);
    }

    async function uploadFile(file: File) {
        uploading.value = true;
        try {
            const result = await knowspace.uploadNotionExport(file);
            showSuccess(`Imported ${result.batch.stats.pagesImported} pages from ${file.name}`);
            await load();
            await knowspace.refreshNav();
        } catch (err: any) {
            showError(err?.statusMessage || err?.message || 'Import failed');
        } finally {
            uploading.value = false;
        }
    }

    function humanSize(bytes: number): string {
        if (!bytes) return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let i = 0;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i += 1;
        }
        return `${value.toFixed(1)} ${units[i]}`;
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
        max-width: 640px;
    }

    .list-body {
        padding: 24px 40px 48px;
    }

    .dropzone {
        border: 1px dashed rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 36px;
        text-align: center;
        background: rgba(255, 255, 255, 0.015);
        margin-bottom: 32px;
        transition: border-color 0.15s ease;
    }

    .dropzone.dragging {
        border-color: var(--lv-green, #3fea00);
        background: rgba(63, 234, 0, 0.04);
    }

    .dz-title {
        font-weight: 500;
        font-size: 1rem;
    }

    .dz-sub {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.5);
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

    .batch-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .batch-card {
        padding: 18px 20px !important;
    }

    .batch-title {
        font-weight: 500;
    }

    .batch-meta {
        margin-top: 4px;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        display: inline-flex;
        gap: 8px;
        align-items: center;
    }

    .status-pill {
        text-transform: uppercase;
        font-family: var(--font-mono);
        font-size: 0.65rem;
        letter-spacing: 0.1em;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .status-pill[data-status='completed'] {
        color: var(--lv-green, #3fea00);
        border-color: rgba(63, 234, 0, 0.4);
    }

    .status-pill[data-status='failed'] {
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.4);
    }

    .report-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 12px;
        margin-top: 14px;
    }

    .report-stat {
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.015);
    }

    .report-stat.warn {
        border-color: rgba(255, 92, 0, 0.4);
    }

    .report-val {
        font-family: var(--font-headline);
        font-size: 1.4rem;
    }

    .report-label {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
    }

    .notes {
        margin-top: 14px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .notes-title {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 6px;
    }

    .notes ul {
        padding-left: 18px;
        margin: 0;
    }

    .notes li {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.75);
        margin-bottom: 2px;
    }

    .more {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 4px;
    }
</style>
