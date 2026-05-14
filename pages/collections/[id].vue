<template>
    <div class="d-flex flex-column fill-height">
        <div v-if="loading" class="centered">
            <v-progress-circular indeterminate />
        </div>
        <template v-else-if="collection">
            <div class="flex-shrink-0 header">
                <NuxtLink to="/collections" class="back-link">
                    <v-icon size="14">mdi-arrow-left</v-icon> Collections
                </NuxtLink>
                <div class="title-row">
                    <span class="title-emoji">{{ collection.icon }}</span>
                    <h1 class="title">{{ collection.name }}</h1>
                </div>
                <p v-if="collection.description" class="description">
                    {{ collection.description }}
                </p>
                <div class="actions">
                    <v-btn-toggle v-model="view" mandatory density="comfortable">
                        <v-btn value="table" prepend-icon="mdi-table">Table</v-btn>
                        <v-btn value="list" prepend-icon="mdi-format-list-bulleted">List</v-btn>
                        <v-btn value="board" prepend-icon="mdi-view-column-outline">Board</v-btn>
                    </v-btn-toggle>
                    <v-btn color="primary" prepend-icon="mdi-plus" @click="newRecordDialog = true">
                        New record
                    </v-btn>
                </div>
            </div>

            <div class="flex-grow-1 overflow-y-auto body">
                <div v-if="!records.length" class="empty-block">
                    <v-icon icon="mdi-table-large" size="32" class="mb-2" />
                    <div class="empty-title">No records yet</div>
                    <div class="empty-sub">Add your first record to see it here.</div>
                </div>
                <div v-else-if="view === 'table'" class="table-wrap">
                    <v-data-table
                        :headers="tableHeaders"
                        :items="tableItems"
                        :items-per-page="-1"
                        density="comfortable"
                        hover
                        class="data-table"
                    >
                        <template v-slot:item.actions="{ item }">
                            <v-btn
                                icon
                                size="x-small"
                                variant="text"
                                color="error"
                                @click="deleteRecord(item.id)"
                            >
                                <v-icon size="16">mdi-trash-can-outline</v-icon>
                            </v-btn>
                        </template>
                    </v-data-table>
                </div>
                <div v-else-if="view === 'list'" class="list-view">
                    <div v-for="r in records" :key="r.id" class="record-row">
                        <div class="record-title">
                            {{ recordTitle(r.properties) }}
                        </div>
                        <div class="record-meta">
                            <span v-for="(value, key) in r.properties" :key="key" class="meta">
                                <strong>{{ key }}:</strong> {{ formatValue(value) }}
                            </span>
                        </div>
                    </div>
                </div>
                <div v-else-if="view === 'board'" class="board-view">
                    <div v-for="col in boardColumns" :key="col.key" class="board-col">
                        <div class="board-col-head">
                            {{ col.label }}
                            <span class="board-col-count">{{ col.records.length }}</span>
                        </div>
                        <v-card v-for="r in col.records" :key="r.id" class="board-card">
                            <div class="board-card-title">{{ recordTitle(r.properties) }}</div>
                            <div class="board-card-tags">
                                <v-chip
                                    v-for="t in extractTags(r.properties)"
                                    :key="t"
                                    size="x-small"
                                >
                                    {{ t }}
                                </v-chip>
                            </div>
                        </v-card>
                    </div>
                </div>
            </div>
        </template>

        <v-dialog v-model="newRecordDialog" max-width="520">
            <v-card v-if="collection">
                <v-card-title>New record</v-card-title>
                <v-card-text>
                    <div v-for="f in collection.fields" :key="f.id" class="form-row">
                        <v-text-field
                            v-if="['text', 'url', 'person'].includes(f.type)"
                            v-model="draftRecord[f.name]"
                            :label="f.name"
                        />
                        <v-text-field
                            v-else-if="f.type === 'number'"
                            v-model.number="draftRecord[f.name]"
                            :label="f.name"
                            type="number"
                        />
                        <v-text-field
                            v-else-if="f.type === 'date'"
                            v-model="draftRecord[f.name]"
                            :label="f.name"
                            type="date"
                        />
                        <v-checkbox
                            v-else-if="f.type === 'checkbox'"
                            v-model="draftRecord[f.name]"
                            :label="f.name"
                        />
                        <v-select
                            v-else-if="f.type === 'select'"
                            v-model="draftRecord[f.name]"
                            :label="f.name"
                            :items="f.options ?? []"
                        />
                        <v-combobox
                            v-else-if="f.type === 'multi_select'"
                            v-model="draftRecord[f.name]"
                            :label="f.name"
                            :items="f.options ?? []"
                            multiple
                            chips
                        />
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="newRecordDialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" @click="createRecord">Create</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref, watch } from 'vue';
    import type { CollectionDef, CollectionRecord } from '~/utils/knowspaceTypes';

    const route = useRoute();
    const knowspace = useKnowspace();

    const collection = ref<CollectionDef | null>(null);
    const records = ref<CollectionRecord[]>([]);
    const loading = ref(true);
    const view = ref<'table' | 'list' | 'board'>('table');
    const newRecordDialog = ref(false);
    const draftRecord = ref<Record<string, any>>({});

    async function load() {
        const id = route.params.id as string;
        loading.value = true;
        try {
            const data = await knowspace.getCollection(id);
            collection.value = data.collection;
            records.value = data.records;
        } finally {
            loading.value = false;
        }
    }

    onMounted(load);
    watch(
        () => route.params.id,
        () => load()
    );

    const tableHeaders = computed(() => {
        if (!collection.value) return [];
        const headers = collection.value.fields.map((f) => ({
            title: f.name,
            key: f.name,
            sortable: true,
        }));
        headers.push({ title: '', key: 'actions', sortable: false });
        return headers;
    });

    const tableItems = computed(() =>
        records.value.map((r) => ({
            id: r.id,
            ...formatProps(r.properties),
        }))
    );

    function formatProps(props: Record<string, unknown>) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(props)) {
            out[k] = formatValue(v);
        }
        return out;
    }

    function formatValue(v: unknown): string {
        if (v == null) return '';
        if (Array.isArray(v)) return v.map(String).join(', ');
        if (typeof v === 'boolean') return v ? '✓' : '';
        return String(v);
    }

    function recordTitle(props: Record<string, unknown>): string {
        const candidates = ['Name', 'name', 'Title', 'title'];
        for (const k of candidates) {
            if (props[k]) return String(props[k]);
        }
        const firstString = Object.values(props).find((v) => typeof v === 'string' && v.trim());
        return firstString ? String(firstString) : 'Untitled record';
    }

    function extractTags(props: Record<string, unknown>): string[] {
        const tags: string[] = [];
        for (const v of Object.values(props)) {
            if (Array.isArray(v)) tags.push(...v.map(String));
        }
        return tags;
    }

    const boardColumns = computed(() => {
        if (!collection.value) return [];
        const selectField = collection.value.fields.find((f) => f.type === 'select');
        if (!selectField || !selectField.options?.length) {
            return [{ key: 'all', label: 'All records', records: records.value }];
        }
        const cols = selectField.options.map((opt) => ({
            key: opt,
            label: opt,
            records: records.value.filter((r) => r.properties[selectField.name] === opt),
        }));
        const unset = records.value.filter(
            (r) => !selectField.options!.includes(r.properties[selectField.name] as string)
        );
        if (unset.length) cols.push({ key: 'unset', label: 'No status', records: unset });
        return cols;
    });

    async function createRecord() {
        if (!collection.value) return;
        const next = await knowspace.createRecord(collection.value.id, { ...draftRecord.value });
        records.value = [next, ...records.value];
        draftRecord.value = {};
        newRecordDialog.value = false;
    }

    async function deleteRecord(id: string) {
        if (!collection.value) return;
        await knowspace.deleteRecord(collection.value.id, id);
        records.value = records.value.filter((r) => r.id !== id);
    }
</script>

<style scoped>
    .centered {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .header {
        padding: 32px 40px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .back-link {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.8rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 12px;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .title-emoji {
        font-size: 1.6rem;
    }

    .title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.7rem;
    }

    .description {
        color: rgba(255, 255, 255, 0.55);
        margin-top: 6px;
        max-width: 640px;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 18px;
    }

    .body {
        padding: 24px 40px 64px;
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

    .data-table {
        background: rgba(255, 255, 255, 0.015) !important;
    }

    .list-view {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .record-row {
        padding: 14px 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.015);
    }

    .record-title {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .record-meta {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.55);
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }

    .board-view {
        display: flex;
        gap: 16px;
        overflow-x: auto;
        padding-bottom: 12px;
    }

    .board-col {
        min-width: 260px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .board-col-head {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.6);
        display: flex;
        justify-content: space-between;
    }

    .board-col-count {
        color: rgba(255, 255, 255, 0.4);
    }

    .board-card {
        padding: 12px 14px !important;
    }

    .board-card-title {
        font-weight: 500;
        font-size: 0.9rem;
        margin-bottom: 6px;
    }

    .form-row {
        margin-bottom: 4px;
    }
</style>
