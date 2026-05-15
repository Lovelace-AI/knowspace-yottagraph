import { ref, reactive } from 'vue';

type ServerStatus = 'checking' | 'available' | 'unavailable' | 'not-configured';

interface ServerInfo {
    type: string;
    name: string;
    configKey: string;
    status: ServerStatus;
    address?: string;
    lastChecked?: Date;
    error?: string;
}

const server = reactive<ServerInfo>({
    type: 'query',
    name: 'Query API',
    configKey: 'queryServerAddress',
    status: 'checking',
});

let checkInterval: NodeJS.Timeout | null = null;

export function useServerStatus() {
    const config = useRuntimeConfig();

    async function checkServer() {
        try {
            const serverAddress = config.public[server.configKey] as string;

            if (!serverAddress) {
                server.status = 'not-configured';
                server.address = undefined;
                return;
            }

            const baseURL = serverAddress.startsWith('http')
                ? serverAddress
                : `https://${serverAddress}`;

            server.address = baseURL;

            await $fetch('/status', {
                baseURL,
                timeout: 3000,
            });

            server.status = 'available';
            server.error = undefined;
            server.lastChecked = new Date();
        } catch (error) {
            // Knowspace doesn't depend on the query server (entity enrichment
            // is Phase 5). Surface the unavailable state in the footer
            // indicator but stay silent in the console so failed pings don't
            // look like an app error.
            server.status = 'unavailable';
            server.error = error instanceof Error ? error.message : 'Unknown error';
            server.lastChecked = new Date();
        }
    }

    function startChecking() {
        checkServer();
        if (!checkInterval) {
            checkInterval = setInterval(checkServer, 30000);
        }
    }

    function stopChecking() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }

    function getConfiguredServers() {
        return server.status !== 'not-configured' ? [server] : [];
    }

    const overallStatus = computed(() => server.status);

    return {
        servers: readonly(reactive({ query: server })),
        getConfiguredServers,
        serverStatus: overallStatus,
        checkServerStatus: checkServer,
        startChecking,
        stopChecking,
    };
}
