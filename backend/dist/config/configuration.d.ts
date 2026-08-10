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
    encryptionKey: string;
    mail: {
        host: string;
        port: number;
        user: string;
        password: string;
        from: string;
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
            adminConsentRedirectUri: string;
        };
        google: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
    };
    oauth: {
        google: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
        microsoft: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
            tenant: string;
        };
        github: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
    };
};
export default _default;
