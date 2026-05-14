<template>
    <div class="d-flex flex-column fill-height pages-layout">
        <div class="flex-shrink-0 list-header">
            <div>
                <div class="eyebrow">Pages</div>
                <h1 class="title">All pages</h1>
                <p class="sub">
                    Pages are the core of the workspace. They can be nested, linked, and enriched
                    with entities.
                </p>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="onCreate">New page</v-btn>
        </div>

        <div class="flex-grow-1 overflow-y-auto list-body">
            <v-text-field
                v-model="filter"
                placeholder="Filter pages…"
                density="comfortable"
                variant="outlined"
                hide-details
                prepend-inner-icon="mdi-filter-variant"
                class="filter-input"
            />

            <div v-if="!pages.length" class="empty-block">
                <v-icon icon="mdi-file-document-outline" size="32" class="mb-2" />
                <div class="empty-title">No pages yet</div>
                <div class="empty-sub">
                    Create one with the button above, or
                    <NuxtLink to="/import">import a Notion export</NuxtLink>.
                </div>
            </div>

            <div v-else class="tree">
                <PageTreeNode v-for="node in tree" :key="node.id" :node="node" :level="0" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';
    import type { PageRecord } from '~/utils/knowspaceTypes';

    const knowspace = useKnowspace();
    const router = useRouter();
    const filter = ref('');

    onMounted(async () => {
        await knowspace.refreshPages();
    });

    const pages = knowspace.pages;

    interface TreeNode {
        id: string;
        title: string;
        emoji: string;
        children: TreeNode[];
        updatedAt: string;
    }

    const tree = computed<TreeNode[]>(() => {
        const filterLower = filter.value.trim().toLowerCase();
        const all: PageRecord[] = pages.value;
        const matching =
            filterLower.length === 0
                ? all
                : all.filter((p) => p.title.toLowerCase().includes(filterLower));
        const byId = new Map<string, TreeNode>();
        const include = new Set(matching.map((p) => p.id));

        // Walk parents up to root for filtered results so the hierarchy stays
        // visible when searching.
        for (const p of matching) {
            let cur: PageRecord | undefined = p;
            while (cur && cur.parentId) {
                const parent = all.find((x) => x.id === cur!.parentId);
                if (!parent) break;
                include.add(parent.id);
                cur = parent;
            }
        }

        const usable = filterLower ? all.filter((p) => include.has(p.id)) : all;

        for (const p of usable) {
            byId.set(p.id, {
                id: p.id,
                title: p.title,
                emoji: p.emoji,
                updatedAt: p.updatedAt,
                children: [],
            });
        }
        const roots: TreeNode[] = [];
        for (const p of usable) {
            const node = byId.get(p.id)!;
            if (p.parentId && byId.has(p.parentId)) {
                byId.get(p.parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        }
        const sortRec = (arr: TreeNode[]) => {
            arr.sort((a, b) => a.title.localeCompare(b.title));
            for (const n of arr) sortRec(n.children);
        };
        sortRec(roots);
        return roots;
    });

    async function onCreate() {
        const page = await knowspace.createPage({ title: 'Untitled' });
        router.push(`/pages/${page.id}?edit=1`);
    }
</script>

<style scoped>
    .pages-layout {
        background: var(--lv-background, #0a0a0a);
    }

    .list-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
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
        max-width: 540px;
    }

    .list-body {
        padding: 24px 40px 48px;
    }

    .filter-input {
        max-width: 420px;
        margin-bottom: 16px;
    }

    .tree {
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.015);
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
</style>
