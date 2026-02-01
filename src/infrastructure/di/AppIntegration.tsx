/**
 * App Integration for Dependency Injection
 * Shows how to integrate the DI system with the React application
 */

import React from 'react';
import { ServiceProvider, getServiceLocator } from './ServiceLocator';
import { getContainer, validateContainerConfiguration } from './ContainerConfig';

/**
 * Initialize the DI system for the application
 */
export function initializeDependencyInjection(): void {
    try {
        // Get the configured container
        const container = getContainer();

        // Validate configuration in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Validating dependency injection configuration...');
            validateContainerConfiguration(container);
            console.log('Dependency injection system initialized successfully');
        }

        // Pre-warm critical services
        const serviceLocator = getServiceLocator();

        // Initialize error reporting service
        const errorReporter = serviceLocator.getErrorReportingService();
        console.log('Error reporting service initialized');



        // Initialize configuration service
        const configService = serviceLocator.getConfigurationService();
        console.log('Configuration service initialized');

    } catch (error) {
        console.error('Failed to initialize dependency injection system:', error);
        throw error;
    }
}

/**
 * Higher-order component to wrap the app with DI services
 */
export function withDependencyInjection<P extends object>(
    WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
    return function WithDIComponent(props: P) {
        // Initialize DI system on first render
        React.useEffect(() => {
            initializeDependencyInjection();
        }, []);

        return (
            <ServiceProvider>
                <WrappedComponent {...props} />
            </ServiceProvider>
        );
    };
}

/**
 * Hook to access services in React components
 */
export function useAppServices() {
    const serviceLocator = getServiceLocator();

    return {
        // Domain services
        studentUseCases: serviceLocator.getStudentUseCases(),
        subjectUseCases: serviceLocator.getSubjectUseCases(),
        examUseCases: serviceLocator.getExamUseCases(),
        gradingService: serviceLocator.getGradingService(),
        reportingService: serviceLocator.getReportingService(),

        // Infrastructure services (for presentation layer)
        errorReporter: serviceLocator.getErrorReportingService(),
        configService: serviceLocator.getConfigurationService(),
        aiService: serviceLocator.getAIService(),
        authService: serviceLocator.getAuthenticationService(),

        // Repository interfaces (through domain interfaces)
        studentRepository: serviceLocator.getStudentRepository(),
        subjectRepository: serviceLocator.getSubjectRepository(),
    };
}

/**
 * Component to display DI system status (for debugging)
 */
export const DISystemStatus: React.FC = () => {
    const [status, setStatus] = React.useState<{
        initialized: boolean;
        servicesCount: number;
        errors: string[];
    }>({
        initialized: false,
        servicesCount: 0,
        errors: []
    });

    React.useEffect(() => {
        try {
            const container = getContainer();
            const services = container.getRegisteredServices();
            const validation = container.validate();

            setStatus({
                initialized: true,
                servicesCount: services.length,
                errors: validation.errors
            });
        } catch (error) {
            setStatus({
                initialized: false,
                servicesCount: 0,
                errors: [error.message]
            });
        }
    }, []);

    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded text-xs">
            <div>DI System: {status.initialized ? '✅' : '❌'}</div>
            <div>Services: {status.servicesCount}</div>
            {status.errors.length > 0 && (
                <div className="text-red-400">
                    Errors: {status.errors.length}
                </div>
            )}
        </div>
    );
};

/**
 * Example of how to use services in a component
 */
export const ExampleServiceUsage: React.FC = () => {
    const services = useAppServices();

    const handleCreateStudent = async () => {
        try {
            const studentId = await services.studentUseCases.createStudent({
                adNo: 'TEST001',
                name: 'Test Student',
                className: 'S1',
                semester: 'Odd'
            });
            console.log('Student created:', studentId);
        } catch (error) {
            services.errorReporter.reportError({
                id: 'student-creation-error',
                type: 'validation_error',
                severity: 'medium',
                message: error.message,
                context: { action: 'createStudent' },
                timestamp: new Date()
            });
        }
    };

    return (
        <div>
            <button onClick={handleCreateStudent}>
                Create Test Student
            </button>
        </div>
    );
};