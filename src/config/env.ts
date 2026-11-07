export const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'GROQ_API_KEY', 'ADMIN_API_KEY', 'IP_HASH_SALT'],
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    PORT: { type: 'number', default: 3000 },
    DATABASE_URL: { type: 'string' },
    GROQ_API_KEY: { type: 'string' },
    GEMINI_API_KEY: { type: 'string' },
    ADMIN_API_KEY: { type: 'string' },
    IP_HASH_SALT: { type: 'string' },
    CORS_ORIGIN: { type: 'string' },
    CHAT_QUERY_LIMIT: { type: 'number', default: 5 },
  },
} as const;
