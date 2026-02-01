/**
 * Service Locator
 * Provides easy access to services from the DI container
 * Following Clean Architecture principles
 */

import { Container, SERVICE_IDENTIFIERS } from './Container';
import { getContainer } from './ContainerConfig';

// Domain interfaces
import type { IStudentRepository } from '../../domain/interfaces/IStudentRepository';
import type { ISubjectRepository } from '../../domain/interfaces/ISubjectRepository';
import type { IExamRepository } from '../../domain/interfaces/IExamRepository';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository';
import type { IErrorReporter } from '../../domain/interfaces/IErrorReporter';
import type { IPerformanceMonitor } from '../../domain/interfaces/IPerformanceMonitor';
import type { IApiErrorHandler } from '../../domain/interfaces/IApiErrorHandler';

// Domain services
import type { GradingService } from '../../domain/services/GradingService';
import type { ReportingService } from '../../domain/services/ReportingService';

// Domain use cases
import type { StudentUseCases } from '../../domain/usecases/StudentUseCases';
import type { SubjectUseCases } from '../../domain/usecases/SubjectUseCases';
import type { ExamUseCases } from '../../domain/usecases/ExamUseCases';

// Infrastructure services
import type { ConfigurationService } from '../services/ConfigurationService';
import type { AIService } from '../services/AIService';
import type { ErrorReportingService } from '../services/ErrorReportingService';
import type { ApiErrorHandler } from '../services/ApiErrorHandler';
import type { EnhancedDataService } from '../services/EnhancedDataService';
import type { AuthenticationService } from '../security/AuthenticationService';

export class ServiceLocator {
    private container: Container;

    constructor(container?: Container) {
        this.container = container || getContainer();
    }

    // Domain Interface Accessors
    getStudentRepository(): IStudentRepository {
        return this.container.resolve<IStudentRepository>(SERVICE_IDENTIFIERS.IStudentRepository);
    }

    getSubjectRepository(): ISubjectRepository {
        return this.container.resolve<ISubjectRepository>(SERVICE_IDENTIFIERS.ISubjectRepository);
    }

    getExamRepository(): IExamRepository {
        return this.container.resolve<IExamRepository>(SERVICE_IDENTIFIERS.IExamRepository);
    }

    getUserRepository(): IUserRepository {
        return this.container.resolve<IUserRepository>(SERVICE_IDENTIFIERS.IUserRepository);
    }

    getErrorReporter(): IErrorReporter {
        return this.container.resolve<IErrorReporter>(SERVICE_IDENTIFIERS.IErrorReporter);
    }

    getPerformanceMonitor(): IPerformanceMonitor {
        return this.container.resolve<IPerformanceMonitor>(SERVICE_IDENTIFIERS.IPerformanceMonitor);
    }

    getApiErrorHandler(): IApiErrorHandler {
        return this.container.resolve<IApiErrorHandler>(SERVICE_IDENTIFIERS.IApiErrorHandler);
    }

    // Domain Service Accessors
    getGradingService(): GradingService {
        return this.container.resolve<GradingService>(SERVICE_IDENTIFIERS.GradingService);
    }

    getReportingService(): ReportingService {
        return this.container.resolve<ReportingService>(SERVICE_IDENTIFIERS.ReportingService);
    }

    // Domain Use Case Accessors
    getStudentUseCases(): StudentUseCases {
        return this.container.resolve<StudentUseCases>(SERVICE_IDENTIFIERS.StudentUseCases);
    }

    getSubjectUseCases(): SubjectUseCases {
        return this.container.resolve<SubjectUseCases>(SERVICE_IDENTIFIERS.SubjectUseCases);
    }

    getExamUseCases(): ExamUseCases {
        // Note: ExamUseCases is not yet registered due to missing IExamRepository
        // Return a mock implementation for now
        throw new Error('ExamUseCases not yet implemented - missing IExamRepository');
    }

    // Infrastructure Service Accessors (for presentation layer)
    getConfigurationService(): ConfigurationService {
        return this.container.resolve<ConfigurationService>(SERVICE_IDENTIFIERS.ConfigurationService);
    }

    getAIService(): AIService {
        return this.container.resolve<AIService>(SERVICE_IDENTIFIERS.AIService);
    }

    getErrorReportingService(): ErrorReportingService {
        return this.container.resolve<ErrorReportingService>(SERVICE_IDENTIFIERS.ErrorReportingService);
    }



    getEnhancedDataService(): EnhancedDataService {
        return this.container.resolve<EnhancedDataService>(SERVICE_IDENTIFIERS.EnhancedDataService);
    }

    getAuthenticationService(): AuthenticationService {
        return this.container.resolve<AuthenticationService>(SERVICE_IDENTIFIERS.AuthenticationService);
    }

    // Utility methods
    isServiceRegistered(identifier: symbol): boolean {
        return this.container.isRegistered(identifier);
    }

    tryGetService<T>(identifier: symbol): T | null {
        return this.container.tryResolve<T>(identifier);
    }

    validateContainer(): void {
        const validation = this.container.validate();
        if (!validation.isValid) {
            throw new Error(`Container validation failed: ${validation.errors.join(', ')}`);
        }
    }

    clearScope(): void {
        this.container.clearScope();
    }

    dispose(): void {
        this.container.dispose();
    }
}

// Global service locator instance
let serviceLocatorInstance: ServiceLocator | null = null;

/**
 * Get the global service locator instance
 */
export function getServiceLocator(): ServiceLocator {
    if (!serviceLocatorInstance) {
        serviceLocatorInstance = new ServiceLocator();
    }
    return serviceLocatorInstance;
}

/**
 * Reset the global service locator (useful for testing)
 */
export function resetServiceLocator(): void {
    if (serviceLocatorInstance) {
        serviceLocatorInstance.dispose();
        serviceLocatorInstance = null;
    }
}

/**
 * Hook for React components to access services
 */
export function useServices(): ServiceLocator {
    return getServiceLocator();
}

/**
 * Higher-order component to inject services
 */
export function withServices<P extends object>(
    Component: React.ComponentType<P & { services: ServiceLocator }>
): React.ComponentType<P> {
    return function WithServicesComponent(props: P) {
        const services = getServiceLocator();
        return <Component { ...props } services = { services } />;
    };
}

/**
 * Service provider context for React
 */
import React, { createContext, useContext, ReactNode } from 'react';

const ServiceContext = createContext<ServiceLocator | null>(null);

interface ServiceProviderProps {
    children: ReactNode;
    serviceLocator?: ServiceLocator;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({
    children,
    serviceLocator
}) => {
    const services = serviceLocator || getServiceLocator();

    return (
        <ServiceContext.Provider value= { services } >
        { children }
        </ServiceContext.Provider>
  );
};

export function useServiceContext(): ServiceLocator {
    const context = useContext(ServiceContext);
    if (!context) {
        throw new Error('useServiceContext must be used within a ServiceProvider');
    }
    return context;
}