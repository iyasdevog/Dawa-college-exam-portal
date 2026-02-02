export interface AppConfig {
    firebase: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
        measurementId?: string;
    };
    gemini?: {
        apiKey: string;
    };
    environment: 'development' | 'production' | 'test';
    features: {
        offlineMode: boolean;
        aiAnalysis: boolean;
        realTimeSync: boolean;
        pwaEnabled: boolean;
    };
    security: {
        sessionTimeout: number;
        maxLoginAttempts: number;
        lockoutDuration: number;
    };
}

export class ConfigurationService {
    private config: AppConfig | null = null;
    private validationErrors: string[] = [];

    constructor() {
        this.loadConfiguration();
    }

    private loadConfiguration(): void {
        try {
            // Load from environment variables
            const firebaseConfig = {
                apiKey: this.getEnvVar('VITE_FIREBASE_API_KEY', ''),
                authDomain: this.getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', ''),
                projectId: this.getEnvVar('VITE_FIREBASE_PROJECT_ID', ''),
                storageBucket: this.getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', ''),
                messagingSenderId: this.getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', ''),
                appId: this.getEnvVar('VITE_FIREBASE_APP_ID', ''),
                measurementId: this.getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', '', false)
            };

            const geminiApiKey = this.getEnvVar('VITE_GEMINI_API_KEY', '', false);

            this.config = {
                firebase: firebaseConfig,
                gemini: geminiApiKey ? { apiKey: geminiApiKey } : undefined,
                environment: this.determineEnvironment(),
                features: {
                    offlineMode: this.getBooleanEnvVar('VITE_OFFLINE_MODE', true),
                    aiAnalysis: !!geminiApiKey,
                    realTimeSync: this.getBooleanEnvVar('VITE_REALTIME_SYNC', true),
                    pwaEnabled: this.getBooleanEnvVar('VITE_PWA_ENABLED', true)
                },
                security: {
                    sessionTimeout: this.getNumberEnvVar('VITE_SESSION_TIMEOUT', 3600000), // 1 hour
                    maxLoginAttempts: this.getNumberEnvVar('VITE_MAX_LOGIN_ATTEMPTS', 5),
                    lockoutDuration: this.getNumberEnvVar('VITE_LOCKOUT_DURATION', 900000) // 15 minutes
                }
            };

            this.validateConfiguration();
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.validationErrors.push('Failed to load configuration');
        }
    }

    private getEnvVar(key: string, defaultValue: string, required: boolean = true): string {
        const value = (import.meta as any).env?.[key] || defaultValue;

        if (required && !value) {
            this.validationErrors.push(`Required environment variable ${key} is missing`);
            return defaultValue;
        }

        return value;
    }

    private getBooleanEnvVar(key: string, defaultValue: boolean): boolean {
        const value = (import.meta as any).env?.[key];
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true';
    }

    private getNumberEnvVar(key: string, defaultValue: number): number {
        const value = (import.meta as any).env?.[key];
        if (value === undefined) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    private determineEnvironment(): 'development' | 'production' | 'test' {
        const nodeEnv = (import.meta as any).env?.NODE_ENV;
        const mode = (import.meta as any).env?.MODE;

        if (nodeEnv === 'test' || mode === 'test') return 'test';
        if (nodeEnv === 'production' || mode === 'production') return 'production';
        return 'development';
    }

    private validateConfiguration(): void {
        if (!this.config) {
            this.validationErrors.push('Configuration not loaded');
            return;
        }

        // Validate Firebase configuration
        const requiredFirebaseFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        for (const field of requiredFirebaseFields) {
            if (!this.config.firebase[field as keyof typeof this.config.firebase]) {
                this.validationErrors.push(`Firebase ${field} is required`);
            }
        }

        // Validate security configuration
        if (this.config.security.sessionTimeout < 60000) { // Minimum 1 minute
            this.validationErrors.push('Session timeout must be at least 1 minute');
        }

        if (this.config.security.maxLoginAttempts < 1) {
            this.validationErrors.push('Max login attempts must be at least 1');
        }

        if (this.config.security.lockoutDuration < 60000) { // Minimum 1 minute
            this.validationErrors.push('Lockout duration must be at least 1 minute');
        }
    }

    getConfig(): AppConfig {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        if (this.validationErrors.length > 0) {
            console.warn('Configuration validation errors:', this.validationErrors);
        }

        return this.config;
    }

    getFirebaseConfig() {
        return this.getConfig().firebase;
    }

    getGeminiConfig() {
        return this.getConfig().gemini;
    }

    isProduction(): boolean {
        return this.getConfig().environment === 'production';
    }

    isDevelopment(): boolean {
        return this.getConfig().environment === 'development';
    }

    isTest(): boolean {
        return this.getConfig().environment === 'test';
    }

    isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
        return this.getConfig().features[feature];
    }

    getSecurityConfig() {
        return this.getConfig().security;
    }

    getValidationErrors(): string[] {
        return [...this.validationErrors];
    }

    hasValidationErrors(): boolean {
        return this.validationErrors.length > 0;
    }

    // Hot reload configuration (for development)
    reloadConfiguration(): void {
        this.config = null;
        this.validationErrors = [];
        this.loadConfiguration();
    }

    // Sanitize configuration for logging (remove sensitive data)
    getSanitizedConfig(): Partial<AppConfig> {
        const config = this.getConfig();
        return {
            environment: config.environment,
            features: config.features,
            security: {
                sessionTimeout: config.security.sessionTimeout,
                maxLoginAttempts: config.security.maxLoginAttempts,
                lockoutDuration: config.security.lockoutDuration
            },
            firebase: {
                authDomain: config.firebase.authDomain,
                projectId: config.firebase.projectId,
                storageBucket: config.firebase.storageBucket,
                messagingSenderId: config.firebase.messagingSenderId,
                appId: config.firebase.appId,
                measurementId: config.firebase.measurementId,
                apiKey: config.firebase.apiKey ? '[REDACTED]' : undefined
            } as any,
            gemini: config.gemini ? { apiKey: '[REDACTED]' } : undefined
        };
    }
}

// Export singleton instance
export const configurationService = new ConfigurationService();