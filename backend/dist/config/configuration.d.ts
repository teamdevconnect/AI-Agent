declare const _default: () => {
    port: number;
    nodeEnv: string;
    corsOrigin: string;
    mongoUri: string;
    pythonAgentUrl: string;
    redisUrl: string;
    jwt: {
        secret: string | undefined;
        expiresIn: string;
    };
    integrations: {
        crm: {
            baseUrl: string;
            apiKey: string;
        };
        msGraph: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
    };
};
export default _default;
