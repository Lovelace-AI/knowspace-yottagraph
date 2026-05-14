<template>
    <div class="d-flex flex-column fill-height">
        <div class="flex-shrink-0 header">
            <div class="eyebrow">Assistant</div>
            <h1 class="title">Ask your workspace</h1>
            <p class="sub">
                Grounded Q&amp;A across imported Notion pages, collections, and indexed Google Docs.
                Every answer cites the source passages it relied on. When the workspace lacks
                sources, the assistant says so instead of guessing.
            </p>
        </div>

        <div class="flex-grow-1 overflow-y-auto body">
            <v-card class="ask-card">
                <v-textarea
                    v-model="question"
                    placeholder="e.g. What is our hiring plan for the knowledge graph team?"
                    rows="3"
                    auto-grow
                    variant="outlined"
                    hide-details
                />
                <div class="ask-actions">
                    <div class="prompt-suggestions">
                        <button
                            v-for="p in samplePrompts"
                            :key="p"
                            type="button"
                            class="suggestion"
                            @click="
                                question = p;
                                runAsk();
                            "
                        >
                            {{ p }}
                        </button>
                    </div>
                    <v-btn
                        color="primary"
                        :loading="loading"
                        :disabled="!question.trim()"
                        prepend-icon="mdi-creation-outline"
                        @click="runAsk"
                    >
                        Ask
                    </v-btn>
                </div>
            </v-card>

            <div v-if="answer" class="answer-block">
                <div class="answer-head">
                    <h2 class="answer-title">Answer</h2>
                    <v-chip v-if="answer.insufficientSources" color="warning">
                        Insufficient sources
                    </v-chip>
                </div>
                <div class="markdown-body" v-html="renderedAnswer"></div>
                <div v-if="answer.citations.length" class="citations">
                    <h3 class="citations-title">Citations</h3>
                    <NuxtLink
                        v-for="(c, idx) in answer.citations"
                        :key="c.pageId + idx"
                        :to="`/pages/${c.pageId}`"
                        class="citation"
                    >
                        <div class="citation-head">
                            <span class="citation-index">[{{ idx + 1 }}]</span>
                            <span class="citation-title">{{ c.pageTitle }}</span>
                        </div>
                        <div class="citation-snippet">{{ c.snippet }}</div>
                    </NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { renderMarkdown } from '~/utils/markdown';
    import type { AskAnswer } from '~/utils/knowspaceTypes';

    const knowspace = useKnowspace();
    const question = ref('');
    const answer = ref<AskAnswer | null>(null);
    const loading = ref(false);

    const samplePrompts = [
        'Summarize the product strategy',
        'Who is on the hiring plan?',
        'What sources are connected?',
    ];

    const renderedAnswer = computed(() =>
        answer.value ? renderMarkdown(answer.value.answerMarkdown) : ''
    );

    async function runAsk() {
        const q = question.value.trim();
        if (!q) return;
        loading.value = true;
        try {
            answer.value = await knowspace.ask(q);
        } finally {
            loading.value = false;
        }
    }
</script>

<style scoped>
    .header {
        padding: 32px 40px 20px;
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
        max-width: 640px;
    }

    .body {
        padding: 24px 40px 64px;
        max-width: 880px;
    }

    .ask-card {
        padding: 20px !important;
    }

    .ask-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 14px;
        gap: 12px;
        flex-wrap: wrap;
    }

    .prompt-suggestions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .suggestion {
        font-size: 0.75rem;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
    }

    .suggestion:hover {
        border-color: var(--lv-green, #3fea00);
        color: var(--lv-green, #3fea00);
    }

    .answer-block {
        margin-top: 24px;
        padding: 22px 24px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.02);
    }

    .answer-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .answer-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.1rem;
    }

    .markdown-body :deep(p) {
        line-height: 1.65;
        color: rgba(255, 255, 255, 0.86);
        margin-bottom: 0.7em;
    }

    .markdown-body :deep(blockquote) {
        border-left: 3px solid rgba(63, 234, 0, 0.5);
        padding: 4px 12px;
        margin: 8px 0;
        color: rgba(255, 255, 255, 0.85);
    }

    .citations {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .citations-title {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 8px;
    }

    .citation {
        display: block;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        text-decoration: none;
        color: inherit;
    }

    .citation:hover {
        border-color: var(--lv-green, #3fea00);
    }

    .citation-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
    }

    .citation-index {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: var(--lv-green, #3fea00);
    }

    .citation-title {
        font-weight: 500;
    }

    .citation-snippet {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.72);
        line-height: 1.45;
    }
</style>
