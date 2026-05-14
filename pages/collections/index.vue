<template>
    <div class="d-flex flex-column fill-height list-layout">
        <div class="flex-shrink-0 list-header">
            <div>
                <div class="eyebrow">Collections</div>
                <h1 class="title">Lightweight databases</h1>
                <p class="sub">
                    Collections turn structured CSV imports or hand-built tables into queryable
                    records. Each record is also a page.
                </p>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="newDialog = true">
                New collection
            </v-btn>
        </div>

        <div class="flex-grow-1 overflow-y-auto list-body">
            <div v-if="loading" class="centered">
                <v-progress-circular indeterminate />
            </div>
            <div v-else-if="!collections.length" class="empty-block">
                <v-icon icon="mdi-table-large" size="32" class="mb-2" />
                <div class="empty-title">No collections yet</div>
                <div class="empty-sub">
                    Create one above, or import a Notion workspace — CSV files become collections.
                </div>
            </div>
            <div v-else class="card-grid">
                <v-card
                    v-for="c in collections"
                    :key="c.id"
                    :to="`/collections/${c.id}`"
                    class="collection-card"
                >
                    <div class="card-head">
                        <span class="card-emoji">{{ c.icon }}</span>
                        <span class="card-title">{{ c.name }}</span>
                    </div>
                    <div class="card-sub">{{ c.description || 'No description' }}</div>
                    <div class="card-fields">
                        <v-chip v-for="f in c.fields.slice(0, 4)" :key="f.id">
                            {{ f.name }}
                        </v-chip>
                    </div>
                </v-card>
            </div>
        </div>

        <v-dialog v-model="newDialog" max-width="480">
            <v-card>
                <v-card-title>New collection</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="draftName"
                        label="Name"
                        placeholder="e.g. Customer notes"
                    />
                    <v-text-field v-model="draftIcon" label="Icon emoji" />
                    <v-textarea v-model="draftDescription" label="Description" rows="2" />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="newDialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" @click="createCollection">Create</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';
    import type { CollectionDef } from '~/utils/knowspaceTypes';

    const knowspace = useKnowspace();
    const router = useRouter();

    const collections = ref<CollectionDef[]>([]);
    const loading = ref(true);
    const newDialog = ref(false);
    const draftName = ref('');
    const draftIcon = ref('🗂️');
    const draftDescription = ref('');

    async function load() {
        loading.value = true;
        try {
            collections.value = await knowspace.listCollections();
        } finally {
            loading.value = false;
        }
    }

    onMounted(load);

    async function createCollection() {
        const c = await knowspace.createCollection({
            name: draftName.value || 'Untitled collection',
            description: draftDescription.value,
            icon: draftIcon.value || '🗂️',
        });
        newDialog.value = false;
        draftName.value = '';
        draftDescription.value = '';
        draftIcon.value = '🗂️';
        router.push(`/collections/${c.id}`);
    }
</script>

<style scoped>
    .list-layout {
        background: var(--lv-background, #0a0a0a);
    }

    .list-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
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
        max-width: 540px;
    }

    .list-body {
        padding: 24px 40px 48px;
    }

    .centered {
        display: flex;
        justify-content: center;
        padding: 40px;
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

    .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
    }

    .collection-card {
        padding: 16px 18px !important;
        cursor: pointer;
    }

    .card-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
    }

    .card-emoji {
        font-size: 1.1rem;
    }

    .card-title {
        font-weight: 500;
    }

    .card-sub {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.85rem;
        margin-bottom: 10px;
    }

    .card-fields {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }
</style>
