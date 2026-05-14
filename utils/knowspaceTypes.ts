// Shared types for the Knowspace workspace. Mirrors the Postgres schema in
// DESIGN.md so a future migration to relational storage stays straightforward.

export type ImportStatus = 'manual' | 'imported' | 'review' | 'failed';

export interface PageRecord {
    id: string;
    title: string;
    slug: string;
    emoji: string;
    parentId: string | null;
    contentMarkdown: string;
    tags: string[];
    sourceId: string | null;
    sourceObjectId: string | null;
    importStatus: ImportStatus;
    importPath?: string | null;
    favorite: boolean;
    createdAt: string;
    updatedAt: string;
}

export type CollectionFieldType =
    | 'text'
    | 'select'
    | 'multi_select'
    | 'date'
    | 'person'
    | 'url'
    | 'checkbox'
    | 'number';

export interface CollectionField {
    id: string;
    name: string;
    type: CollectionFieldType;
    options?: string[];
}

export interface CollectionRecord {
    id: string;
    workspaceId: string;
    collectionId: string;
    properties: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface CollectionDef {
    id: string;
    name: string;
    description: string;
    icon: string;
    fields: CollectionField[];
    sourceId: string | null;
    createdAt: string;
    updatedAt: string;
}

export type SourceType = 'notion_export' | 'google_drive' | 'google_doc' | 'manual' | 'upload';

export interface SourceRecord {
    id: string;
    sourceType: SourceType;
    displayName: string;
    status: 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending';
    config: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface ImportBatch {
    id: string;
    sourceId: string;
    fileName: string;
    fileSize: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    startedAt: string;
    completedAt: string | null;
    stats: {
        pagesImported: number;
        collectionsImported: number;
        attachmentsImported: number;
        linksResolved: number;
        linksUnresolved: number;
        warnings: number;
    };
    errors: string[];
    notes: string[];
}

export type EntityType =
    | 'person'
    | 'organization'
    | 'product'
    | 'project'
    | 'concept'
    | 'location'
    | 'event'
    | 'other';

export interface EntityMention {
    pageId: string;
    snippet: string;
    confidence: number;
}

export interface EntityRecord {
    id: string;
    canonicalName: string;
    type: EntityType;
    aliases: string[];
    confidence: number;
    summary: string;
    mentions: EntityMention[];
    relatedIds: string[];
    createdAt: string;
    updatedAt: string;
}

export interface AskCitation {
    pageId: string;
    pageTitle: string;
    snippet: string;
    score: number;
}

export interface AskAnswer {
    question: string;
    answerMarkdown: string;
    citations: AskCitation[];
    insufficientSources: boolean;
}

export interface SearchResult {
    id: string;
    type: 'page' | 'collection' | 'record' | 'source' | 'entity';
    title: string;
    snippet: string;
    source: string;
    matchedTerms: string[];
    score: number;
    href: string;
    updatedAt?: string;
}
