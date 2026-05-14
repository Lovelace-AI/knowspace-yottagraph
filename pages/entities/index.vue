<template>
    <div class="page">
        <header class="page-header">
            <div>
                <div class="eyebrow">Knowspace · Graph</div>
                <h1 class="page-title">Entities</h1>
                <p class="page-sub">
                    Canonical people, organizations, products, projects, and concepts extracted from
                    your workspace. The graph layer is the differentiator — it organizes the meaning
                    inside your documents, not just the documents themselves.
                </p>
            </div>
        </header>

        <div class="filter-row">
            <v-text-field
                v-model="filter"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Filter by name"
                bg-color="surface-variant"
                style="max-width: 320px"
            />
            <v-select
                v-model="typeFilter"
                :items="typeOptions"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                label="Type"
                style="max-width: 200px"
            />
        </div>

        <div v-if="loading" class="muted">Loading entities…</div>
        <div v-else-if="filtered.length === 0" class="empty">
            <v-icon size="40" color="silver">mdi-graph-outline</v-icon>
            <div class="empty-title">No entities yet</div>
            <p class="empty-sub">
                Phase 5 wires up the entity extraction pipeline. Once imported pages or Google Docs
                are enriched, canonical entities (People, Organizations, Products, Projects,
                Concepts…) appear here with mention timelines and related entities.
            </p>
        </div>

        <div v-else class="entity-grid">
            <NuxtLink
                v-for="e in filtered"
                :key="e.id"
                :to="`/entities/${e.id}`"
                class="entity-card"
            >
                <div class="entity-type">{{ e.entity_type || 'Entity' }}</div>
                <div class="entity-name">{{ e.canonical_name }}</div>
                <div class="entity-summary" v-if="e.summary">{{ e.summary }}</div>
                <div class="entity-meta">
                    <span>{{ e.mention_count }} mention{{ e.mention_count === 1 ? '' : 's' }}</span>
                    <span v-if="e.confidence"> Conf. {{ (e.confidence * 100).toFixed(0) }}% </span>
                </div>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';

    interface EntityRow {
        id: string;
        canonical_name: string;
        entity_type: string | null;
        summary: string | null;
        confidence: number | null;
        mention_count: number;
        updated_at: string;
    }

    const entities = ref<EntityRow[]>([]);
    const loading = ref(true);
    const filter = ref('');
    const typeFilter = ref<string>('all');

    const typeOptions = computed(() => {
        const set = new Set<string>();
        for (const e of entities.value) if (e.entity_type) set.add(e.entity_type);
        return ['all', ...Array.from(set).sort()];
    });

    const filtered = computed(() => {
        const f = filter.value.trim().toLowerCase();
        return entities.value.filter((e) => {
            if (f && !e.canonical_name.toLowerCase().includes(f)) return false;
            if (typeFilter.value !== 'all' && e.entity_type !== typeFilter.value) return false;
            return true;
        });
    });

    async function load() {
        loading.value = true;
        try {
            const res = await $fetch<{ entities: EntityRow[] }>('/api/entities');
            entities.value = res.entities || [];
        } finally {
            loading.value = false;
        }
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
        max-width: 660px;
        margin: 0;
    }

    .filter-row {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .muted {
        color: var(--lv-silver, #888);
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
        max-width: 560px;
        margin: 0 auto;
        line-height: 1.5;
    }

    .entity-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
    }
    .entity-card {
        display: block;
        padding: 16px;
        border-radius: 10px;
        background: var(--lv-surface, #141414);
        border: 1px solid rgba(255, 255, 255, 0.06);
        text-decoration: none;
        color: inherit;
        transition: border-color 100ms ease;
    }
    .entity-card:hover {
        border-color: rgba(63, 234, 0, 0.4);
    }
    .entity-type {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin-bottom: 6px;
    }
    .entity-name {
        font-family: var(--font-headline, serif);
        font-weight: 400;
        font-size: 1.15rem;
        margin-bottom: 6px;
    }
    .entity-summary {
        font-size: 0.85rem;
        color: var(--lv-silver, #bbb);
        margin-bottom: 12px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .entity-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.74rem;
        color: var(--lv-silver, #888);
        font-family: var(--font-mono, monospace);
    }
</style>
