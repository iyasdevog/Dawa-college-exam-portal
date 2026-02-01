/**
 * Form Validation and Real-time Feedback System
 * Implements Requirements 8.4 - Form optimization with appropriate input types and real-time validation
 */

export interface ValidationRule {
    type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'number' | 'range' | 'custom';
    value?: any;
    message: string;
    validator?: (value: any) => boolean;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface FieldValidation {
    rules: ValidationRule[];
    debounceMs?: number;
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
}

export interface FormValidationConfig {
    [fieldName: string]: FieldValidation;
}

/**
 * Real-time Form Validator
 * Provides comprehensive form validation with mobile-optimized feedback
 */
export class FormValidator {
    private config: FormValidationConfig;
    private values: Record<string, any> = {};
    private errors: Record<string, string[]> = {};
    private warnings: Record<string, string[]> = {};
    private touched: Record<string, boolean> = {};
    private debounceTimers: Record<string, NodeJS.Timeout> = {};

    constructor(config: FormValidationConfig) {
        this.config = config;
    }

    /**
     * Validate a single field
     */
    validateField(fieldName: string, value: any): ValidationResult {
        const fieldConfig = this.config[fieldName];
        if (!fieldConfig) {
            return { isValid: true, errors: [], warnings: [] };
        }

        const errors: string[] = [];
        const warnings: string[] = [];

        for (const rule of fieldConfig.rules) {
            const result = this.applyRule(rule, value, fieldName);
            if (!result.isValid) {
                errors.push(result.message);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Apply a single validation rule
     */
    private applyRule(rule: ValidationRule, value: any, fieldName: string): { isValid: boolean; message: string } {
        switch (rule.type) {
            case 'required':
                return {
                    isValid: value !== null && value !== undefined && value !== '',
                    message: rule.message
                };

            case 'minLength':
                return {
                    isValid: !value || value.toString().length >= rule.value,
                    message: rule.message
                };

            case 'maxLength':
                return {
                    isValid: !value || value.toString().length <= rule.value,
                    message: rule.message
                };

            case 'pattern':
                const regex = new RegExp(rule.value);
                return {
                    isValid: !value || regex.test(value.toString()),
                    message: rule.message
                };

            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return {
                    isValid: !value || emailRegex.test(value.toString()),
                    message: rule.message
                };

            case 'number':
                return {
                    isValid: !value || !isNaN(Number(value)),
                    message: rule.message
                };

            case 'range':
                const numValue = Number(value);
                const { min, max } = rule.value;
                return {
                    isValid: !value || (numValue >= min && numValue <= max),
                    message: rule.message
                };

            case 'custom':
                return {
                    isValid: !value || !rule.validator || rule.validator(value),
                    message: rule.message
                };

            default:
                return { isValid: true, message: '' };
        }
    }

    /**
     * Validate entire form
     */
    validateForm(values: Record<string, any>): { isValid: boolean; errors: Record<string, string[]> } {
        this.values = values;
        const formErrors: Record<string, string[]> = {};
        let isFormValid = true;

        for (const fieldName in this.config) {
            const result = this.validateField(fieldName, values[fieldName]);
            if (!result.isValid) {
                formErrors[fieldName] = result.errors;
                isFormValid = false;
            }
        }

        this.errors = formErrors;
        return { isValid: isFormValid, errors: formErrors };
    }

    /**
     * Handle field change with debounced validation
     */
    handleFieldChange(
        fieldName: string,
        value: any,
        callback: (result: ValidationResult) => void
    ): void {
        this.values[fieldName] = value;
        const fieldConfig = this.config[fieldName];

        if (!fieldConfig || !fieldConfig.validateOnChange) {
            return;
        }

        // Clear existing timer
        if (this.debounceTimers[fieldName]) {
            clearTimeout(this.debounceTimers[fieldName]);
        }

        // Set up debounced validation
        const debounceMs = fieldConfig.debounceMs || 300;
        this.debounceTimers[fieldName] = setTimeout(() => {
            const result = this.validateField(fieldName, value);
            this.errors[fieldName] = result.errors;
            this.warnings[fieldName] = result.warnings;
            callback(result);
        }, debounceMs);
    }

    /**
     * Handle field blur with immediate validation
     */
    handleFieldBlur(
        fieldName: string,
        value: any,
        callback: (result: ValidationResult) => void
    ): void {
        this.touched[fieldName] = true;
        this.values[fieldName] = value;
        const fieldConfig = this.config[fieldName];

        if (!fieldConfig || !fieldConfig.validateOnBlur) {
            return;
        }

        const result = this.validateField(fieldName, value);
        this.errors[fieldName] = result.errors;
        this.warnings[fieldName] = result.warnings;
        callback(result);
    }

    /**
     * Get current validation state for a field
     */
    getFieldState(fieldName: string): {
        hasError: boolean;
        errors: string[];
        warnings: string[];
        isTouched: boolean;
    } {
        return {
            hasError: (this.errors[fieldName] || []).length > 0,
            errors: this.errors[fieldName] || [],
            warnings: this.warnings[fieldName] || [],
            isTouched: this.touched[fieldName] || false
        };
    }

    /**
     * Get form summary
     */
    getFormSummary(): {
        isValid: boolean;
        totalErrors: number;
        totalWarnings: number;
        touchedFields: number;
        completedFields: number;
    } {
        const totalErrors = Object.values(this.errors).reduce((sum, errors) => sum + errors.length, 0);
        const totalWarnings = Object.values(this.warnings).reduce((sum, warnings) => sum + warnings.length, 0);
        const touchedFields = Object.values(this.touched).filter(Boolean).length;
        const completedFields = Object.entries(this.values).filter(([_, value]) =>
            value !== null && value !== undefined && value !== ''
        ).length;

        return {
            isValid: totalErrors === 0,
            totalErrors,
            totalWarnings,
            touchedFields,
            completedFields
        };
    }

    /**
     * Clear validation state
     */
    reset(): void {
        this.values = {};
        this.errors = {};
        this.warnings = {};
        this.touched = {};

        // Clear all debounce timers
        Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
        this.debounceTimers = {};
    }

    /**
     * Clear validation for specific field
     */
    clearField(fieldName: string): void {
        delete this.values[fieldName];
        delete this.errors[fieldName];
        delete this.warnings[fieldName];
        delete this.touched[fieldName];

        if (this.debounceTimers[fieldName]) {
            clearTimeout(this.debounceTimers[fieldName]);
            delete this.debounceTimers[fieldName];
        }
    }
}

/**
 * Mobile-optimized input type detection
 */
export const getMobileInputType = (fieldName: string, dataType: string): string => {
    // Map field names to appropriate mobile input types
    const fieldTypeMap: Record<string, string> = {
        email: 'email',
        phone: 'tel',
        telephone: 'tel',
        mobile: 'tel',
        search: 'search',
        url: 'url',
        website: 'url'
    };

    // Check field name first
    const fieldLower = fieldName.toLowerCase();
    for (const [key, type] of Object.entries(fieldTypeMap)) {
        if (fieldLower.includes(key)) {
            return type;
        }
    }

    // Map data types to input types
    const dataTypeMap: Record<string, string> = {
        number: 'number',
        integer: 'number',
        decimal: 'number',
        float: 'number',
        email: 'email',
        phone: 'tel',
        url: 'url',
        search: 'search',
        password: 'password',
        date: 'date',
        time: 'time',
        datetime: 'datetime-local'
    };

    return dataTypeMap[dataType.toLowerCase()] || 'text';
};

/**
 * Progressive form enhancement utilities
 */
export const progressiveFormEnhancement = {
    /**
     * Add auto-save functionality
     */
    enableAutoSave(
        formId: string,
        saveCallback: (data: Record<string, any>) => void,
        interval: number = 30000
    ): () => void {
        const form = document.getElementById(formId) as HTMLFormElement;
        if (!form) return () => { };

        const saveData = () => {
            const formData = new FormData(form);
            const data: Record<string, any> = {};

            formData.forEach((value, key) => {
                data[key] = value;
            });

            saveCallback(data);
        };

        // Save on form change (debounced)
        let changeTimeout: NodeJS.Timeout;
        const handleChange = () => {
            clearTimeout(changeTimeout);
            changeTimeout = setTimeout(saveData, 2000);
        };

        // Save periodically
        const intervalId = setInterval(saveData, interval);

        form.addEventListener('change', handleChange);
        form.addEventListener('input', handleChange);

        return () => {
            clearTimeout(changeTimeout);
            clearInterval(intervalId);
            form.removeEventListener('change', handleChange);
            form.removeEventListener('input', handleChange);
        };
    },

    /**
     * Add smart field completion
     */
    enableSmartCompletion(fieldId: string, suggestions: string[]): () => void {
        const field = document.getElementById(fieldId) as HTMLInputElement;
        if (!field) return () => { };

        let datalistId = `${fieldId}-suggestions`;
        let datalist = document.getElementById(datalistId) as HTMLDataListElement;

        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = datalistId;
            document.body.appendChild(datalist);
        }

        // Populate suggestions
        datalist.innerHTML = '';
        suggestions.forEach(suggestion => {
            const option = document.createElement('option');
            option.value = suggestion;
            datalist.appendChild(option);
        });

        field.setAttribute('list', datalistId);

        return () => {
            field.removeAttribute('list');
            if (datalist.parentNode) {
                datalist.parentNode.removeChild(datalist);
            }
        };
    },

    /**
     * Add field formatting
     */
    enableFieldFormatting(fieldId: string, formatter: (value: string) => string): () => void {
        const field = document.getElementById(fieldId) as HTMLInputElement;
        if (!field) return () => { };

        const handleInput = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const cursorPosition = target.selectionStart;
            const oldValue = target.value;
            const newValue = formatter(oldValue);

            if (newValue !== oldValue) {
                target.value = newValue;

                // Restore cursor position
                const lengthDiff = newValue.length - oldValue.length;
                const newCursorPosition = (cursorPosition || 0) + lengthDiff;
                target.setSelectionRange(newCursorPosition, newCursorPosition);
            }
        };

        field.addEventListener('input', handleInput);

        return () => {
            field.removeEventListener('input', handleInput);
        };
    }
};

/**
 * Common validation rule presets
 */
export const validationPresets = {
    required: (message: string = 'This field is required'): ValidationRule => ({
        type: 'required',
        message
    }),

    email: (message: string = 'Please enter a valid email address'): ValidationRule => ({
        type: 'email',
        message
    }),

    minLength: (length: number, message?: string): ValidationRule => ({
        type: 'minLength',
        value: length,
        message: message || `Must be at least ${length} characters long`
    }),

    maxLength: (length: number, message?: string): ValidationRule => ({
        type: 'maxLength',
        value: length,
        message: message || `Must be no more than ${length} characters long`
    }),

    numberRange: (min: number, max: number, message?: string): ValidationRule => ({
        type: 'range',
        value: { min, max },
        message: message || `Must be between ${min} and ${max}`
    }),

    phoneNumber: (message: string = 'Please enter a valid phone number'): ValidationRule => ({
        type: 'pattern',
        value: '^[+]?[0-9\\s\\-\\(\\)]{10,}$',
        message
    }),

    strongPassword: (message: string = 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character'): ValidationRule => ({
        type: 'pattern',
        value: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
        message
    }),

