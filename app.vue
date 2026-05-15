<template>
    <v-app class="theme-brand">
        <template v-if="showAppFramework">
            <AppHeader />
            <WorkspaceSidebar />

            <v-main class="fill-height workspace-main">
                <NuxtPage />
            </v-main>

            <v-dialog v-model="state.showSettingsDialog" max-width="600">
                <SettingsDialog />
            </v-dialog>

            <NotificationContainer />
        </template>
        <template v-else>
            <NuxtPage />
        </template>
    </v-app>
</template>

<script setup lang="ts">
    import { state } from './utils/appState';

    const route = useRoute();
    const { userName } = useUserState();

    const noFrameworkRoutes = ['/login', '/a0callback', '/logout', '/pending'];

    const showAppFramework = computed(() => {
        if (noFrameworkRoutes.includes(route.path)) {
            return false;
        }
        if (!userName.value) {
            return false;
        }
        return true;
    });
</script>

<style scoped>
    .workspace-main {
        background: #0a0a0a;
    }
</style>
