<template>
    <div class="page">
        <header class="page-header">
            <div>
                <div class="eyebrow">Knowspace · Migration</div>
                <h1 class="page-title">Import Center</h1>
                <p class="page-sub">
                    Bring exported knowledge into Knowspace. Each import batch records the source,
                    status, and any items that need manual review.
                </p>
            </div>
        </header>

        <section class="upload-card">
            <div class="upload-icon">
                <v-icon size="32" color="primary">mdi-tray-arrow-down</v-icon>
            </div>
            <div class="upload-meta">
                <div class="upload-title">Upload Notion bundle</div>
                <div class="upload-sub">
                    Generate a bundle locally with
                    <code>npm run notion-prep -- --path &lt;export&gt; --out bundle.json</code>
                    (apply <code>--exclude "Contacts,Accounts,…"</code> to skip databases), then
                    drop the JSON here. The server parses pages, collections, and records, applies
                    your exclusions, and writes everything into Postgres.
                </div>
            </div>
            <div class="upload-action">
                <input
                    ref="fileInput"
                    type="file"
                    accept=".json,application/json"
                    style="display: none"
                    @change="onFileChosen"
                />
                <v-btn color="primary" :loading="uploading" @click="triggerPicker">
                    Choose bundle
                </v-btn>
            </div>
        </section>

        <div v-if="uploadStatus" class="upload-status" :class="uploadStatusKind">
            {{ uploadStatus }}
        </div>

        <section class="block">
            <h2 class="block-title">Import batches</h2>
            <div v-if="loading" class="muted">Loading batches…</div>
            <div v-else-if="batches.length === 0" class="muted empty-line">No imports yet.</div>
            <div v-else class="batch-list">
                <div v-for="b in batches" :key="b.id" class="batch-row">
                    <div class="batch-icon">
                        <v-icon size="22" color="primary">mdi-package-variant-closed</v-icon>
                    </div>
                    <div class="batch-meta">
                        <div class="batch-source">
                            {{ b.source_name || 'Source' }}
                            <span class="batch-type">{{ b.source_type }}</span>
                        </div>
                        <div class="batch-sub">
                            Created {{ formatRelative(b.created_at) }} · id
                            <span class="mono">{{ b.id }}</span>
                        </div>
                        <div class="batch-note" v-if="b.stats_jsonb?.note">
                            {{ b.stats_jsonb.note }}
                        </div>
                    </div>
                    <v-chip :color="statusColor(b.status)" size="small" variant="flat">
                        {{ b.status }}
                    </v-chip>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    interface BatchRow {
        id: string;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        stats_jsonb: any;
        errors_jsonb: any;
        created_at: string;
        source_name: string | null;
        source_type: string | null;
    }

    const batches = ref<BatchRow[]>([]);
    const loading = ref(true);
    const uploading = ref(false);
    const uploadStatus = ref('');
    const uploadStatusKind = ref<'info' | 'error' | 'success'>('info');
    const fileInput = ref<HTMLInputElement | null>(null);

    async function load() {
        loading.value = true;
        try {
            const res = await $fetch<{ batches: BatchRow[] }>('/api/imports');
            batches.value = res.batches || [];
        } finally {
            loading.value = false;
        }
    }

    function triggerPicker() {
        fileInput.value?.click();
    }

    async function onFileChosen(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        uploading.value = true;
        uploadStatus.value = '';
        try {
            const form = new FormData();
            form.append('bundle', file, file.name);
            const res = await $fetch<{
                batch_id: string;
                status: string;
                pages_inserted?: number;
                pages_updated?: number;
                collections_inserted?: number;
                records_inserted?: number;
                duration_ms?: number;
            }>('/api/imports/notion/upload', {
                method: 'POST',
                body: form,
            });
            uploadStatusKind.value = res.status === 'completed' ? 'success' : 'info';
            if (res.status === 'completed') {
                const dur = res.duration_ms ? ` in ${(res.duration_ms / 1000).toFixed(1)}s` : '';
                uploadStatus.value =
                    `Batch ${res.batch_id} committed${dur}: ` +
                    `${res.pages_inserted || 0} pages inserted, ` +
                    `${res.pages_updated || 0} updated, ` +
                    `${res.collections_inserted || 0} collections, ` +
                    `${res.records_inserted || 0} records.`;
            } else {
                uploadStatus.value = `Batch ${res.batch_id} queued (status: ${res.status}).`;
            }
            await load();
        } catch (err: any) {
            uploadStatusKind.value = 'error';
            uploadStatus.value = `Upload failed: ${err?.statusMessage || err?.data?.statusMessage || err?.message || err}`;
        } finally {
            uploading.value = false;
            if (target) target.value = '';
        }
    }

    function statusColor(status: string): string {
        if (status === 'completed' || status === 'success') return 'primary';
        if (status === 'queued' || status === 'pending' || status === 'running') return 'info';
        if (status === 'error' || status === 'failed') return 'error';
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
        max-width: 960px;
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

    .upload-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        background: var(--lv-surface, #141414);
        border: 1px dashed rgba(63, 234, 0, 0.3);
        border-radius: 12px;
        margin-bottom: 16px;
    }
    .upload-meta {
        flex: 1 1 auto;
    }
    .upload-title {
        font-weight: 500;
        font-size: 1.05rem;
        margin-bottom: 4px;
    }
    .upload-sub {
        color: var(--lv-silver, #aaa);
        font-size: 0.86rem;
        line-height: 1.4;
    }

    .upload-status {
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.86rem;
        margin-bottom: 24px;
    }
    .upload-status.info {
        background: rgba(0, 59, 255, 0.1);
        border: 1px solid rgba(0, 59, 255, 0.25);
        color: #b6c8ff;
    }
    .upload-status.success {
        background: rgba(63, 234, 0, 0.08);
        border: 1px solid rgba(63, 234, 0, 0.25);
        color: #cffcb0;
    }
    .upload-status.error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fda4a4;
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
    }
    .empty-line {
        padding: 12px 0;
    }

    .batch-list {
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        overflow: hidden;
    }
    .batch-row {
        display: flex;
        gap: 14px;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .batch-row:last-child {
        border-bottom: none;
    }
    .batch-meta {
        flex: 1 1 auto;
    }
    .batch-source {
        font-weight: 500;
        font-size: 0.95rem;
    }
    .batch-type {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        color: var(--lv-silver, #888);
        margin-left: 6px;
        padding: 1px 6px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
    }
    .batch-sub {
        font-size: 0.78rem;
        color: var(--lv-silver, #888);
        margin-top: 2px;
    }
    .batch-note {
        font-size: 0.82rem;
        color: var(--lv-silver, #aaa);
        font-style: italic;
        margin-top: 4px;
    }
    .mono {
        font-family: var(--font-mono, monospace);
    }
</style>