    marks: (maxMarks: number, message?: string): ValidationRule => ({
        type: 'custom',
        validator: (value: any) => {
            const num = Number(value);
            return !isNaN(num) && num >= 0 && num <= maxMarks;
        },
        message: message || `Marks must be between 0 and ${maxMarks}`
    })
};

/**
 * Form accessibility helpers
 */
export const formAccessibility = {
    /**
     * Associate label with input
     */
    associateLabel(inputId: string, labelText: string): void {
        const input = document.getElementById(inputId);
        const label = document.querySelector(`label[for="${inputId}"]`) as HTMLLabelElement;

        if (input && !label) {
            const newLabel = document.createElement('label');
            newLabel.htmlFor = inputId;
            newLabel.textContent = labelText;
            newLabel.className = 'sr-only'; // Hidden but accessible
            input.parentNode?.insertBefore(newLabel, input);
        }
    },

    /**
     * Add error announcements
     */
    announceErrors(fieldId: string, errors: string[]): void {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Remove existing error announcements
        const existingAnnouncement = document.getElementById(`${fieldId}-error-announcement`);
        if (existingAnnouncement) {
            existingAnnouncement.remove();
        }

        if (errors.length > 0) {
            const announcement = document.createElement('div');
            announcement.id = `${fieldId}-error-announcement`;
            announcement.className = 'sr-only';
            announcement.setAttribute('aria-live', 'assertive');
            announcement.textContent = `Error in ${field.getAttribute('name') || fieldId}: ${errors.join(', ')}`;

            document.body.appendChild(announcement);

            // Remove after announcement
            setTimeout(() => {
                if (announcement.parentNode) {
                    announcement.parentNode.removeChild(announcement);
                }
            }, 3000);
        }
    }
};