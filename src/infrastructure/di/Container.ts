/**
 * Dependency Injection Container
 * Implements IoC (Inversion of Control) pattern for Clean Architecture
 */

export type ServiceIdentifier<T = any> = string | symbol | (new (...args: any[]) => T);
export type Factory<T = any> = (...args: any[]) => T;
export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

export interface ServiceDescriptor<T = any> {
    identifier: ServiceIdentifier<T>;
    factory: Factory<T>;
    lifetime: ServiceLifetime;
    dependencies?: ServiceIdentifier[];
}

export interface ContainerOptions {
    enableValidation?: boolean;
    enableCircularDependencyDetection?: boolean;
    maxResolutionDepth?: number;
}

export class Container {
    private services = new Map<ServiceIdentifier, ServiceDescriptor>();
    private singletonInstances = new Map<ServiceIdentifier, any>();
    private scopedInstances = new Map<ServiceIdentifier, any>();
    private resolutionStack: ServiceIdentifier[] = [];
    private options: Required<ContainerOptions>;

    constructor(options: ContainerOptions = {}) {
        this.options = {
            enableValidation: true,
            enableCircularDependencyDetection: true,
            maxResolutionDepth: 50,
            ...options
        };
    }

    /**
     * Register a service with the container
     */
    register<T>(descriptor: ServiceDescriptor<T>): this {
        if (this.options.enableValidation) {
            this.validateServiceDescriptor(descriptor);
        }

        this.services.set(descriptor.identifier, descriptor);
        return this;
    }

    /**
     * Register a singleton service
     */
    registerSingleton<T>(
        identifier: ServiceIdentifier<T>,
        factory: Factory<T>,
        dependencies?: ServiceIdentifier[]
    ): this {
        return this.register({
            identifier,
            factory,
            lifetime: 'singleton',
            dependencies
        });
    }

    /**
     * Register a transient service
     */
    registerTransient<T>(
        identifier: ServiceIdentifier<T>,
        factory: Factory<T>,
        dependencies?: ServiceIdentifier[]
    ): this {
        return this.register({
            identifier,
            factory,
            lifetime: 'transient',
            dependencies
        });
    }

    /**
     * Register a scoped service
     */
    registerScoped<T>(
        identifier: ServiceIdentifier<T>,
        factory: Factory<T>,
        dependencies?: ServiceIdentifier[]
    ): this {
        return this.register({
            identifier,
            factory,
            lifetime: 'scoped',
            dependencies
        });
    }

    /**
     * Resolve a service from the container
     */
    resolve<T>(identifier: ServiceIdentifier<T>): T {
        try {
            return this.resolveInternal(identifier);
        } catch (error) {
            throw new Error(`Failed to resolve service '${String(identifier)}': ${error.message}`);
        }
    }

    /**
     * Try to resolve a service, returning null if not found
     */
    tryResolve<T>(identifier: ServiceIdentifier<T>): T | null {
        try {
            return this.resolve(identifier);
        } catch {
            return null;
        }
    }

    /**
     * Check if a service is registered
     */
    isRegistered(identifier: ServiceIdentifier): boolean {
        return this.services.has(identifier);
    }

    /**
     * Get all registered service identifiers
     */
    getRegisteredServices(): ServiceIdentifier[] {
        return Array.from(this.services.keys());
    }

    /**
     * Validate the container configuration
     */
    validate(): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for missing dependencies
        for (const [identifier, descriptor] of this.services) {
            if (descriptor.dependencies) {
                for (const dependency of descriptor.dependencies) {
                    if (!this.services.has(dependency)) {
                        errors.push(`Service '${String(identifier)}' depends on unregistered service '${String(dependency)}'`);
                    }
                }
            }
        }

        // Check for circular dependencies
        if (this.options.enableCircularDependencyDetection) {
            const circularDeps = this.detectCircularDependencies();
            if (circularDeps.length > 0) {
                errors.push(`Circular dependencies detected: ${circularDeps.join(' -> ')}`);
            }
        }

        // Check for dependency direction violations (domain layer dependencies)
        const violations = this.validateDependencyDirection();
        errors.push(...violations);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Clear scoped instances (useful for request/response cycles)
     */
    clearScope(): void {
        this.scopedInstances.clear();
    }

    /**
     * Dispose of the container and all singleton instances
     */
    dispose(): void {
        // Dispose singleton instances that implement IDisposable
        for (const instance of this.singletonInstances.values()) {
            if (instance && typeof instance.dispose === 'function') {
                try {
                    instance.dispose();
                } catch (error) {
                    console.warn('Error disposing service:', error);
                }
            }
        }

        this.services.clear();
        this.singletonInstances.clear();
        this.scopedInstances.clear();
        this.resolutionStack = [];
    }

    private resolveInternal<T>(identifier: ServiceIdentifier<T>): T {
        // Check resolution depth
        if (this.resolutionStack.length >= this.options.maxResolutionDepth) {
            throw new Error(`Maximum resolution depth exceeded (${this.options.maxResolutionDepth})`);
        }

        // Check for circular dependencies
        if (this.options.enableCircularDependencyDetection && this.resolutionStack.includes(identifier)) {
            const cycle = [...this.resolutionStack, identifier].map(id => String(id)).join(' -> ');
            throw new Error(`Circular dependency detected: ${cycle}`);
        }

        const descriptor = this.services.get(identifier);
        if (!descriptor) {
            throw new Error(`Service '${String(identifier)}' is not registered`);
        }

        // Check for existing instances based on lifetime
        switch (descriptor.lifetime) {
            case 'singleton':
                if (this.singletonInstances.has(identifier)) {
                    return this.singletonInstances.get(identifier);
                }
                break;
            case 'scoped':
                if (this.scopedInstances.has(identifier)) {
                    return this.scopedInstances.get(identifier);
                }
                break;
            case 'transient':
                // Always create new instance
                break;
        }

        // Add to resolution stack
        this.resolutionStack.push(identifier);

        try {
            // Resolve dependencies
            const dependencies = descriptor.dependencies || [];
            const resolvedDependencies = dependencies.map(dep => this.resolveInternal(dep));

            // Create instance
            const instance = descriptor.factory(...resolvedDependencies);

            // Store instance based on lifetime
            switch (descriptor.lifetime) {
                case 'singleton':
                    this.singletonInstances.set(identifier, instance);
                    break;
                case 'scoped':
                    this.scopedInstances.set(identifier, instance);
                    break;
            }

            return instance;
        } finally {
            // Remove from resolution stack
            this.resolutionStack.pop();
        }
    }

