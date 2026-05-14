<template>
    <div class="tree-node">
        <div
            class="tree-row"
            :class="{ active: isActive }"
            :style="{ paddingLeft: 8 + depth * 14 + 'px' }"
            @click="navigate"
            @mouseenter="hover = true"
            @mouseleave="hover = false"
        >
            <v-icon
                v-if="hasChildren"
                size="14"
                class="caret"
                :class="{ open: expanded }"
                @click.stop="expanded = !expanded"
            >
                mdi-chevron-right
            </v-icon>
            <span v-else class="caret-placeholder" />

            <span class="emoji-slot">{{ node.emoji || '📄' }}</span>

            <span class="title-text">{{ node.title || 'Untitled' }}</span>

            <span class="row-actions" :class="{ visible: hover }">
                <v-tooltip text="New child page" location="top">
                    <template #activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            size="x-small"
                            variant="text"
                            @click.stop="$emit('create-child', node.id)"
                        >
                            <v-icon size="14">mdi-plus</v-icon>
                        </v-btn>
                    </template>
                </v-tooltip>
            </span>
        </div>

        <div v-if="expanded && hasChildren" class="children">
            <PageTreeNode
                v-for="child in node.children"
                :key="child.id"
                :node="child"
                :depth="depth + 1"
                @create-child="(id: string) => $emit('create-child', id)"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';

    import type { PageTreeNode } from '~/composables/useWorkspaceNav';

    const props = defineProps<{
        node: PageTreeNode;
        depth: number;
    }>();

    defineEmits<{
        (e: 'create-child', id: string): void;
    }>();

    const router = useRouter();
    const route = useRoute();
    const expanded = ref(props.depth < 1);
    const hover = ref(false);

    const hasChildren = computed(() => props.node.children.length > 0);
    const isActive = computed(() => route.params.id === props.node.id);

    function navigate() {
        router.push(`/pages/${props.node.id}`);
    }
</script>

<style scoped>
    .tree-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.86rem;
        color: var(--lv-silver, #cfcfcf);
        line-height: 1.2;
        position: relative;
    }
    .tree-row:hover {
        background: rgba(255, 255, 255, 0.04);
        color: #fff;
    }
    .tree-row.active {
        background: rgba(63, 234, 0, 0.08);
        color: #fff;
    }

    .caret {
        transition: transform 120ms ease;
        opacity: 0.6;
    }
    .caret.open {
        transform: rotate(90deg);
    }
    .caret-placeholder {
        width: 14px;
        display: inline-block;
    }

    .emoji-slot {
        width: 18px;
        text-align: center;
        font-size: 0.9rem;
        margin: 0 2px;
    }

    .title-text {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .row-actions {
        opacity: 0;
        transition: opacity 100ms ease;
    }
    .row-actions.visible {
        opacity: 1;
    }

    .children {
        margin-left: 0;
    }
</style>
