// Grounded assistant scaffold.
//
// Retrieves the highest-scoring chunks from the imported workspace using the
// same keyword scorer as /search, then synthesizes a citation-backed answer.
// The "answer" is deterministic and quote-only -- no model call -- so the
// scaffold is honest about its limits. A future implementation can swap in
// an LLM that receives the citations as grounding context.

import { readAll, requireAuth } from '../../utils/workspace';
import { chunkText } from '../../utils/entityExtractor';
import type { AskAnswer, AskCitation, PageRecord } from '../../../utils/knowspaceTypes';

interface AskBody {
    question: string;
}

export default defineEventHandler(async (event) => {
    const ctx = await requireAuth(event);
    const body = await readBody<AskBody>(event);
    const question = (body?.question ?? '').trim();

    if (!question) {
        const empty: AskAnswer = {
            question: '',
            answerMarkdown: '_Ask a question grounded in your workspace._',
            citations: [],
            insufficientSources: true,
        };
        return empty;
    }

    const terms = question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
    if (!terms.length) {
        const empty: AskAnswer = {
            question,
            answerMarkdown:
                "_I couldn't pull keywords from that question. Try rephrasing with more specific terms._",
            citations: [],
            insufficientSources: true,
        };
        return empty;
    }

    const pages = await readAll<PageRecord>(ctx, 'pages');
    const scored: Array<{ page: PageRecord; chunk: string; score: number }> = [];

    for (const p of pages) {
        const text = `${p.title}\n\n${p.contentMarkdown}`;
        const chunks = chunkText(text);
        for (const chunk of chunks) {
            const lower = chunk.toLowerCase();
            let score = 0;
            for (const term of terms) {
                if (lower.includes(term)) score += 1;
            }
            if (score > 0) scored.push({ page: p, chunk, score });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 4);

    const citations: AskCitation[] = top.map((c) => ({
        pageId: c.page.id,
        pageTitle: c.page.title,
        snippet: c.chunk.length > 360 ? `${c.chunk.slice(0, 360)}…` : c.chunk,
        score: c.score,
    }));

    if (!citations.length) {
        const empty: AskAnswer = {
            question,
            answerMarkdown:
                '_The workspace does not yet contain sources that match this question. Import a Notion export or connect Google Drive to expand the knowledge base._',
            citations: [],
            insufficientSources: true,
        };
        return empty;
    }

    const answerLines: string[] = [];
    answerLines.push(`Based on ${citations.length} matched passage(s) from your workspace:`);
    answerLines.push('');
    citations.forEach((c, idx) => {
        answerLines.push(`> [${idx + 1}] ${c.snippet}`);
        answerLines.push('');
    });
    answerLines.push('_Citations link to the source pages below._');

    const answer: AskAnswer = {
        question,
        answerMarkdown: answerLines.join('\n'),
        citations,
        insufficientSources: false,
    };
    return answer;
});

const STOPWORDS = new Set([
    'the',
    'and',
    'for',
    'are',
    'was',
    'were',
    'this',
    'that',
    'with',
    'from',
    'into',
    'about',
    'what',
    'when',
    'where',
    'which',
    'how',
    'why',
    'who',
    'whom',
    'does',
    'doing',
    'have',
    'has',
    'had',
    'will',
    'would',
    'could',
    'should',
    'tell',
    'show',
    'list',
    'find',
    'know',
]);
