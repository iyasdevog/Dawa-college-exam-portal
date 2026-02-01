# Dependency Injection System

This directory contains the complete dependency injection (IoC) system for the AIC Da'wa College Exam Portal, implementing Clean Architecture principles.

## Overview

The DI system ensures that:
- All dependencies flow inward toward the domain layer
- Domain layer remains independent of external frameworks
- Infrastructure implementations are easily swappable
- Runtime dependency validation prevents architectural violations

## Components

### 1. Container.ts
The core IoC container that manages service registration and resolution.

**Features:**
- Service lifetime management (singleton, transient, scoped)
- Circular dependency detection
- Runtime dependency validation
- Type-safe service resolution

### 2. ContainerConfig.ts
Configuration and setup of all application services.

**Registered Services:**
- Domain services (GradingService, ReportingService)
- Domain use cases (StudentUseCases, SubjectUseCases)
- Infrastructure services (ConfigurationService, AIService, etc.)
- Infrastructure repositories (FirebaseStudentRepository, etc.)

### 3. ServiceLocator.ts
Provides easy access to services with type safety.

**Features:**
- Type-safe service access
- React hooks integration
- Service provider context
- Higher-order components

### 4. DependencyValidator.ts
Runtime validation of dependency architecture rules.

**Validation Rules:**
- Domain layer independence
- Infrastructure layer separation
- Interface segregation
- Circular dependency detection
- Service lifetime consistency

### 5. AppIntegration.tsx
Integration helpers for React applications.

**Features:**
- App initialization
- React context providers
- Service hooks
- Debug status component

## Usage

### Basic Setup

```typescript
import { initializeDependencyInjection, withDependencyInjection } from './infrastructure/di';

// Initialize DI system
initializeDependencyInjection();

// Wrap your app
const App = withDependencyInjection(YourAppComponent);
```

### Using Services in Components

```typescript
import { useAppServices } from './infrastructure/di';

function MyComponent() {
  const services = useAppServices();
  
  const handleCreateStudent = async () => {
    const studentId = await services.studentUseCases.createStudent({
      adNo: 'S001',
      name: 'John Doe',
      className: 'S1',
      semester: 'Odd'
    });
  };
  
  return <div>...</div>;
}
```

### Manual Service Access

```typescript
import { getServiceLocator } from './infrastructure/di';

const serviceLocator = getServiceLocator();
const gradingService = serviceLocator.getGradingService();
```

## Architecture Compliance

The DI system enforces Clean Architecture rules:

1. **Domain Layer Independence**: Domain services cannot depend on infrastructure or presentation layers
2. **Dependency Inversion**: All external dependencies are accessed through interfaces
3. **Interface Segregation**: Services depend on specific interfaces, not concrete implementations
4. **Single Responsibility**: Each service has a single, well-defined responsibility

## Service Lifetimes

- **Singleton**: One instance per application (most infrastructure services)
- **Transient**: New instance per resolution (use cases)
- **Scoped**: One instance per scope (useful for request/response cycles)

## Validation

The system includes comprehensive validation:

```typescript
import { validateDependencies } from './infrastructure/di';

const container = getContainer();
const violations = validateDependencies(container);

if (violations.length > 0) {
  console.error('Architecture violations detected:', violations);
}
```

## Testing

For testing, you can create isolated containers:

```typescript
import { Container, SERVICE_IDENTIFIERS } from './infrastructure/di';

const testContainer = new Container();
testContainer.registerSingleton(
  SERVICE_IDENTIFIERS.GradingService,
  () => new MockGradingService()
);
```

## Extension

To add new services:

1. Define the service interface in the domain layer
2. Implement the service in the appropriate layer
3. Register it in ContainerConfig.ts
4. Add accessor methods to ServiceLocator.ts
5. Update validation rules if needed

## Error Handling

The DI system provides detailed error messages for:
- Missing service registrations
- Circular dependencies
- Architecture violations
- Invalid configurations

All errors include context and suggestions for resolution.