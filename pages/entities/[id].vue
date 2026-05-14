<template>
    <div class="d-flex flex-column fill-height">
        <div v-if="loading" class="centered">
            <v-progress-circular indeterminate />
        </div>
        <template v-else-if="data">
            <div class="flex-shrink-0 header">
                <NuxtLink to="/entities" class="back-link">
                    <v-icon size="14">mdi-arrow-left</v-icon> Entities
                </NuxtLink>
                <div class="title-row">
                    <h1 class="title">{{ data.entity.canonicalName }}</h1>
                    <v-chip>{{ data.entity.type }}</v-chip>
                </div>
                <div class="meta">
                    {{ data.entity.mentions.length }} mentions ·
                    {{ Math.round(data.entity.confidence * 100) }}% confidence
                </div>
            </div>

            <div class="flex-grow-1 overflow-y-auto body">
                <section v-if="data.entity.summary" class="block">
                    <h2 class="section-title">Summary</h2>
                    <p>{{ data.entity.summary }}</p>
                </section>

                <section v-if="data.entity.aliases.length" class="block">
                    <h2 class="section-title">Aliases</h2>
                    <v-chip v-for="a in data.entity.aliases" :key="a" class="me-2 mb-2">
                        {{ a }}
                    </v-chip>
                </section>

                <section class="block">
                    <h2 class="section-title">Mentioned in</h2>
                    <div v-if="!data.mentionedPages.length" class="empty">No linked pages.</div>
                    <div v-else class="page-list">
                        <NuxtLink
                            v-for="p in data.mentionedPages"
                            :key="p.id"
                            :to="`/pages/${p.id}`"
                            class="page-row"
                        >
                            <span class="page-emoji">{{ p.emoji || '📄' }}</span>
                            <span class="page-title">{{ p.title }}</span>
                            <span class="page-updated">{{ formatDate(p.updatedAt) }}</span>
                        </NuxtLink>
                    </div>
                </section>

                <section class="block">
                    <h2 class="section-title">Source snippets</h2>
                    <div v-if="!data.entity.mentions.length" class="empty">
                        No snippets captured.
                    </div>
                    <div v-else class="snippets">
                        <div v-for="(m, idx) in data.entity.mentions" :key="idx" class="snippet">
                            <div class="snippet-text">{{ m.snippet }}</div>
                            <div class="snippet-meta">
                                from
                                <NuxtLink :to="`/pages/${m.pageId}`">{{
                                    pageTitle(m.pageId)
                                }}</NuxtLink>
                                · {{ Math.round(m.confidence * 100) }}% confidence
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref, watch } from 'vue';
    import type { EntityRecord, PageRecord } from '~/utils/knowspaceTypes';

    const route = useRoute();
    const knowspace = useKnowspace();

    const data = ref<{
        entity: EntityRecord;
        mentionedPages: PageRecord[];
        relatedEntities: EntityRecord[];
    } | null>(null);
    const loading = ref(true);

    async function load() {
        const id = route.params.id as string;
        loading.value = true;
        try {
            data.value = await knowspace.getEntity(id);
        } finally {
            loading.value = false;
        }
    }
    onMounted(load);
    watch(
        () => route.params.id,
        () => load()
    );

    const pageMap = computed(
        () => new Map((data.value?.mentionedPages ?? []).map((p) => [p.id, p.title] as const))
    );

    function pageTitle(id: string): string {
        return pageMap.value.get(id) ?? id;
    }

    function formatDate(iso?: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString();
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
        padding: 32px 40px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .back-link {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.8rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 14px;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 2rem;
    }

    .meta {
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.85rem;
    }

    .body {
        padding: 24px 40px 48px;
    }

    .block {
        margin-bottom: 32px;
    }

    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 12px;
    }

    .empty {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.9rem;
    }

    .page-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .page-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        text-decoration: none;
        color: rgba(255, 255, 255, 0.85);
    }

    .page-row:hover {
        background: rgba(255, 255, 255, 0.04);
    }

    .page-emoji {
        width: 22px;
        text-align: center;
    }

    .page-title {
        flex: 1;
    }

    .page-updated {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
    }

    .snippets {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .snippet {
        padding: 12px 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.015);
    }

    .snippet-text {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.82);
        line-height: 1.5;
    }

    .snippet-meta {
        margin-top: 6px;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.45);
    }

    .snippet-meta a {
        color: var(--lv-green, #3fea00);
        text-decoration: none;
    }

    .snippet-meta a:hover {
        text-decoration: underline;
    }
</style>
