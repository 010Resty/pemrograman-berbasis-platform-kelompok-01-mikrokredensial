---
name: nodejs-backend-patterns
description: Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures.
---

# Node.js Backend Patterns

Comprehensive guidance for building scalable, maintainable, and production-ready Node.js backend applications with modern frameworks, architectural patterns, and best practices.

## When to Use This Skill

- Building REST APIs or GraphQL servers
- Creating microservices with Node.js
- Implementing authentication and authorization
- Designing scalable backend architectures
- Setting up middleware and error handling
- Integrating databases (SQL and NoSQL)
- Building real-time applications with WebSockets
- Implementing background job processing

## Detailed patterns and worked examples

Detailed pattern documentation lives in `references/details.md`. Read that file when the navigation tier above is insufficient.

## Best Practices

1. **Use TypeScript**: Type safety prevents runtime errors
2. **Implement proper error handling**: Use custom error classes
3. **Validate input**: Use libraries like Zod or Joi
4. **Use environment variables**: Never hardcode secrets
5. **Implement logging**: Use structured logging (Pino, Winston)
6. **Add rate limiting**: Prevent abuse
7. **Use HTTPS**: Always in production
8. **Implement CORS properly**: Don't use `*` in production
9. **Use dependency injection**: Easier testing and maintenance
10. **Write tests**: Unit, integration, and E2E tests
11. **Handle graceful shutdown**: Clean up resources
12. **Use connection pooling**: For databases
13. **Implement health checks**: For monitoring
14. **Use compression**: Reduce response size
15. **Monitor performance**: Use APM tools

## Testing Patterns

See `javascript-testing-patterns` skill for comprehensive testing guidance.

## ARISTOTELES — Project Guardrails (2026-11-04, append-only, precedence: backend/AGENTS.md)

- Stack terkunci: Express 4 + Drizzle ORM + Zod. Abaikan saran Fastify/Hono/NestJS/Bun/Deno dan Joi di skill ini kecuali diminta eksplisit.
- Validasi: Zod-only (`z.object`, `safeParse`, `z.infer`). Jangan pakai Joi tanpa diminta.
- Jangan `npm install`, `npx`, migrasi, atau jalankan script tanpa persetujuan eksplisit.
- Skill ini hanya referensi prinsip. Untuk implementasi Express ikuti `nodejs-express-server` (kecuali bagian Sequelize) + `drizzle` + `zod`.
- Duplikat diketahui: salinan di `frontend/.agents/skills/nodejs-backend-patterns/` berisindeks beda. Lihat `ARISTOTELES.md` di masing-masing folder. Jangan sinkronkan ulang tanpa persetujuan.
