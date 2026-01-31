# Project Structure & Organization

## Root Level Files

- **App.tsx**: Main application component with routing and state management
- **index.tsx**: React application entry point
- **types.ts**: TypeScript type definitions for the entire application
- **constants.ts**: Static data (subjects, classes, initial students)
- **firebaseConfig.ts**: Firebase initialization and database connection

## Directory Structure

```
/components/          # React UI components
  ├── Layout.tsx      # Main layout wrapper with navigation
  ├── Dashboard.tsx   # Admin dashboard with charts and stats
  ├── FacultyEntry.tsx # Marks entry interface for teachers
  ├── ClassResults.tsx # Class-wise result reports
  ├── StudentScorecard.tsx # Individual student report cards
  ├── Management.tsx  # System administration interface
  └── PublicPortal.tsx # Public-facing result viewer

/services/           # Business logic and data access
  ├── dbService.ts   # Database operations (Firebase + localStorage)
  └── aiService.ts   # Google Gemini AI integration

/.kiro/              # Kiro IDE configuration
  └── steering/      # AI assistant guidance documents
```

## Component Architecture

- **Single Page Application**: All views rendered within App.tsx
- **State Management**: React hooks with local state (no external state library)
- **Component Props**: Typed interfaces for all component communication
- **Event Handling**: Callback props for parent-child communication

## Data Flow Patterns

- **Top-Down**: State managed in App.tsx, passed down via props
- **Service Layer**: dbService handles all data persistence
- **Hybrid Storage**: Cloud-first with localStorage fallback
- **Computed State**: Derived calculations (totals, ranks) in useMemo hooks

## File Naming Conventions

- **Components**: PascalCase with .tsx extension
- **Services**: camelCase with .ts extension
- **Types**: Centralized in types.ts
- **Constants**: UPPER_CASE exports from constants.ts

## Import Patterns

- **Relative Imports**: Used for local files (`./components/Layout.tsx`)
- **Path Aliases**: `@/` prefix for root-level imports
- **Type Imports**: Explicit type-only imports where applicable
- **Service Imports**: Named imports from service modules