# AI Assistant Instructions for Vitaluxe Flow

## Project Overview
Vitaluxe Flow is a React-based healthcare platform built with TypeScript, focusing on managing medical practices, pharmacies, and patient interactions. The application uses Supabase for backend services and authentication.

## Architecture Patterns

### Authentication & Authorization
- Authentication is managed through `src/contexts/AuthContext.tsx`
- Role-based access control with support for role impersonation
- Requires handling of 2FA, password changes, and terms acceptance states

### Component Structure
- UI components are organized in `src/components/` by domain (practices, patients, pharmacies)
- Uses shadcn-ui with Tailwind CSS for styling
- Common UI components are in `src/components/ui/`

### Data Flow
- Supabase Edge Functions (`/supabase/functions/`) handle complex business logic
- React Query (`@tanstack/react-query`) manages server state
- Global state managed through React Context (`src/contexts/`)

### Security Patterns
- CSRF protection implemented in `src/lib/csrf.ts`
- Password strength validation in `src/lib/passwordStrength.ts`
- Audit logging through `src/lib/auditLogger.ts`

## Development Workflow

### Setup
```bash
npm install
npm run dev  # Starts development server
```

### Key Directories
- `/src/pages/` - Main route components
- `/src/components/` - Reusable components
- `/supabase/functions/` - Edge functions
- `/src/lib/` - Utility functions and shared logic

### Common Operations
1. Adding new features:
   - Place components in domain-specific folders under `src/components/`
   - Edge functions go in `/supabase/functions/`
   - Update types in `src/types/`

2. Authorization:
   - Check `effectiveRole` from AuthContext for permissions
   - Use ProtectedRoute component for route guards

## Integration Points

### External Services
- Authorize.net for payments
- Amazon for shipment tracking
- Address verification services

### Cross-Component Communication
- Use React Query for server state
- AuthContext for user state
- Custom hooks in `src/hooks/` for shared functionality

## Common Patterns
- Error handling through ErrorBoundary component
- Audit logging for sensitive operations
- CSRF token management for forms
- Role-based UI rendering

## Project-Specific Conventions
- File naming: PascalCase for components, kebab-case for utilities
- Component organization: Domain-driven folders
- Edge function naming: action-based (e.g., `approve-pending-practice`)
- Use of custom hooks for shared business logic