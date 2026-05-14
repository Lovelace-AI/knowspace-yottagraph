// Client API wrapper for Knowspace workspace data. Centralizes server-route
// calls and shared reactive state for the sidebar/page tree.

import { computed, ref } from 'vue';
import type {
    AskAnswer,
    CollectionDef,
    CollectionRecord,
    EntityRecord,
    ImportBatch,
    PageRecord,
    SearchResult,
    SourceRecord,
} from '~/utils/knowspaceTypes';

interface NavSummary {
    counts: {
        pages: number;
        collections: number;
        sources: number;
        entities: number;
        imports: number;
    };
    recentPages: Array<{
        id: string;
        title: string;
        emoji: string;
        updatedAt: string;
        parentId: string | null;
    }>;
    favorites: Array<{ id: string; title: string; emoji: string }>;
    importStatus: { active: number; failed: number; completed: number };
}

const _pages = ref<PageRecord[]>([]);
const _pagesLoaded = ref(false);
const _nav = ref<NavSummary | null>(null);

async function fetchJson<T>(url: string, init?: any): Promise<T> {
    return (await $fetch(url, init)) as T;
}

export function useKnowspace() {
    async function refreshPages() {
        _pages.value = await fetchJson<PageRecord[]>('/api/workspace/pages/list');
        _pagesLoaded.value = true;
    }

    async function refreshNav() {
        _nav.value = await fetchJson<NavSummary>('/api/workspace/navigation');
    }

    async function ensureLoaded() {
        if (!_pagesLoaded.value) await refreshPages();
        if (!_nav.value) await refreshNav();
    }

    async function getPage(id: string) {
        return await fetchJson<PageRecord>(`/api/workspace/pages/${id}`);
    }

    async function createPage(input: Partial<PageRecord>) {
        const page = await fetchJson<PageRecord>('/api/workspace/pages/create', {
            method: 'POST',
            body: input,
        });
        await Promise.all([refreshPages(), refreshNav()]);
        return page;
    }

    async function updatePage(id: string, patch: Partial<PageRecord>) {
        const page = await fetchJson<PageRecord>(`/api/workspace/pages/${id}`, {
            method: 'PATCH',
            body: patch,
        });
        await Promise.all([refreshPages(), refreshNav()]);
        return page;
    }

    async function deletePage(id: string) {
        await fetchJson<{ ok: true }>(`/api/workspace/pages/${id}`, { method: 'DELETE' });
        await Promise.all([refreshPages(), refreshNav()]);
    }

    async function listCollections() {
        return await fetchJson<CollectionDef[]>('/api/workspace/collections/list');
    }

    async function getCollection(id: string) {
        return await fetchJson<{ collection: CollectionDef; records: CollectionRecord[] }>(
            `/api/workspace/collections/${id}`
        );
    }

    async function createCollection(input: Partial<CollectionDef>) {
        return await fetchJson<CollectionDef>('/api/workspace/collections/create', {
            method: 'POST',
            body: input,
        });
    }

    async function updateCollection(id: string, patch: Partial<CollectionDef>) {
        return await fetchJson<CollectionDef>(`/api/workspace/collections/${id}`, {
            method: 'PATCH',
            body: patch,
        });
    }

    async function deleteCollection(id: string) {
        return await fetchJson<{ ok: true }>(`/api/workspace/collections/${id}`, {
            method: 'DELETE',
        });
    }

    async function createRecord(collectionId: string, properties: Record<string, unknown>) {
        return await fetchJson<CollectionRecord>(
            `/api/workspace/collections/${collectionId}/records`,
            { method: 'POST', body: { properties } }
        );
    }

    async function updateRecord(
        collectionId: string,
        recordId: string,
        properties: Record<string, unknown>
    ) {
        return await fetchJson<CollectionRecord>(
            `/api/workspace/collections/${collectionId}/records/${recordId}`,
            { method: 'PATCH', body: { properties } }
        );
    }

    async function deleteRecord(collectionId: string, recordId: string) {
        return await fetchJson<{ ok: true }>(
            `/api/workspace/collections/${collectionId}/records/${recordId}`,
            { method: 'DELETE' }
        );
    }

    async function listSources() {
        return await fetchJson<SourceRecord[]>('/api/workspace/sources/list');
    }

    async function createSource(input: Partial<SourceRecord>) {
        return await fetchJson<SourceRecord>('/api/workspace/sources/create', {
            method: 'POST',
            body: input,
        });
    }

    async function updateSource(id: string, patch: Partial<SourceRecord>) {
        return await fetchJson<SourceRecord>(`/api/workspace/sources/${id}`, {
            method: 'PATCH',
            body: patch,
        });
    }

    async function deleteSource(id: string) {
        return await fetchJson<{ ok: true }>(`/api/workspace/sources/${id}`, { method: 'DELETE' });
    }

    async function listEntities() {
        return await fetchJson<EntityRecord[]>('/api/workspace/entities/list');
    }

    async function getEntity(id: string) {
        return await fetchJson<{
            entity: EntityRecord;
            mentionedPages: PageRecord[];
            relatedEntities: EntityRecord[];
        }>(`/api/workspace/entities/${id}`);
    }

    async function listImports() {
        return await fetchJson<ImportBatch[]>('/api/workspace/imports/list');
    }

    async function uploadNotionExport(file: File) {
        return await fetchJson<{ batch: ImportBatch; source: SourceRecord }>(
            '/api/workspace/imports/notion-upload',
            {
                method: 'POST',
                body: { fileName: file.name, fileSize: file.size },
            }
        );
    }

    async function search(query: string, opts?: { types?: SearchResult['type'][] }) {
        return await fetchJson<{ results: SearchResult[] }>('/api/workspace/search', {
            method: 'POST',
            body: { query, types: opts?.types },
        });
    }

    async function ask(question: string) {
        return await fetchJson<AskAnswer>('/api/workspace/ask', {
            method: 'POST',
            body: { question },
        });
    }

    return {
        pages: computed(() => _pages.value),
        pagesLoaded: computed(() => _pagesLoaded.value),
        nav: computed(() => _nav.value),
        ensureLoaded,
        refreshPages,
        refreshNav,
        getPage,
        createPage,
        updatePage,
        deletePage,
        listCollections,
        getCollection,
        createCollection,
        updateCollection,
        deleteCollection,
        createRecord,
        updateRecord,
        deleteRecord,
        listSources,
        createSource,
        updateSource,
        deleteSource,
        listEntities,
        getEntity,
        listImports,
        uploadNotionExport,
        search,
        ask,
    };
}
