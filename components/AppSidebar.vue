<template>
    <v-navigation-drawer permanent :width="280" color="surface" class="knowspace-sidebar">
        <div class="sidebar-section quick">
            <v-btn
                block
                size="small"
                color="primary"
                variant="flat"
                prepend-icon="mdi-plus"
                @click="onCreatePage"
            >
                New page
            </v-btn>

            <v-text-field
                v-model="searchInput"
                placeholder="Search workspace"
                density="compact"
                variant="outlined"
                hide-details
                prepend-inner-icon="mdi-magnify"
                class="mt-3 search-field"
                @keydown.enter="onSearch"
            />
        </div>

        <v-list nav density="compact" class="sidebar-nav">
            <v-list-item
                v-for="entry in primaryNav"
                :key="entry.to"
                :to="entry.to"
                :prepend-icon="entry.icon"
                exact
            >
                <v-list-item-title>{{ entry.title }}</v-list-item-title>
                <template v-if="entry.count !== undefined" v-slot:append>
                    <span class="nav-count">{{ entry.count }}</span>
                </template>
            </v-list-item>
        </v-list>

        <div class="sidebar-section">
            <div class="sidebar-heading">Favorites</div>
            <div v-if="!favorites.length" class="sidebar-empty">No favorites yet</div>
            <NuxtLink
                v-for="fav in favorites"
                :key="fav.id"
                :to="`/pages/${fav.id}`"
                class="sidebar-link"
            >
                <span class="sidebar-emoji">{{ fav.emoji || '⭐' }}</span>
                <span class="sidebar-link-title">{{ fav.title }}</span>
            </NuxtLink>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-heading">Recent</div>
            <div v-if="!recent.length" class="sidebar-empty">No pages yet</div>
            <NuxtLink
                v-for="page in recent"
                :key="page.id"
                :to="`/pages/${page.id}`"
                class="sidebar-link"
            >
                <span class="sidebar-emoji">{{ page.emoji || '📄' }}</span>
                <span class="sidebar-link-title">{{ page.title }}</span>
            </NuxtLink>
        </div>
    </v-navigation-drawer>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref, watch } from 'vue';

    const route = useRoute();
    const router = useRouter();
    const knowspace = useKnowspace();

    const searchInput = ref('');

    onMounted(async () => {
        await knowspace.refreshNav();
    });

    watch(
        () => route.fullPath,
        async () => {
            await knowspace.refreshNav();
        }
    );

    const nav = knowspace.nav;
    const recent = computed(() => nav.value?.recentPages ?? []);
    const favorites = computed(() => nav.value?.favorites ?? []);

    const primaryNav = computed(() => [
        { title: 'Dashboard', to: '/', icon: 'mdi-view-dashboard-variant-outline' },
        {
            title: 'Pages',
            to: '/pages',
            icon: 'mdi-file-document-outline',
            count: nav.value?.counts.pages,
        },
        {
            title: 'Collections',
            to: '/collections',
            icon: 'mdi-table-large',
            count: nav.value?.counts.collections,
        },
        {
            title: 'Sources',
            to: '/sources',
            icon: 'mdi-source-branch',
            count: nav.value?.counts.sources,
        },
        {
            title: 'Entities',
            to: '/entities',
            icon: 'mdi-graph-outline',
            count: nav.value?.counts.entities,
        },
        { title: 'Search', to: '/search', icon: 'mdi-magnify' },
        { title: 'Assistant', to: '/assistant', icon: 'mdi-creation-outline' },
        {
            title: 'Import Center',
            to: '/import',
            icon: 'mdi-tray-arrow-down',
            count: nav.value?.counts.imports,
        },
    ]);

    async function onCreatePage() {
        const page = await knowspace.createPage({ title: 'Untitled' });
        router.push(`/pages/${page.id}?edit=1`);
    }

    function onSearch() {
        const q = searchInput.value.trim();
        if (!q) return;
        router.push({ path: '/search', query: { q } });
        searchInput.value = '';
    }
</script>

<style scoped>
    .knowspace-sidebar {
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        background-color: #0d0d0d !important;
    }

    .sidebar-section {
        padding: 12px 16px;
    }

    .sidebar-section.quick {
        padding-top: 16px;
        padding-bottom: 8px;
    }

    .sidebar-nav {
        padding: 4px 8px !important;
    }

    .sidebar-nav :deep(.v-list-item) {
        min-height: 36px;
        border-radius: 6px;
    }

    .sidebar-nav :deep(.v-list-item-title) {
        font-size: 0.875rem;
    }

    .nav-count {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        opacity: 0.55;
    }

    .sidebar-heading {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 6px;
    }

    .sidebar-empty {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.35);
        padding: 4px 2px;
    }

    .sidebar-link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.82);
        font-size: 0.85rem;
        text-decoration: none;
    }

    .sidebar-link:hover {
        background: rgba(255, 255, 255, 0.04);
        color: white;
    }

    .sidebar-link-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sidebar-emoji {
        flex-shrink: 0;
        width: 18px;
        text-align: center;
    }

    .search-field :deep(.v-field) {
        border-radius: 8px;
    }
</style>
