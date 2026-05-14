<template>
    <div class="page">
        <div class="page-header">
            <div>
                <div class="eyebrow">Knowspace · Workspace</div>
                <h1 class="page-title">Collections</h1>
                <p class="page-sub">
                    Lightweight databases for tracking projects, customers, decisions, or anything
                    else. CSV files imported from Notion become collections automatically.
                </p>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
                New collection
            </v-btn>
        </div>

        <div v-if="loading" class="muted">Loading collections…</div>
        <div v-else-if="collections.length === 0" class="empty">
            <v-icon size="40" color="silver">mdi-table-large</v-icon>
            <div class="empty-title">No collections yet</div>
            <p class="empty-sub">
                Create one to organize structured records, or import a CSV from Notion to seed a
                collection automatically.
            </p>
            <v-btn color="primary" @click="openCreate">Create collection</v-btn>
        </div>
        <div v-else class="collection-grid">
            <NuxtLink
                v-for="c in collections"
                :key="c.id"
                :to="`/collections/${c.id}`"
                class="collection-card"
            >
                <div class="collection-name">{{ c.name }}</div>
                <div class="collection-desc" v-if="c.description">
                    {{ c.description }}
                </div>
                <div class="collection-meta">
                    <span>{{ c.record_count }} record{{ c.record_count === 1 ? '' : 's' }}</span>
                    <span>Updated {{ formatRelative(c.updated_at) }}</span>
                </div>
            </NuxtLink>
        </div>

        <v-dialog v-model="createDialog" max-width="480">
            <v-card>
                <v-card-title>New collection</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="newName"
                        label="Name"
                        autofocus
                        @keydown.enter.prevent="createCollection"
                    />
                    <v-textarea
                        v-model="newDescription"
                        label="Description (optional)"
                        rows="2"
                        auto-grow
                    />
                    <div class="muted-sm">
                        Default fields — Name, Status, Updated — are added. You can edit them later
                        from the collection detail view.
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="createDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="creating" @click="createCollection">
                        Create
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    interface CollectionListItem {
        id: string;
        name: string;
        description: string | null;
        record_count: number;
        updated_at: string;
    }

    const collections = ref<CollectionListItem[]>([]);
    const loading = ref(true);
    const createDialog = ref(false);
    const newName = ref('');
    const newDescription = ref('');
    const creating = ref(false);
    const router = useRouter();

    async function load() {
        loading.value = true;
        try {
            const res = await $fetch<{ collections: CollectionListItem[] }>('/api/collections');
            collections.value = res.collections || [];
        } finally {
            loading.value = false;
        }
    }

    function openCreate() {
        newName.value = '';
        newDescription.value = '';
        createDialog.value = true;
    }

    async function createCollection() {
        if (!newName.value.trim()) return;
        creating.value = true;
        try {
            const created = await $fetch<{ id: string }>('/api/collections', {
                method: 'POST',
                body: {
                    name: newName.value.trim(),
                    description: newDescription.value.trim() || null,
                },
            });
            createDialog.value = false;
            await router.push(`/collections/${created.id}`);
        } finally {
            creating.value = false;
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

    onMounted(load);
</script>

<style scoped>
    .page {
        padding: 40px 48px 80px;
        max-width: 1100px;
        margin: 0 auto;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
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
        max-width: 600px;
        margin: 0;
    }

    .muted {
        color: var(--lv-silver, #888);
    }
    .muted-sm {
        color: var(--lv-silver, #888);
        font-size: 0.8rem;
        margin-top: 4px;
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
        margin: 0 auto 16px;
    }

    .collection-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
    }
    .collection-card {
        display: block;
        padding: 16px;
        border-radius: 10px;
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        text-decoration: none;
        color: inherit;
        transition:
            border-color 100ms ease,
            transform 100ms ease;
    }
    .collection-card:hover {
        border-color: rgba(63, 234, 0, 0.4);
        transform: translateY(-1px);
    }
    .collection-name {
        font-weight: 500;
        font-size: 1.02rem;
        margin-bottom: 6px;
    }
    .collection-desc {
        font-size: 0.85rem;
        color: var(--lv-silver, #aaa);
        margin-bottom: 10px;
        line-height: 1.4;
    }
    .collection-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--lv-silver, #888);
        font-family: var(--font-mono, monospace);
    }
</style>
