# Vitaluxe Test Suite

## Overview
Automated test suite for deployment validation and regression protection.

## Structure

```
src/tests/
├── setup.ts                 # Test configuration and global mocks
├── utils/
│   └── testHelpers.ts      # Shared utilities and mock data
├── integration/
│   ├── auth.test.ts        # T1-T12 deployment checklist tests
│   └── database.test.ts    # Database structure validation
└── unit/
    └── authService.test.ts # Individual function tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Checklist (T1-T12)

| Test | Description | Status |
|------|-------------|--------|
| T1 | New user signup + verification | ✅ |
| T2 | Login before verifying | ✅ |
| T3 | Admin creates user | ✅ |
| T4 | Admin user login | ✅ |
| T5 | Verified user re-login | ✅ |
| T6 | Duplicate email signup | ✅ |
| T7 | Impersonation test | ✅ |
| T8 | Role structure integrity | ✅ |
| T9 | SES delivery | 🚧 Pending SES integration |
| T10 | SQL integrity | ✅ |
| T11 | Audit log entry | ✅ |
| T12 | Database cleanup validation | ✅ |

## Adding New Tests

1. Create test file in appropriate directory
2. Import utilities from `testHelpers.ts`
3. Follow existing patterns for consistency
4. Update this README with new tests

## CI/CD Integration

Tests should run on:
- Pre-commit (via husky)
- Pull requests
- Before deployment
- Scheduled nightly runs

**Fail deployment if any test returns false.**

## Mocking Strategy

- Supabase client is mocked globally in `setup.ts`
- Use `MockDatabase` class for in-memory database simulation
- Use `mockSESSend` for email testing
- Router and navigation are mocked for component tests

## Next Steps

1. ✅ Testing framework installed
2. ✅ Test structure created
3. 🚧 Auth refactoring (pending)
4. 🚧 Database cleanup (pending)
5. 🚧 SES integration (pending)
6. 🚧 Connect tests to real implementation

## Notes

- Tests currently use mock implementations
- Will be connected to real services during Phase 2 refactoring
- Impersonation functionality preserved in all test scenarios
