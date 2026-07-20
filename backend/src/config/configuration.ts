export default () => ({
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
  integrations: {
    crm: {
      baseUrl: process.env.CRM_BASE_URL ?? '',
      apiKey: process.env.CRM_API_KEY ?? '',
    },
    msGraph: {
      clientId: process.env.MS_GRAPH_CLIENT_ID ?? '',
      clientSecret: process.env.MS_GRAPH_CLIENT_SECRET ?? '',
      redirectUri: process.env.MS_GRAPH_REDIRECT_URI ?? 'http://localhost:3000/outlook/callback',
    },
  },
});
