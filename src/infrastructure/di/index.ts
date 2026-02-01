/**
 * Dependency Injection System
 * Export all DI-related components
 */

export * from './Container';
export * from './ContainerConfig';
export * from './ServiceLocator';
export * from './DependencyValidator';
export * from './AppIntegration';

// Re-export commonly used types and functions
export type { ServiceIdentifier, Factory, ServiceLifetime, ServiceDescriptor, ContainerOptions, ValidationResult } from './Container';
export { SERVICE_IDENTIFIERS } from './Container';
export { configureContainer, validateContainerConfiguration, getContainer, resetContainer } from './ContainerConfig';
export {
    ServiceLocator,
    getServiceLocator,
    resetServiceLocator,
    useServices,
    withServices,
    ServiceProvider,
    useServiceContext
} from './ServiceLocator';
export {
    DependencyValidator,
    createDependencyValidator,
    validateDependencies,
    validateDependenciesAndThrow
} from './DependencyValidator';
export type { DependencyValidationRule, ValidationViolation, LayerInfo } from './DependencyValidator';
export {
    initializeDependencyInjection,
    withDependencyInjection,
    useAppServices,
    DISystemStatus
} from './AppIntegration';