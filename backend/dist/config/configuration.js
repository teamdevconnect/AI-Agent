"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/agent',
    pythonAgentUrl: process.env.PYTHON_AGENT_URL ?? 'http://localhost:8000',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    },
    encryptionKey: process.env.ENCRYPTION_KEY ?? '',
    mail: {
        host: process.env.SMTP_HOST ?? '',
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        user: process.env.SMTP_USER ?? '',
        password: process.env.SMTP_PASSWORD ?? '',
        from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
    },
    integrations: {
        crm: {
            baseUrl: process.env.CRM_BASE_URL ?? '',
            apiKey: process.env.CRM_API_KEY ?? '',
        },
        msGraph: {
            clientId: process.env.MS_GRAPH_CLIENT_ID ?? '',
            clientSecret: process.env.MS_GRAPH_CLIENT_SECRET ?? '',
            redirectUri: process.env.MS_GRAPH_REDIRECT_URI ?? 'http://localhost:3000/outlook/callback',
            adminConsentRedirectUri: process.env.MS_GRAPH_ADMIN_CONSENT_REDIRECT_URI ?? 'http://localhost:3000/outlook/admin-consent-callback',
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/gmail/callback',
        },
    },
    oauth: {
        google: {
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
            redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/auth/oauth/google/callback',
        },
        microsoft: {
            clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
            clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
            redirectUri: process.env.MICROSOFT_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/auth/oauth/microsoft/callback',
            tenant: process.env.MICROSOFT_OAUTH_TENANT ?? 'common',
        },
        github: {
            clientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? '',
            clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? '',
            redirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/auth/oauth/github/callback',
        },
    },
});
//# sourceMappingURL=configuration.js.map