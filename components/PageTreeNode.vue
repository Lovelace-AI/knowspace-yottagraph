<template>
    <div class="tree-node">
        <div class="tree-row" :style="{ paddingLeft: indent + 'px' }">
            <v-btn
                v-if="node.children.length"
                icon
                size="x-small"
                variant="text"
                class="expand-btn"
                @click="open = !open"
            >
                <v-icon size="16">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
            </v-btn>
            <span v-else class="expand-spacer"></span>
            <NuxtLink :to="`/pages/${node.id}`" class="tree-link">
                <span class="tree-emoji">{{ node.emoji || '📄' }}</span>
                <span class="tree-title">{{ node.title }}</span>
            </NuxtLink>
        </div>
        <div v-if="open && node.children.length" class="tree-children">
            <PageTreeNode
                v-for="child in node.children"
                :key="child.id"
                :node="child"
                :level="level + 1"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';

    interface Node {
        id: string;
        title: string;
        emoji: string;
        children: Node[];
        updatedAt: string;
    }

    const props = defineProps<{ node: Node; level: number }>();
    const open = ref(props.level < 1);
    const indent = computed(() => props.level * 16 + 4);
</script>

<style scoped>
    .tree-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 0;
        border-radius: 6px;
    }

    .tree-row:hover {
        background: rgba(255, 255, 255, 0.03);
    }

    .expand-btn {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
    }

    .expand-spacer {
        width: 22px;
        flex-shrink: 0;
    }

    .tree-link {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        padding: 4px 6px;
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        font-size: 0.9rem;
    }

    .tree-emoji {
        width: 18px;
        text-align: center;
    }

    .tree-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
