<template>
    <div class="page">
        <div class="eyebrow">Knowspace · Tags</div>
        <h1 class="title">Collections moved to tags</h1>
        <p class="sub">Structured content now lives on tag pages. Browse tags below.</p>

        <div v-if="loading" class="muted">Loading…</div>
        <div v-else class="tag-list">
            <NuxtLink v-for="c in collections" :key="c.id" :to="c.tag_url" class="tag-row">
                <span class="tag-name">#{{ c.tag }}</span>
                <span class="tag-meta">{{ c.record_count }} docs</span>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';
    interface LegacyCollection {
        id: string;
        tag: string;
        tag_url: string;
        record_count: number;
    }
    const collections = ref<LegacyCollection[]>([]);
    const loading = ref(true);

    async function load() {
        loading.value = true;
        try {
            const res = await $fetch<{ collections: LegacyCollection[] }>('/api/collections');
            collections.value = res.collections || [];
        } finally {
            loading.value = false;
        }
    }

    onMounted(load);
</script>

<style scoped>
    .page {
        padding: 40px 48px 80px;
        max-width: 920px;
        margin: 0 auto;
    }
    .eyebrow {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--lv-silver, #888);
    }
    .title {
        margin: 4px 0;
        font-size: 1.8rem;
        font-family: var(--font-headline, serif);
        font-weight: 400;
    }
    .sub {
        margin: 0 0 16px;
        color: var(--lv-silver, #999);
    }
    .tag-list {
        display: grid;
        gap: 8px;
    }
    .tag-row {
        display: flex;
        justify-content: space-between;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 10px 12px;
        text-decoration: none;
        color: inherit;
    }
    .tag-row:hover {
        border-color: rgba(63, 234, 0, 0.35);
    }
    .tag-name {
        font-weight: 500;
    }
    .tag-meta {
        color: var(--lv-silver, #888);
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
    }
    .muted {
        color: var(--lv-silver, #888);
    }
</style>
