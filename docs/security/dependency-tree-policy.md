# Dependency Tree Policy

Aethos Mirror keeps authored source and documentation English-only.

The repository must not vendor third-party dependency package contents. pnpm package contents are stored outside the project tree through `.npmrc`:

- `virtual-store-dir=/home/fsoq/.pnpm-virtual-stores/aethos-mirror`
- `store-dir=/home/fsoq/.pnpm-store`

`node_modules` entries may exist as package-manager symlinks required for local development, TypeScript, Vite, and Electron resolution. These symlinks are not authored source and are not committed.

Dependency quality is controlled through:

- minimal direct dependencies
- lockfile review
- package provenance review before adding new dependencies
- no unapproved model/tool-generated dependency additions
- `pnpm typecheck`
- `pnpm build`
- `pnpm audit:no-forbidden-text` for authored files

Do not edit files inside `node_modules`. If a dependency is unacceptable, replace or remove it through `package.json` and lockfile changes.
