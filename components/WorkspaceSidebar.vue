<template>
    <v-navigation-drawer permanent app width="280" class="workspace-sidebar" color="surface">
        <div class="px-3 pt-3 pb-2">
            <v-text-field
                v-model="searchInput"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search…"
                bg-color="surface-variant"
                @keydown.enter="runSearch"
            />
        </div>

        <v-list density="compact" nav class="py-0">
            <v-list-item title="Home" prepend-icon="mdi-home-outline" to="/" exact rounded="lg" />
            <v-list-item title="Search" prepend-icon="mdi-magnify" to="/search" rounded="lg" />
        </v-list>

        <v-list density="compact" nav class="pt-0">
            <div class="section-header">
                <span>Favorites</span>
            </div>
            <template v-if="nav.favorites.value.length === 0">
                <v-list-item
                    class="empty-hint"
                    density="compact"
                    title="Star a page to pin it here"
                />
            </template>
            <template v-else>
                <v-list-item
                    v-for="fav in nav.favorites.value"
                    :key="fav.id"
                    :title="fav.title || 'Untitled'"
                    :to="`/pages/${fav.id}`"
                    rounded="lg"
                    density="compact"
                >
                    <template #prepend>
                        <span class="page-emoji">{{ fav.emoji || 'star' }}</span>
                    </template>
                </v-list-item>
            </template>
        </v-list>

        <v-list density="compact" nav class="pt-0">
            <div class="section-header">
                <span>Pages</span>
                <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    color="silver"
                    @click="createTopLevelPage"
                >
                    <v-icon size="small">mdi-plus</v-icon>
                </v-btn>
            </div>

            <template v-if="!nav.dbConfigured.value">
                <v-list-item
                    density="compact"
                    class="empty-hint"
                    title="Database not configured"
                    subtitle="Push to main to enable Postgres"
                />
            </template>
            <template v-else-if="nav.tree.value.length === 0 && nav.loaded.value">
                <v-list-item
                    density="compact"
                    class="empty-hint"
                    title="No pages yet — click + to create one"
                />
            </template>
            <template v-else>
                <PageTreeNode
                    v-for="node in nav.tree.value"
                    :key="node.id"
                    :node="node"
                    :depth="0"
                    @create-child="createChildPage"
                />
            </template>
        </v-list>

        <v-list density="compact" nav class="pt-0">
            <div class="section-header"><span>Workspace</span></div>
            <v-list-item
                title="Collections"
                prepend-icon="mdi-table-large"
                to="/collections"
                rounded="lg"
            />
            <v-list-item
                title="Sources"
                prepend-icon="mdi-database-import-outline"
                to="/sources"
                rounded="lg"
            />
            <v-list-item
                title="Entities"
                prepend-icon="mdi-graph-outline"
                to="/entities"
                rounded="lg"
            />
            <v-list-item
                title="Import Center"
                prepend-icon="mdi-tray-arrow-down"
                to="/import"
                rounded="lg"
            />
        </v-list>
    </v-navigation-drawer>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    import PageTreeNode from '~/components/PageTreeNode.vue';
    import { useWorkspaceNav } from '~/composables/useWorkspaceNav';

    const nav = useWorkspaceNav();
    const router = useRouter();
    const searchInput = ref('');

    onMounted(() => {
        void nav.ensureLoaded();
    });

    async function createTopLevelPage() {
        const created = await nav.createPage({ title: 'Untitled' });
        await router.push(`/pages/${created.id}`);
    }

    async function createChildPage(parentId: string) {
        const created = await nav.createPage({
            title: 'Untitled',
            parent_page_id: parentId,
        });
        await router.push(`/pages/${created.id}`);
    }

    function runSearch() {
        if (!searchInput.value.trim()) return;
        router.push({ path: '/search', query: { q: searchInput.value.trim() } });
    }
</script>

<style scoped>
    .workspace-sidebar {
        border-right: 1px solid rgba(255, 255, 255, 0.06);
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 12px 6px;
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--lv-silver, #888);
    }

    .empty-hint :deep(.v-list-item-title) {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.8rem;
        font-style: italic;
    }
    .empty-hint :deep(.v-list-item-subtitle) {
        color: rgba(255, 255, 255, 0.3);
        font-size: 0.72rem;
    }

    .page-emoji {
        display: inline-block;
        width: 20px;
        text-align: center;
        font-size: 0.95rem;
        margin-right: 8px;
    }
</style>
