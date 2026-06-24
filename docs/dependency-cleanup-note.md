# Dependency cleanup note

This branch removes unused runtime dependencies from package.json after the old source and config files were removed.

package-lock.json should be regenerated with:

```bash
npm install
npm run lint
npm run build
```

The lockfile was not manually edited here to avoid corrupting the dependency tree through a text-only connector workflow.
