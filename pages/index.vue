<template>
    <div class="home-page">
        <div class="home-content">
            <header class="hero">
                <div class="eyebrow">Knowspace</div>
                <h1 class="hero-title">
                    Welcome back<span v-if="firstName">, {{ firstName }}</span
                    >.
                </h1>
                <p class="hero-subtitle">
                    A calm workspace for migrated Notion content, indexed Google Docs, and
                    graph-backed knowledge.
                </p>
            </header>

            <div v-if="!nav.dbConfigured.value" class="db-warning">
                <v-icon color="warning" size="20" class="mr-2">mdi-database-off</v-icon>
                Postgres is not configured in this environment. Create / read / save will only work
                on the deployed build (push to <code>main</code>).
            </div>

            <section class="card-row">
                <v-card class="action-card" @click="createNewPage">
                    <v-icon size="28" color="primary">mdi-plus-circle-outline</v-icon>
                    <div class="action-title">New page</div>
                    <div class="action-sub">Start a fresh document</div>
                </v-card>
                <v-card class="action-card" to="/import">
                    <v-icon size="28" color="primary">mdi-tray-arrow-down</v-icon>
                    <div class="action-title">Import Notion</div>
                    <div class="action-sub">Upload an export zip</div>
                </v-card>
                <v-card class="action-card" to="/sources">
                    <v-icon size="28" color="primary">mdi-google-drive</v-icon>
                    <div class="action-title">Connect Google Drive</div>
                    <div class="action-sub">Index Docs &amp; folders</div>
                </v-card>
                <v-card class="action-card" to="/search">
                    <v-icon size="28" color="primary">mdi-magnify</v-icon>
                    <div class="action-title">Ask &amp; search</div>
                    <div class="action-sub">Grounded answers</div>
                </v-card>
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

            <section class="block" v-if="favorites.length > 0">
                <header class="block-header">
                    <h2 class="block-title">Favorites</h2>
                </header>
                <div class="recent-grid">
                    <NuxtLink
                        v-for="p in favorites"
                        :key="p.id"
                        :to="`/pages/${p.id}`"
                        class="recent-item"
                    >
                        <span class="recent-emoji">{{ p.emoji || '⭐️' }}</span>
                        <div class="recent-meta">
                            <div class="recent-title">{{ p.title || 'Untitled' }}</div>
                            <div class="recent-time">{{ formatRelative(p.updated_at) }}</div>
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
    const favorites = ref<RecentPage[]>([]);
    const loadingRecent = ref(true);

    async function loadRecent() {
        loadingRecent.value = true;
        try {
            const [r, f] = await Promise.all([
                $fetch<{ pages: RecentPage[] }>('/api/pages/recent'),
                $fetch<{ pages: RecentPage[] }>('/api/pages/favorites'),
            ]);
            recent.value = r.pages || [];
            favorites.value = f.pages || [];
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

    .card-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 40px;
    }

    .action-card {
        padding: 18px 16px;
        cursor: pointer;
        background: var(--lv-surface, #141414) !important;
        transition:
            transform 120ms ease,
            border-color 120ms ease;
    }
    .action-card:hover {
        transform: translateY(-1px);
        border-color: rgba(63, 234, 0, 0.4) !important;
    }

    .action-title {
        font-weight: 500;
        margin-top: 10px;
        font-size: 0.95rem;
    }
    .action-sub {
        font-size: 0.8rem;
        color: var(--lv-silver, #888);
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
