<template>
    <div class="home-page">
        <div class="home-content">
            <header class="hero">
                <div class="eyebrow">Knowspace</div>
                <h1 class="hero-title">
                    Welcome back<span v-if="firstName">, {{ firstName }}</span
                    >.
                </h1>
                <p class="hero-subtitle">Markdown docs with tags and links. Keep it calm.</p>
            </header>

            <div v-if="!nav.dbConfigured.value" class="db-warning">
                <v-icon color="warning" size="20" class="mr-2">mdi-database-off</v-icon>
                Postgres is not configured in this environment. Create / read / save will only work
                on the deployed build (push to <code>main</code>).
            </div>

            <section class="quick-row">
                <v-btn color="primary" prepend-icon="mdi-plus" @click="createNewPage"
                    >New doc</v-btn
                >
                <div class="tag-pins" v-if="topTags.length > 0">
                    <NuxtLink
                        v-for="tag in topTags"
                        :key="tag.tag"
                        :to="`/t/${encodeURIComponent(tag.tag)}`"
                        class="tag-pin"
                    >
                        #{{ tag.tag }}
                    </NuxtLink>
                </div>
            </section>

            <section class="block">
                <header class="block-header">
                    <h2 class="block-title">Recent</h2>
                    <span class="block-meta" v-if="recent.length > 0">
                        Last {{ recent.length }} edited
                    </span>
                </header>
                <div v-if="loadingRecent" class="muted">Loading…</div>
                <div v-else-if="recent.length === 0" class="muted">
                    No pages yet — create one to get started.
                </div>
                <div v-else class="recent-grid">
                    <NuxtLink
                        v-for="p in recent"
                        :key="p.id"
                        :to="`/pages/${p.id}`"
                        class="recent-item"
                    >
                        <span class="recent-emoji">{{ p.emoji || '📄' }}</span>
                        <div class="recent-meta">
                            <div class="recent-title">{{ p.title || 'Untitled' }}</div>
                            <div class="recent-time">
                                {{ formatRelative(p.updated_at) }}
                            </div>
                        </div>
                    </NuxtLink>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';

    import { useWorkspaceNav } from '~/composables/useWorkspaceNav';

    interface RecentPage {
        id: string;
        title: string;
        emoji: string | null;
        updated_at: string;
        is_favorite?: boolean;
    }

    const nav = useWorkspaceNav();
    const router = useRouter();
    const { userName } = useUserState();

    const firstName = computed(() => (userName.value || '').split(' ')[0] || '');

    const recent = ref<RecentPage[]>([]);
    const topTags = ref<Array<{ tag: string; usage_count: number }>>([]);
    const loadingRecent = ref(true);

    async function loadRecent() {
        loadingRecent.value = true;
        try {
            const [r, f] = await Promise.all([
                $fetch<{ pages: RecentPage[] }>('/api/pages/recent'),
                $fetch<{ tags: Array<{ tag: string; usage_count: number }> }>('/api/tags?limit=8'),
            ]);
            recent.value = r.pages || [];
            topTags.value = (f.tags || []).slice(0, 8);
        } catch (err) {
            console.error('Home load failed:', err);
        } finally {
            loadingRecent.value = false;
        }
    }

    async function createNewPage() {
        const created = await nav.createPage({ title: 'Untitled' });
        await router.push(`/pages/${created.id}`);
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

    onMounted(loadRecent);
</script>

<style scoped>
    .home-page {
        height: 100%;
        overflow-y: auto;
        padding: 56px 32px 80px;
        display: flex;
        justify-content: center;
    }

    .home-content {
        width: 100%;
        max-width: 880px;
    }

    .hero {
        margin-bottom: 32px;
    }

    .eyebrow {
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
        margin-bottom: 8px;
    }

    .hero-title {
        font-family: var(--font-headline, serif);
        font-weight: 400;
        font-size: 2.2rem;
        letter-spacing: 0.01em;
        margin: 0 0 8px;
    }

    .hero-subtitle {
        color: var(--lv-silver, #aaa);
        font-size: 1rem;
        max-width: 560px;
        margin: 0;
    }

    .db-warning {
        display: flex;
        align-items: center;
        background: rgba(255, 92, 0, 0.08);
        border: 1px solid rgba(255, 92, 0, 0.25);
        color: #ffb98b;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.88rem;
        margin-bottom: 24px;
    }
    .db-warning code {
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 0.85em;
    }

    .quick-row {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 34px;
        flex-wrap: wrap;
    }
    .tag-pins {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .tag-pin {
        text-decoration: none;
        color: inherit;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.8rem;
    }
    .tag-pin:hover {
        border-color: rgba(63, 234, 0, 0.4);
    }

    .block {
        margin-bottom: 40px;
    }
    .block-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
    }
    .block-title {
        font-family: var(--font-headline, serif);
        font-weight: 400;
        font-size: 1.1rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--lv-silver, #aaa);
        margin: 0;
    }
    .block-meta {
        font-size: 0.75rem;
        color: var(--lv-silver, #777);
    }

    .recent-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 8px;
    }

    .recent-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        border: 1px solid rgba(255, 255, 255, 0.05);
        background: var(--lv-surface, #141414);
        transition:
            border-color 100ms ease,
            transform 100ms ease;
    }
    .recent-item:hover {
        border-color: rgba(63, 234, 0, 0.35);
    }
    .recent-emoji {
        font-size: 1.4rem;
    }
    .recent-meta {
        flex: 1 1 auto;
        min-width: 0;
    }
    .recent-title {
        font-weight: 500;
        font-size: 0.92rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .recent-time {
        font-size: 0.74rem;
        color: var(--lv-silver, #888);
        font-family: var(--font-mono, monospace);
    }

    .muted {
        color: var(--lv-silver, #777);
        font-size: 0.9rem;
        padding: 8px 2px;
    }
</style>
