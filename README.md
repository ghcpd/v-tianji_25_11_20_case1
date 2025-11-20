# Fatal Crash Path Detection & Repair

## Quick Start

```powershell
# Install dependencies
npm install

# Run all tests
npm test
```

## Project Structure

```
├── input.ts                      # Original code with 16 crash paths
├── fixed_version.ts              # Fixed code with all crashes resolved
├── crashes.original.test.ts      # 22 tests reproducing all crashes
├── crashes.fixed.test.ts         # 22 tests verifying fixes work
├── CRASH_ANALYSIS_REPORT.md      # Detailed analysis report
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── vitest.config.ts              # Test runner config
```

## Test Results

✅ **44/44 tests passing**
- 22 tests verify original crashes
- 22 tests verify fixes work correctly

## Crashes Found

**Total: 16 fatal crash paths**

Categories:
- 6 Null/Undefined Property Access crashes
- 4 Non-Function Invocation crashes  
- 3 Method Calls on Null crashes
- 1 Property Access Wrong Type crash
- 1 Async Race Condition crash
- 1 Infinite Recursion crash

See `CRASH_ANALYSIS_REPORT.md` for complete details.

## Key Files

- **input.ts** - Original buggy code (DO NOT MODIFY)
- **fixed_version.ts** - All crashes fixed with minimal changes
- **CRASH_ANALYSIS_REPORT.md** - Comprehensive analysis with:
  - Exact code locations
  - Crash explanations
  - Execution paths
  - Fix descriptions
  - Test coverage details

## Running Tests

All tests use Vitest and are fully automated:

```powershell
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## Verification

To verify the fix quality:

1. Read `CRASH_ANALYSIS_REPORT.md` for crash details
2. Run `npm test` to see all tests pass
3. Compare `input.ts` with `fixed_version.ts` to see minimal changes
4. Review test files to see each crash scenario covered

All tests are deterministic and executable as-is.