    private validateServiceDescriptor<T>(descriptor: ServiceDescriptor<T>): void {
        if (!descriptor.identifier) {
            throw new Error('Service descriptor must have an identifier');
        }

        if (!descriptor.factory || typeof descriptor.factory !== 'function') {
            throw new Error('Service descriptor must have a valid factory function');
        }

        if (!['singleton', 'transient', 'scoped'].includes(descriptor.lifetime)) {
            throw new Error('Service descriptor must have a valid lifetime');
        }
    }

    private detectCircularDependencies(): string[] {
        const visited = new Set<ServiceIdentifier>();
        const recursionStack = new Set<ServiceIdentifier>();
        const cycles: string[] = [];

        const visit = (identifier: ServiceIdentifier, path: ServiceIdentifier[]): void => {
            if (recursionStack.has(identifier)) {
                const cycleStart = path.indexOf(identifier);
                const cycle = path.slice(cycleStart).concat(identifier).map(id => String(id));
                cycles.push(cycle.join(' -> '));
                return;
            }

            if (visited.has(identifier)) {
                return;
            }

            visited.add(identifier);
            recursionStack.add(identifier);

            const descriptor = this.services.get(identifier);
            if (descriptor?.dependencies) {
                for (const dependency of descriptor.dependencies) {
                    visit(dependency, [...path, identifier]);
                }
            }

            recursionStack.delete(identifier);
        };

        for (const identifier of this.services.keys()) {
            if (!visited.has(identifier)) {
                visit(identifier, []);
            }
        }

        return cycles;
    }

    private validateDependencyDirection(): string[] {
        const violations: string[] = [];

        // Define layer patterns
        const domainPattern = /^src\/domain\//;
        const infrastructurePattern = /^src\/infrastructure\//;
        const presentationPattern = /^src\/presentation\//;

        for (const [identifier, descriptor] of this.services) {
            const serviceName = String(identifier);

            // Determine service layer
            let serviceLayer: 'domain' | 'infrastructure' | 'presentation' | 'unknown' = 'unknown';
            if (domainPattern.test(serviceName)) serviceLayer = 'domain';
            else if (infrastructurePattern.test(serviceName)) serviceLayer = 'infrastructure';
            else if (presentationPattern.test(serviceName)) serviceLayer = 'presentation';

            if (descriptor.dependencies) {
                for (const dependency of descriptor.dependencies) {
                    const dependencyName = String(dependency);

                    // Determine dependency layer
                    let dependencyLayer: 'domain' | 'infrastructure' | 'presentation' | 'unknown' = 'unknown';
                    if (domainPattern.test(dependencyName)) dependencyLayer = 'domain';
                    else if (infrastructurePattern.test(dependencyName)) dependencyLayer = 'infrastructure';
                    else if (presentationPattern.test(dependencyName)) dependencyLayer = 'presentation';

                    // Check for violations
                    if (serviceLayer === 'domain' && (dependencyLayer === 'infrastructure' || dependencyLayer === 'presentation')) {
                        violations.push(`Domain service '${serviceName}' cannot depend on ${dependencyLayer} service '${dependencyName}'`);
                    }

                    if (serviceLayer === 'infrastructure' && dependencyLayer === 'presentation') {
                        violations.push(`Infrastructure service '${serviceName}' cannot depend on presentation service '${dependencyName}'`);
                    }
                }
            }
        }

        return violations;
    }
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Service identifiers (symbols for type safety)
export const SERVICE_IDENTIFIERS = {
    // Domain interfaces
    IStudentRepository: Symbol('IStudentRepository'),
    ISubjectRepository: Symbol('ISubjectRepository'),
    IExamRepository: Symbol('IExamRepository'),
    IUserRepository: Symbol('IUserRepository'),
    IErrorReporter: Symbol('IErrorReporter'),
    IApiErrorHandler: Symbol('IApiErrorHandler'),

    // Domain services
    GradingService: Symbol('GradingService'),
    ReportingService: Symbol('ReportingService'),

    // Domain use cases
    StudentUseCases: Symbol('StudentUseCases'),
    SubjectUseCases: Symbol('SubjectUseCases'),
    ExamUseCases: Symbol('ExamUseCases'),

    // Infrastructure services
    ConfigurationService: Symbol('ConfigurationService'),
    AIService: Symbol('AIService'),
    ErrorReportingService: Symbol('ErrorReportingService'),
    ApiErrorHandler: Symbol('ApiErrorHandler'),
    EnhancedDataService: Symbol('EnhancedDataService'),

    // Infrastructure repositories
    FirebaseStudentRepository: Symbol('FirebaseStudentRepository'),
    FirebaseSubjectRepository: Symbol('FirebaseSubjectRepository'),

    // Infrastructure security
    AuthenticationService: Symbol('AuthenticationService'),
} as const;