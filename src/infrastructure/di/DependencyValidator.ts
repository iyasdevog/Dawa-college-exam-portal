/**
 * Runtime Dependency Validation
 * Validates that dependencies flow inward toward domain layer
 */

import { Container, SERVICE_IDENTIFIERS } from './Container';

export interface DependencyValidationRule {
    name: string;
    validate: (container: Container) => ValidationViolation[];
}

export interface ValidationViolation {
    rule: string;
    severity: 'error' | 'warning';
    message: string;
    service?: string;
    dependency?: string;
}

export interface LayerInfo {
    name: string;
    pattern: RegExp;
    allowedDependencies: string[];
}

export class DependencyValidator {
    private rules: DependencyValidationRule[] = [];
    private layers: LayerInfo[] = [
        {
            name: 'domain',
            pattern: /^(domain|Domain|.*Domain.*|.*UseCase.*|.*Service.*|.*Entity.*)/,
            allowedDependencies: ['domain']
        },
        {
            name: 'infrastructure',
            pattern: /^(infrastructure|Infrastructure|.*Repository.*|.*Config.*|.*Security.*)/,
            allowedDependencies: ['domain', 'infrastructure']
        },
        {
            name: 'presentation',
            pattern: /^(presentation|Presentation|.*Component.*|.*View.*|.*Controller.*)/,
            allowedDependencies: ['domain', 'presentation']
        }
    ];

    constructor() {
        this.initializeDefaultRules();
    }

    /**
     * Add a custom validation rule
     */
    addRule(rule: DependencyValidationRule): void {
        this.rules.push(rule);
    }

    /**
     * Validate container dependencies
     */
    validate(container: Container): ValidationViolation[] {
        const violations: ValidationViolation[] = [];

        for (const rule of this.rules) {
            try {
                const ruleViolations = rule.validate(container);
                violations.push(...ruleViolations);
            } catch (error) {
                violations.push({
                    rule: rule.name,
                    severity: 'error',
                    message: `Rule validation failed: ${error.message}`
                });
            }
        }

        return violations;
    }

    /**
     * Validate and throw if there are errors
     */
    validateAndThrow(container: Container): void {
        const violations = this.validate(container);
        const errors = violations.filter(v => v.severity === 'error');

        if (errors.length > 0) {
            const errorMessages = errors.map(e => `${e.rule}: ${e.message}`);
            throw new Error(`Dependency validation failed:\n${errorMessages.join('\n')}`);
        }

        const warnings = violations.filter(v => v.severity === 'warning');
        if (warnings.length > 0) {
            console.warn('Dependency validation warnings:');
            warnings.forEach(w => console.warn(`  ${w.rule}: ${w.message}`));
        }
    }

