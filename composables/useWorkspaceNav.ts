import { ref, computed, readonly } from 'vue';

export interface PageSummary {
    id: string;
    parent_page_id: string | null;
    title: string;
    emoji: string | null;
    is_favorite: boolean;
    position: number;
    updated_at: string;
    created_at: string;
    import_status: string;
}

export interface PageTreeNode extends PageSummary {
    children: PageTreeNode[];
}

const pages = ref<PageSummary[]>([]);
const loaded = ref(false);
const loading = ref(false);
const dbConfigured = ref(true);

function buildTree(flat: PageSummary[]): PageTreeNode[] {
    const byId = new Map<string, PageTreeNode>();
    for (const p of flat) byId.set(p.id, { ...p, children: [] });
    const roots: PageTreeNode[] = [];
    for (const node of byId.values()) {
        if (node.parent_page_id && byId.has(node.parent_page_id)) {
            byId.get(node.parent_page_id)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    const sortRec = (list: PageTreeNode[]) => {
        list.sort((a, b) => {
            if (a.position !== b.position) return a.position - b.position;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        for (const c of list) sortRec(c.children);
    };
    sortRec(roots);
    return roots;
}

/**
 * Workspace-wide page tree + favorites. Shared across all consumers via
 * module-level refs so the sidebar and home page stay in sync without
 * re-fetching.
 */
export function useWorkspaceNav() {
    async function refresh() {
        loading.value = true;
        try {
            const res = await $fetch<{ pages: PageSummary[]; dbConfigured: boolean }>('/api/pages');
            pages.value = res.pages || [];
            dbConfigured.value = res.dbConfigured !== false;
            loaded.value = true;
        } catch (err) {
            console.error('useWorkspaceNav refresh failed:', err);
            dbConfigured.value = false;
            loaded.value = true;
        } finally {
            loading.value = false;
        }
    }

    async function ensureLoaded() {
        if (!loaded.value && !loading.value) await refresh();
    }

    async function createPage(input: {
        title?: string;
        emoji?: string;
        parent_page_id?: string | null;
    }) {
        const created = await $fetch<{ id: string }>('/api/pages', {
            method: 'POST',
            body: input,
        });
        await refresh();
        return created;
    }

    async function deletePage(id: string) {
        await $fetch(`/api/pages/${id}`, { method: 'DELETE' });
        await refresh();
    }

    async function patchPage(id: string, patch: Record<string, unknown>) {
        const updated = await $fetch(`/api/pages/${id}`, { method: 'PATCH', body: patch });
        await refresh();
        return updated;
    }

    const tree = computed(() => buildTree(pages.value));
    const favorites = computed(() => pages.value.filter((p) => p.is_favorite));

    return {
        pages: readonly(pages),
        tree,
        favorites,
        loaded: readonly(loaded),
        loading: readonly(loading),
        dbConfigured: readonly(dbConfigured),
        refresh,
        ensureLoaded,
        createPage,
        deletePage,
        patchPage,
    };
}
