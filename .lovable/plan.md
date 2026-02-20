

# Fix: Slow/Laggy Search Input on Accounts Page

## Problem

The search input is a **controlled component** (`value={searchQuery}`) but the `onChange` handler uses a debounced function to update `searchQuery`. This means every keystroke waits 300ms before the input visually updates -- making typing feel frozen and laggy. Single-character (unique) searches feel fast because one keystroke resolves quickly.

## Fix

Split the state into two:
- `inputValue` -- updates instantly on every keystroke (so typing feels responsive)
- `searchQuery` -- updates after a 300ms debounce (used for filtering)

Replace the custom `debounce` wrapper with the existing `useDebounce` hook already in the codebase.

## Changes

**File: `src/components/accounts/AccountsDataTable.tsx`**

1. Import `useDebounce` hook (already exists at `@/hooks/use-debounce`)
2. Remove the `debounce` import from `@/lib/performance`
3. Replace `searchQuery` state + `debouncedSetSearch` with:
   - `inputValue` state (for the input display)
   - `debouncedSearch = useDebounce(inputValue, 300)` (for filtering)
4. Update the Input component to use `value={inputValue}` and `onChange={(e) => setInputValue(e.target.value)}`
5. Update `filteredAccounts` to use `debouncedSearch` instead of `searchQuery`

No other files need changes. The filtering logic stays the same -- only the input responsiveness improves.

