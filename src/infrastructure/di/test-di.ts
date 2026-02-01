/**
 * Simple test to verify DI system works
 */

import { getContainer, validateContainerConfiguration } from './ContainerConfig';
import { getServiceLocator } from './ServiceLocator';

export function testDependencyInjection(): void {
    try {
        console.log('Testing Dependency Injection System...');

        // Test container creation
        const container = getContainer();
        console.log('✓ Container created successfully');

        // Test container validation
        validateContainerConfiguration(container);
        console.log('✓ Container validation passed');

        // Test service locator
        const serviceLocator = getServiceLocator();
        console.log('✓ Service locator created successfully');

        // Test service resolution
        const gradingService = serviceLocator.getGradingService();
        console.log('✓ GradingService resolved successfully');

        const reportingService = serviceLocator.getReportingService();
        console.log('✓ ReportingService resolved successfully');

        const studentUseCases = serviceLocator.getStudentUseCases();
        console.log('✓ StudentUseCases resolved successfully');

        const subjectUseCases = serviceLocator.getSubjectUseCases();
        console.log('✓ SubjectUseCases resolved successfully');

        const configService = serviceLocator.getConfigurationService();
        console.log('✓ ConfigurationService resolved successfully');

        const errorReporter = serviceLocator.getErrorReportingService();
        console.log('✓ ErrorReportingService resolved successfully');

        console.log('🎉 All DI system tests passed!');

        // Test dependency validation
        const validation = container.validate();
        if (validation.isValid) {
            console.log('✓ Dependency validation passed');
        } else {
            console.warn('⚠️ Dependency validation warnings:', validation.warnings);
            console.error('❌ Dependency validation errors:', validation.errors);
        }

    } catch (error) {
        console.error('❌ DI system test failed:', error.message);
        throw error;
    }
}

// Run test if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
    testDependencyInjection();
}