# Dependency review before cloud deployment

Reviewed on 2026-11-13.

- Prisma CLI, Client and PostgreSQL adapter are aligned at 7.10.1 (Prisma 7).
- Compatible dependency fixes were applied without `--force`. npm 11 was used for the update because npm 10.4.0 failed while calculating its audit-fix tree.
- `npm audit --omit=dev`: zero vulnerabilities.
- Full audit: eight moderate findings, all from one minimatch advisory propagated through the ESLint / typescript-eslint dependency chain.

## Remaining development-only advisory

Advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249

The installed typescript-estree version is 8.72.2 and its minimatch version is 10.2.6. In this package minimatch is used to match `projectService.allowDefaultProject` patterns. The project's ESLint configuration does not enable `projectService` or `allowDefaultProject`. Application requests and collection data do not reach this lint-only path.

Disposition: tracked as a development tooling limitation; not a runtime publication blocker under the current configuration. Reassess when changing ESLint parser/project-service settings or updating the dependency chain. Do not downgrade Next.js ESLint configuration or force an unsupported minimatch major version merely to silence the audit.

## Validation

After dependency updates: 169 application tests and nine database-tool tests passed, along with typecheck and lint. Production build is checked before the release commit. Tests use isolated local PostgreSQL and do not modify the Neon development collection.

No credentials, database copies or private documentation are included in the source commit. Production access still requires Vercel Authentication with All Deployments; this report does not replace that configuration.