<template>
    <div class="page">
        <div class="eyebrow">Knowspace · Tags</div>
        <h1 class="title">Redirecting collection…</h1>
        <p class="sub" v-if="tagUrl">
            Collection views are now tag pages. Opening
            <NuxtLink :to="tagUrl">{{ tagUrl }}</NuxtLink
            >.
        </p>
        <p class="sub" v-else>Loading collection metadata…</p>
    </div>
</template>

<script setup lang="ts">
    import { ref, watch } from 'vue';

    const route = useRoute();
    const router = useRouter();
    const tagUrl = ref<string | null>(null);

    async function redirect(id: string) {
        const res = await $fetch<{ tag_url?: string }>(`/api/collections/${id}`);
        tagUrl.value = res.tag_url || null;
        if (tagUrl.value) await router.replace(tagUrl.value);
    }

    watch(
        () => route.params.id,
        (id) => {
            if (typeof id === 'string') void redirect(id);
        },
        { immediate: true }
    );
</script>

<style scoped>
    .page {
        padding: 40px 48px 80px;
        max-width: 920px;
        margin: 0 auto;
    }
    .eyebrow {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--lv-silver, #888);
    }
    .title {
        margin: 4px 0;
        font-size: 1.6rem;
        font-family: var(--font-headline, serif);
        font-weight: 400;
    }
    .sub {
        color: var(--lv-silver, #999);
    }
</style>
