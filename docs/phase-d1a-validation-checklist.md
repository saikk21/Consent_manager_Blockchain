# Phase D.1a Validation Checklist

## Build and type safety

- [ ] Root service builds cleanly (`npm run build`)
- [ ] All SDK packages build (`npm run build:packages`)
- [ ] Package exports resolve (`dist` generated for each package)
- [ ] Strict TypeScript remains clean

## Test validation

- [ ] Shared-core unit tests pass
- [ ] Transport timeout test passes
- [ ] Error normalization test passes
- [ ] Workspace test runner passes (`npm run test:packages`)

## Architecture safety

- [ ] No circular dependencies between SDK packages
- [ ] Browser/node separation preserved:
  - `widget-sdk` uses browser typings (`DOM`)
  - other packages remain node-safe
- [ ] No SDK business feature APIs added
- [ ] No backend redesign introduced

