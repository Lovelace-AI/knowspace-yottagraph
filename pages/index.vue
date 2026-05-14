<template>
    <div class="d-flex flex-column fill-height dashboard">
        <div class="flex-shrink-0 dashboard-header">
            <div>
                <div class="dashboard-eyebrow">Workspace</div>
                <h1 class="dashboard-title">{{ greeting }}, {{ shortName || 'friend' }}</h1>
                <p class="dashboard-sub">
                    Knowspace turns exported workspaces and live Google Docs into a graph-backed
                    knowledge layer. Start by importing a Notion export or creating a new page.
                </p>
            </div>
            <div class="dashboard-actions">
                <v-btn color="primary" prepend-icon="mdi-plus" @click="onCreatePage">
                    New page
                </v-btn>
                <v-btn variant="tonal" prepend-icon="mdi-tray-arrow-down" to="/import">
                    Import Notion
                </v-btn>
            </div>
        </div>

        <div class="flex-grow-1 overflow-y-auto dashboard-body">
            <div class="dashboard-stats">
                <v-card
                    v-for="stat in stats"
                    :key="stat.label"
                    class="stat-card"
                    @click="$router.push(stat.to)"
                >
                    <div class="stat-label">{{ stat.label }}</div>
                    <div class="stat-value">{{ stat.value }}</div>
                    <div class="stat-hint">{{ stat.hint }}</div>
                </v-card>
            </div>

            <section class="dashboard-section">
                <div class="section-head">
                    <h2 class="section-title">Recent pages</h2>
                    <NuxtLink to="/pages" class="section-link">All pages →</NuxtLink>
                </div>
                <div v-if="!nav?.recentPages.length" class="empty-block">
                    <v-icon icon="mdi-file-document-outline" size="32" class="mb-2" />
                    <div class="empty-title">No pages yet</div>
                    <div class="empty-sub">
                        Create a page or import a Notion workspace to populate this space.
                    </div>
                </div>
                <div v-else class="page-grid">
                    <v-card
                        v-for="page in nav.recentPages"
                        :key="page.id"
                        :to="`/pages/${page.id}`"
                        class="page-card"
                    >
                        <div class="page-card-head">
                            <span class="page-emoji">{{ page.emoji || '📄' }}</span>
                            <span class="page-title">{{ page.title }}</span>
                        </div>
                        <div class="page-meta">Updated {{ formatTime(page.updatedAt) }}</div>
                    </v-card>
                </div>
            </section>

            <section class="dashboard-section">
                <div class="section-head">
                    <h2 class="section-title">Import activity</h2>
                    <NuxtLink to="/import" class="section-link">Import Center →</NuxtLink>
                </div>
                <div class="import-grid">
                    <div class="import-stat">
                        <div class="import-count">{{ nav?.importStatus.completed ?? 0 }}</div>
                        <div class="import-label">Completed imports</div>
                    </div>
                    <div class="import-stat">
                        <div class="import-count">{{ nav?.importStatus.active ?? 0 }}</div>
                        <div class="import-label">In progress</div>
                    </div>
                    <div class="import-stat">
                        <div class="import-count">{{ nav?.importStatus.failed ?? 0 }}</div>
                        <div class="import-label">Failed</div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted } from 'vue';

    const knowspace = useKnowspace();
    const router = useRouter();
    const { userName } = useUserState();

    const nav = knowspace.nav;

    onMounted(async () => {
        await knowspace.refreshNav();
    });

    const shortName = computed(() => (userName.value || '').split(' ')[0] || '');

    const greeting = computed(() => {
        const hour = new Date().getHours();
        if (hour < 5) return 'Good evening';
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    });

    const stats = computed(() => [
        {
            label: 'Pages',
            value: nav.value?.counts.pages ?? 0,
            hint: 'Documents in the workspace',
            to: '/pages',
        },
        {
            label: 'Collections',
            value: nav.value?.counts.collections ?? 0,
            hint: 'Structured databases',
            to: '/collections',
        },
        {
            label: 'Sources',
            value: nav.value?.counts.sources ?? 0,
            hint: 'Notion · Google · uploads',
            to: '/sources',
        },
        {
            label: 'Entities',
            value: nav.value?.counts.entities ?? 0,
            hint: 'People · orgs · concepts',
            to: '/entities',
        },
    ]);

    async function onCreatePage() {
        const page = await knowspace.createPage({ title: 'Untitled' });
        router.push(`/pages/${page.id}?edit=1`);
    }

    function formatTime(iso?: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        const minutes = Math.floor(diff / 60_000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString();
    }
</script>

<style scoped>
    .dashboard {
        background: var(--lv-background, #0a0a0a);
    }

    .dashboard-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        padding: 36px 40px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .dashboard-eyebrow {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--lv-green, #3fea00);
        margin-bottom: 8px;
    }

    .dashboard-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 2rem;
        margin-bottom: 8px;
    }

    .dashboard-sub {
        color: rgba(255, 255, 255, 0.6);
        max-width: 640px;
        line-height: 1.5;
    }

    .dashboard-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }

    .dashboard-body {
        padding: 32px 40px 48px;
    }

    .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 40px;
    }

    .stat-card {
        padding: 16px 20px !important;
        cursor: pointer;
        transition: border-color 0.15s ease;
    }

    .stat-card:hover {
        border-color: var(--lv-green, #3fea00) !important;
    }

    .stat-label {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.45);
        margin-bottom: 4px;
    }

    .stat-value {
        font-family: var(--font-headline);
        font-size: 1.85rem;
        font-weight: 400;
    }

    .stat-hint {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.45);
    }

    .dashboard-section {
        margin-bottom: 40px;
    }

    .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 14px;
    }

    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.1rem;
        letter-spacing: 0.04em;
    }

    .section-link {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        text-decoration: none;
    }

    .section-link:hover {
        color: var(--lv-green, #3fea00);
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

    .page-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
    }

    .page-card {
        padding: 14px 16px !important;
        cursor: pointer;
        transition: transform 0.15s ease;
    }

    .page-card:hover {
        transform: translateY(-1px);
    }

    .page-card-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .page-emoji {
        font-size: 1.05rem;
    }

    .page-title {
        font-size: 0.95rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .page-meta {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.45);
    }

    .import-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
    }

    .import-stat {
        padding: 18px 20px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.02);
    }

    .import-count {
        font-family: var(--font-headline);
        font-size: 1.6rem;
    }

    .import-label {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.55);
    }
</style>
