# Contributing

## Scope

This SDK is a read-only customer integration surface for Aleatoric Hypercore services. Changes must preserve that boundary.

## Workflow

1. Open an issue or align on the change scope before substantial work.
2. Keep public APIs backward-compatible unless a versioned breaking change is explicitly approved.
3. Update tests, `README.md`, and `CHANGELOG.md` in the same change.
4. Prefer small, reviewable pull requests with clear release notes.

## Local Validation

```bash
npm install
npm run build
npm test
npm run validate:mcp:inspector
npm run release:check
```

## Release Notes

Document customer-visible changes in `CHANGELOG.md` using clear operational language.

## Support

- Email: [github@aleatoric.systems](mailto:github@aleatoric.systems)
- Discord: request the current customer support invite from the Aleatoric Systems team
