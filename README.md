# Fatal Crash Path Detection & Repair

This repository contains an original TypeScript file with multiple runtime crash paths (input.ts), a minimally fixed version (fixed_version.ts), and deterministic Jest tests that reproduce each crash and verify the fixes.

Setup:

1. Install dependencies:
```bash
npm install
```

2. Run tests:
```bash
npm test
```

Notes:
- Tests run original code scenarios in a child process using ts-node; they transform `input.ts` to attach functions/classes to `globalThis` so the tests can invoke those functions and reproduce crashes.
- The `fixed_version.ts` exports safe variants of key functions and classes with minimal changes.
