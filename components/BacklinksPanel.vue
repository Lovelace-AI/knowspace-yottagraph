<template>
    <section class="backlinks-panel">
        <div class="panel-label">Backlinks</div>
        <div v-if="loading" class="muted">Loading links…</div>
        <div v-else-if="links.length === 0" class="muted">No pages link here yet.</div>
        <NuxtLink
            v-else
            v-for="link in links"
            :key="link.id"
            :to="`/pages/${link.from_page_id}`"
            class="link-row"
        >
            <span class="emoji">{{ link.emoji || '📄' }}</span>
            <div class="meta">
                <div class="title">{{ link.title || 'Untitled' }}</div>
                <div class="source" v-if="link.source">via [[{{ link.source }}]]</div>
            </div>
        </NuxtLink>
    </section>
</template>

<script setup lang="ts">
    import { onMounted, ref, watch } from 'vue';

    interface BacklinkRow {
        id: string;
        from_page_id: string;
        title: string;
        emoji: string | null;
        updated_at: string;
        source: string | null;
    }

    const props = defineProps<{
        pageId: string;
    }>();

    const loading = ref(false);
    const links = ref<BacklinkRow[]>([]);

    async function loadBacklinks() {
        if (!props.pageId) {
            links.value = [];
            return;
        }
        loading.value = true;
        try {
            const res = await $fetch<{ backlinks: BacklinkRow[] }>(
                `/api/pages/${props.pageId}/backlinks`
            );
            links.value = res.backlinks || [];
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => props.pageId,
        () => void loadBacklinks()
    );

    onMounted(() => void loadBacklinks());
</script>

<style scoped>
    .panel-label {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin-bottom: 8px;
    }
    .muted {
        color: var(--lv-silver, #888);
        font-size: 0.84rem;
        line-height: 1.5;
    }
    .link-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.01);
    }
    .link-row:hover {
        border-color: rgba(63, 234, 0, 0.35);
    }
    .emoji {
        font-size: 1rem;
        flex-shrink: 0;
    }
    .meta {
        min-width: 0;
    }
    .title {
        font-size: 0.84rem;
        font-weight: 500;
    }
    .source {
        margin-top: 2px;
        font-size: 0.75rem;
        color: var(--lv-silver, #999);
    }
</style>
