/**
 * Container Configuration
 * Sets up all dependency registrations following Clean Architecture principles
 */

import { Container, SERVICE_IDENTIFIERS } from './Container';

// Domain imports
import { GradingService } from '../../domain/services/GradingService';
import { ReportingService } from '../../domain/services/ReportingService';
import { StudentUseCases } from '../../domain/usecases/StudentUseCases';
import { SubjectUseCases } from '../../domain/usecases/SubjectUseCases';
import { ExamUseCases } from '../../domain/usecases/ExamUseCases';

// Infrastructure imports
import { ConfigurationService } from '../services/ConfigurationService';
import { AIService } from '../services/AIService';
import { ErrorReportingService } from '../services/ErrorReportingService';
import { ApiErrorHandler } from '../services/ApiErrorHandler';
import { EnhancedDataService } from '../services/EnhancedDataService';
import { FirebaseStudentRepository } from '../repositories/FirebaseStudentRepository';
import { FirebaseSubjectRepository } from '../repositories/FirebaseSubjectRepository';
import { AuthenticationService } from '../security/AuthenticationService';

/**
 * Configure the dependency injection container
 */
export function configureContainer(): Container {
    const container = new Container({
        enableValidation: true,
        enableCircularDependencyDetection: true,
        maxResolutionDepth: 50
    });

    // Register Infrastructure Services (Singletons)
    container.registerSingleton(
        SERVICE_IDENTIFIERS.ConfigurationService,
        () => new ConfigurationService()
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.ErrorReportingService,
        () => {
            const service = new ErrorReportingService();
            service.loadPersistedData();
            return service;
        }
    );


    container.registerSingleton(
        SERVICE_IDENTIFIERS.ApiErrorHandler,
        () => new ApiErrorHandler()
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.EnhancedDataService,
        () => new EnhancedDataService()
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.AIService,
        () => new AIService()
    );

    // Register Infrastructure Repositories (Singletons)
    container.registerSingleton(
        SERVICE_IDENTIFIERS.FirebaseStudentRepository,
        () => new FirebaseStudentRepository()
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.FirebaseSubjectRepository,
        () => new FirebaseSubjectRepository()
    );

    // Register Infrastructure Security (Singletons)
    // Note: AuthenticationService needs IUserRepository which is not yet implemented
    // For now, we'll create a mock implementation
    container.registerSingleton(
        SERVICE_IDENTIFIERS.AuthenticationService,
        () => new AuthenticationService(null as any) // TODO: Implement IUserRepository
    );

    // Register Domain Services (Singletons)
    container.registerSingleton(
        SERVICE_IDENTIFIERS.GradingService,
        () => new GradingService()
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.ReportingService,
        (gradingService) => new ReportingService(gradingService),
        [SERVICE_IDENTIFIERS.GradingService]
    );

    // Register Domain Use Cases (Transient - new instance per request)
    container.registerTransient(
        SERVICE_IDENTIFIERS.StudentUseCases,
        (studentRepo, subjectRepo) => new StudentUseCases(studentRepo, subjectRepo),
        [SERVICE_IDENTIFIERS.FirebaseStudentRepository, SERVICE_IDENTIFIERS.FirebaseSubjectRepository]
    );

    container.registerTransient(
        SERVICE_IDENTIFIERS.SubjectUseCases,
        (subjectRepo, studentRepo) => new SubjectUseCases(subjectRepo, studentRepo),
        [SERVICE_IDENTIFIERS.FirebaseSubjectRepository, SERVICE_IDENTIFIERS.FirebaseStudentRepository]
    );

    // Note: ExamUseCases requires IExamRepository which is not yet implemented
    // For now, we'll skip this registration
    // container.registerTransient(
    //     SERVICE_IDENTIFIERS.ExamUseCases,
    //     (examRepo, studentRepo, subjectRepo) => new ExamUseCases(examRepo, studentRepo, subjectRepo),
    //     [SERVICE_IDENTIFIERS.IExamRepository, SERVICE_IDENTIFIERS.FirebaseStudentRepository, SERVICE_IDENTIFIERS.FirebaseSubjectRepository]
    // );

    // Register interface mappings (map interfaces to concrete implementations)
    registerInterfaceMappings(container);

    return container;
}

/**
 * Register interface to implementation mappings
 */
function registerInterfaceMappings(container: Container): void {
    // Map domain interfaces to infrastructure implementations
    container.registerSingleton(
        SERVICE_IDENTIFIERS.IStudentRepository,
        (repo) => repo,
        [SERVICE_IDENTIFIERS.FirebaseStudentRepository]
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.ISubjectRepository,
        (repo) => repo,
        [SERVICE_IDENTIFIERS.FirebaseSubjectRepository]
    );

    container.registerSingleton(
        SERVICE_IDENTIFIERS.IErrorReporter,
        (service) => service,
        [SERVICE_IDENTIFIERS.ErrorReportingService]
    );



    container.registerSingleton(
        SERVICE_IDENTIFIERS.IApiErrorHandler,
        (handler) => handler,
        [SERVICE_IDENTIFIERS.ApiErrorHandler]
    );
}

/**
 * Validate container configuration
 */
export function validateContainerConfiguration(container: Container): void {
    const validation = container.validate();

    if (!validation.isValid) {
        console.error('Container validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Container configuration is invalid');
    }

    if (validation.warnings.length > 0) {
        console.warn('Container validation warnings:');
        validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // Runtime dependency validation
    try {
        const { validateDependenciesAndThrow } = require('./DependencyValidator');
        validateDependenciesAndThrow(container);
    } catch (error) {
        console.error('Runtime dependency validation failed:', error.message);
        throw error;
    }

    console.log('Container configuration validated successfully');
}

/**
 * Get a pre-configured container instance
 */
let containerInstance: Container | null = null;

export function getContainer(): Container {
    if (!containerInstance) {
        containerInstance = configureContainer();

        // Validate configuration in development
        if (process.env.NODE_ENV === 'development') {
            validateContainerConfiguration(containerInstance);
        }
    }

    return containerInstance;
}

/**
 * Reset the container instance (useful for testing)
 */
export function resetContainer(): void {
    if (containerInstance) {
        containerInstance.dispose();
        containerInstance = null;
    }
}