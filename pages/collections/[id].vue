<template>
    <div class="page" v-if="collection">
        <div class="crumbs">
            <NuxtLink to="/collections">Collections</NuxtLink>
            <span class="sep">/</span>
            <span>{{ collection.name }}</span>
        </div>

        <div class="page-header">
            <div>
                <h1 class="page-title">{{ collection.name }}</h1>
                <p class="page-sub" v-if="collection.description">
                    {{ collection.description }}
                </p>
            </div>
            <div class="header-actions">
                <v-btn-toggle
                    v-model="viewMode"
                    mandatory
                    variant="text"
                    density="compact"
                    color="primary"
                >
                    <v-btn value="table" size="small">
                        <v-icon size="16">mdi-table</v-icon>
                        Table
                    </v-btn>
                    <v-btn value="list" size="small">
                        <v-icon size="16">mdi-format-list-bulleted</v-icon>
                        List
                    </v-btn>
                    <v-btn value="board" size="small">
                        <v-icon size="16">mdi-view-column-outline</v-icon>
                        Board
                    </v-btn>
                </v-btn-toggle>
            </div>
        </div>

        <div v-if="records.length === 0" class="empty">
            <v-icon size="40" color="silver">mdi-database-outline</v-icon>
            <div class="empty-title">No records yet</div>
            <p class="empty-sub">
                Records will populate here once you create them, or when a Notion CSV import maps to
                this collection.
            </p>
        </div>

        <div v-else-if="viewMode === 'table'" class="table-wrap">
            <v-table density="comfortable">
                <thead>
                    <tr>
                        <th v-for="f in fields" :key="f.id">{{ f.name }}</th>
                        <th>Page</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="r in records" :key="r.id">
                        <td v-for="f in fields" :key="f.id">
                            {{ propValue(r, f) }}
                        </td>
                        <td>
                            <NuxtLink v-if="r.page_id" :to="`/pages/${r.page_id}`" class="link">
                                {{ r.page_emoji || '📄' }} {{ r.page_title || 'Untitled' }}
                            </NuxtLink>
                        </td>
                        <td class="mono">{{ formatRelative(r.updated_at) }}</td>
                    </tr>
                </tbody>
            </v-table>
        </div>

        <div v-else-if="viewMode === 'list'" class="list-view">
            <div v-for="r in records" :key="r.id" class="list-row">
                <div class="list-main">
                    <NuxtLink v-if="r.page_id" :to="`/pages/${r.page_id}`" class="link">
                        {{ r.page_emoji || '📄' }} {{ r.page_title || nameOf(r) }}
                    </NuxtLink>
                    <span v-else>{{ nameOf(r) }}</span>
                </div>
                <div class="mono small">{{ formatRelative(r.updated_at) }}</div>
            </div>
        </div>

        <div v-else class="board-view">
            <div v-for="(group, status) in boardGroups" :key="status" class="board-col">
                <div class="board-col-header">{{ status }}</div>
                <div v-for="r in group" :key="r.id" class="board-card">
                    <div class="board-card-title">{{ nameOf(r) }}</div>
                    <div v-if="r.page_id" class="board-card-link">
                        <NuxtLink :to="`/pages/${r.page_id}`" class="link"> Open page → </NuxtLink>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-else-if="loading" class="loading">Loading collection…</div>
    <div v-else class="loading">Collection not found.</div>
</template>

<script setup lang="ts">
    import { computed, ref, watch } from 'vue';

    interface Field {
        id: string;
        name: string;
        field_type: string;
    }
    interface Record {
        id: string;
        properties_jsonb: Record<string, unknown>;
        page_id: string | null;
        page_title: string | null;
        page_emoji: string | null;
        updated_at: string;
    }
    interface CollectionResp {
        collection: { id: string; name: string; description: string | null };
        fields: Field[];
        records: Record[];
    }

    const route = useRoute();
    const collection = ref<CollectionResp['collection'] | null>(null);
    const fields = ref<Field[]>([]);
    const records = ref<Record[]>([]);
    const loading = ref(true);
    const viewMode = ref<'table' | 'list' | 'board'>('table');

    async function load(id: string) {
        loading.value = true;
        try {
            const res = await $fetch<CollectionResp>(`/api/collections/${id}`);
            collection.value = res.collection;
            fields.value = res.fields || [];
            records.value = res.records || [];
        } catch {
            collection.value = null;
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => route.params.id,
        (id) => {
            if (typeof id === 'string') load(id);
        },
        { immediate: true }
    );

    function propValue(rec: Record, field: Field) {
        const v = (rec.properties_jsonb || {})[field.name];
        if (v === undefined || v === null) return '';
        if (Array.isArray(v)) return v.join(', ');
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    }

    function nameOf(rec: Record) {
        return (
            (rec.properties_jsonb as any)?.Name ||
            (rec.properties_jsonb as any)?.name ||
            rec.page_title ||
            'Untitled record'
        );
    }

    const boardGroups = computed(() => {
        const groups: Record<string, Record[]> = {};
        for (const r of records.value) {
            const s = String((r.properties_jsonb as any)?.Status || 'No status');
            (groups[s] ||= []).push(r);
        }
        return groups;
    });

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
</script>

<style scoped>
    .page {
        padding: 32px 48px 80px;
        max-width: 1200px;
        margin: 0 auto;
    }
    .crumbs {
        font-size: 0.78rem;
        color: var(--lv-silver, #888);
        margin-bottom: 12px;
    }
    .crumbs a {
        color: var(--lv-silver, #aaa);
        text-decoration: none;
    }
    .crumbs a:hover {
        color: #fff;
    }
    .sep {
        margin: 0 6px;
        color: rgba(255, 255, 255, 0.25);
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        margin-bottom: 24px;
    }
    .page-title {
        font-family: var(--font-headline, serif);
        font-weight: 400;
        font-size: 1.8rem;
        margin: 0 0 4px;
    }
    .page-sub {
        color: var(--lv-silver, #aaa);
        max-width: 600px;
        margin: 0;
    }

    .empty {
        text-align: center;
        padding: 60px 20px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 12px;
    }
    .empty-title {
        font-family: var(--font-headline, serif);
        font-size: 1.2rem;
        margin: 12px 0 6px;
    }
    .empty-sub {
        color: var(--lv-silver, #aaa);
        max-width: 420px;
        margin: 0 auto;
    }

    .table-wrap :deep(table) {
        background: var(--lv-surface, #141414);
        border-radius: 10px;
        overflow: hidden;
    }

    .list-view {
        background: var(--lv-surface, #141414);
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        overflow: hidden;
    }
    .list-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .list-row:last-child {
        border-bottom: none;
    }

    .board-view {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
    }
    .board-col {
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 10px;
    }
    .board-col-header {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--lv-silver, #888);
        margin-bottom: 10px;
        padding: 0 4px;
    }
    .board-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 8px;
    }
    .board-card-title {
        font-size: 0.88rem;
        font-weight: 500;
    }
    .board-card-link {
        margin-top: 6px;
        font-size: 0.8rem;
    }

    .link {
        color: #3fea00;
        text-decoration: none;
    }
    .link:hover {
        text-decoration: underline;
    }
    .mono {
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
        color: var(--lv-silver, #888);
    }
    .small {
        font-size: 0.74rem;
    }

    .loading {
        padding: 60px;
        text-align: center;
        color: var(--lv-silver, #888);
    }
</style>
