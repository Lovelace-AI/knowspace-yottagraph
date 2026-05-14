<template>
    <div class="d-flex flex-column fill-height list-layout">
        <div class="flex-shrink-0 list-header">
            <div>
                <div class="eyebrow">Entities</div>
                <h1 class="title">Knowledge graph</h1>
                <p class="sub">
                    Entities are extracted from page content as a placeholder for YottaGraph
                    enrichment. Each entity links to the documents where it was mentioned.
                </p>
            </div>
        </div>
        <div class="flex-grow-1 overflow-y-auto list-body">
            <div class="filter-row">
                <v-text-field
                    v-model="filter"
                    placeholder="Filter entities…"
                    density="comfortable"
                    variant="outlined"
                    hide-details
                    prepend-inner-icon="mdi-filter-variant"
                    class="filter-input"
                />
                <v-btn-toggle v-model="typeFilter" multiple density="comfortable">
                    <v-btn v-for="t in availableTypes" :key="t" :value="t">{{ t }}</v-btn>
                </v-btn-toggle>
            </div>

            <div v-if="loading" class="centered"><v-progress-circular indeterminate /></div>
            <div v-else-if="!filtered.length" class="empty-block">
                <v-icon icon="mdi-graph-outline" size="32" class="mb-2" />
                <div class="empty-title">No entities yet</div>
                <div class="empty-sub">
                    Create pages with named people, products, or organizations to see them surface
                    here.
                </div>
            </div>
            <div v-else class="entity-grid">
                <NuxtLink
                    v-for="e in filtered"
                    :key="e.id"
                    :to="`/entities/${e.id}`"
                    class="entity-tile"
                >
                    <div class="tile-head">
                        <span class="tile-name">{{ e.canonicalName }}</span>
                        <span class="tile-type">{{ e.type }}</span>
                    </div>
                    <div class="tile-meta">
                        {{ e.mentions.length }}
                        {{ e.mentions.length === 1 ? 'mention' : 'mentions' }}
                        · {{ Math.round(e.confidence * 100) }}% confidence
                    </div>
                </NuxtLink>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';
    import type { EntityRecord } from '~/utils/knowspaceTypes';

    const knowspace = useKnowspace();
    const entities = ref<EntityRecord[]>([]);
    const loading = ref(true);
    const filter = ref('');
    const typeFilter = ref<string[]>([]);

    onMounted(async () => {
        loading.value = true;
        try {
            entities.value = await knowspace.listEntities();
        } finally {
            loading.value = false;
        }
    });

    const availableTypes = computed(() =>
        Array.from(new Set(entities.value.map((e) => e.type))).sort()
    );

    const filtered = computed(() => {
        const q = filter.value.trim().toLowerCase();
        return entities.value.filter((e) => {
            if (typeFilter.value.length && !typeFilter.value.includes(e.type)) return false;
            if (q && !e.canonicalName.toLowerCase().includes(q)) return false;
            return true;
        });
    });
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

    .filter-row {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .filter-input {
        max-width: 320px;
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

    .entity-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
    }

    .entity-tile {
        padding: 14px 16px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.015);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s ease;
    }

    .entity-tile:hover {
        border-color: var(--lv-green, #3fea00);
    }

    .tile-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
        gap: 8px;
    }

    .tile-name {
        font-weight: 500;
    }

    .tile-type {
        font-family: var(--font-mono);
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.4);
    }

    .tile-meta {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.55);
    }
</style>