    private initializeDefaultRules(): void {
        // Rule 1: Domain layer cannot depend on infrastructure or presentation
        this.addRule({
            name: 'DomainLayerIndependence',
            validate: (container) => {
                const violations: ValidationViolation[] = [];
                const services = container.getRegisteredServices();

                for (const serviceId of services) {
                    const serviceName = String(serviceId);
                    const serviceLayer = this.getServiceLayer(serviceName);

                    if (serviceLayer === 'domain') {
                        // Check if this domain service has any non-domain dependencies
                        const descriptor = (container as any).services.get(serviceId);
                        if (descriptor?.dependencies) {
                            for (const depId of descriptor.dependencies) {
                                const depName = String(depId);
                                const depLayer = this.getServiceLayer(depName);

                                if (depLayer === 'infrastructure' || depLayer === 'presentation') {
                                    violations.push({
                                        rule: 'DomainLayerIndependence',
                                        severity: 'error',
                                        message: `Domain service '${serviceName}' cannot depend on ${depLayer} service '${depName}'`,
                                        service: serviceName,
                                        dependency: depName
                                    });
                                }
                            }
                        }
                    }
                }

                return violations;
            }
        });

        // Rule 2: Infrastructure layer cannot depend on presentation
        this.addRule({
            name: 'InfrastructureLayerSeparation',
            validate: (container) => {
                const violations: ValidationViolation[] = [];
                const services = container.getRegisteredServices();

                for (const serviceId of services) {
                    const serviceName = String(serviceId);
                    const serviceLayer = this.getServiceLayer(serviceName);

                    if (serviceLayer === 'infrastructure') {
                        const descriptor = (container as any).services.get(serviceId);
                        if (descriptor?.dependencies) {
                            for (const depId of descriptor.dependencies) {
                                const depName = String(depId);
                                const depLayer = this.getServiceLayer(depName);

                                if (depLayer === 'presentation') {
                                    violations.push({
                                        rule: 'InfrastructureLayerSeparation',
                                        severity: 'error',
                                        message: `Infrastructure service '${serviceName}' cannot depend on presentation service '${depName}'`,
                                        service: serviceName,
                                        dependency: depName
                                    });
                                }
                            }
                        }
                    }
                }

                return violations;
            }
        });

        // Rule 3: Interface segregation - services should depend on interfaces, not concrete implementations
        this.addRule({
            name: 'InterfaceSegregation',
            validate: (container) => {
                const violations: ValidationViolation[] = [];
                const services = container.getRegisteredServices();

                for (const serviceId of services) {
                    const serviceName = String(serviceId);
                    const serviceLayer = this.getServiceLayer(serviceName);

                    // Domain services should only depend on interfaces
                    if (serviceLayer === 'domain') {
                        const descriptor = (container as any).services.get(serviceId);
                        if (descriptor?.dependencies) {
                            for (const depId of descriptor.dependencies) {
                                const depName = String(depId);

                                // Check if dependency is a concrete implementation rather than interface
                                if (!depName.startsWith('I') && !depName.includes('Interface')) {
                                    const depLayer = this.getServiceLayer(depName);
                                    if (depLayer === 'infrastructure') {
                                        violations.push({
                                            rule: 'InterfaceSegregation',
                                            severity: 'warning',
                                            message: `Domain service '${serviceName}' should depend on interface rather than concrete implementation '${depName}'`,
                                            service: serviceName,
                                            dependency: depName
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                return violations;
            }
        });

        // Rule 4: Circular dependency detection
        this.addRule({
            name: 'CircularDependencyDetection',
            validate: (container) => {
                const violations: ValidationViolation[] = [];

                try {
                    const validation = container.validate();
                    if (!validation.isValid) {
                        const circularErrors = validation.errors.filter(e => e.includes('Circular'));
                        for (const error of circularErrors) {
                            violations.push({
                                rule: 'CircularDependencyDetection',
                                severity: 'error',
                                message: error
                            });
                        }
                    }
                } catch (error) {
                    violations.push({
                        rule: 'CircularDependencyDetection',
                        severity: 'error',
                        message: `Circular dependency validation failed: ${error.message}`
                    });
                }

                return violations;
            }
        });

        // Rule 5: Service lifetime consistency
        this.addRule({
            name: 'ServiceLifetimeConsistency',
            validate: (container) => {
                const violations: ValidationViolation[] = [];
                const services = container.getRegisteredServices();

                for (const serviceId of services) {
                    const serviceName = String(serviceId);
                    const descriptor = (container as any).services.get(serviceId);

                    if (descriptor) {
                        // Domain services should typically be singletons or transient
                        const serviceLayer = this.getServiceLayer(serviceName);

                        if (serviceLayer === 'domain' && descriptor.lifetime === 'scoped') {
                            violations.push({
                                rule: 'ServiceLifetimeConsistency',
                                severity: 'warning',
                                message: `Domain service '${serviceName}' uses scoped lifetime, consider singleton or transient`,
                                service: serviceName
                            });
                        }

                        // Infrastructure services should typically be singletons
                        if (serviceLayer === 'infrastructure' && descriptor.lifetime === 'transient') {
                            violations.push({
                                rule: 'ServiceLifetimeConsistency',
                                severity: 'warning',
                                message: `Infrastructure service '${serviceName}' uses transient lifetime, consider singleton for better performance`,
                                service: serviceName
                            });
                        }
                    }
                }

                return violations;
            }
        });
    }

    private getServiceLayer(serviceName: string): 'domain' | 'infrastructure' | 'presentation' | 'unknown' {
        for (const layer of this.layers) {
            if (layer.pattern.test(serviceName)) {
                return layer.name as 'domain' | 'infrastructure' | 'presentation';
            }
        }
        return 'unknown';
    }
}

/**
 * Create a dependency validator with default rules
 */
export function createDependencyValidator(): DependencyValidator {
    return new DependencyValidator();
}

/**
 * Validate container with default rules
 */
export function validateDependencies(container: Container): ValidationViolation[] {
    const validator = createDependencyValidator();
    return validator.validate(container);
}

/**
 * Validate container and throw on errors
 */
export function validateDependenciesAndThrow(container: Container): void {
    const validator = createDependencyValidator();
    validator.validateAndThrow(container);
}