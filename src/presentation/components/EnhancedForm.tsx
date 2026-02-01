import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMobile } from '../hooks/useMobile';
import { FormValidator, FormValidationConfig, ValidationResult, getMobileInputType, progressiveFormEnhancement, formAccessibility } from '../utils/formValidation';
import { screenReaderAnnouncer } from '../utils/accessibility';
import MobileFormInput from './MobileFormInput';
import MobileButton from './MobileButton';

interface FormField {
    name: string;
    label: string;
    type?: string;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    autoComplete?: string;
    leftIcon?: string;
    rightIcon?: string;
    onRightIconClick?: () => void;
    options?: Array<{ value: string; label: string }>;
    rows?: number; // For textarea
    min?: number;
    max?: number;
    step?: number;
}

interface EnhancedFormProps {
    fields: FormField[];
    validationConfig: FormValidationConfig;
    onSubmit: (data: Record<string, any>) => Promise<void> | void;
    onAutoSave?: (data: Record<string, any>) => void;
    initialValues?: Record<string, any>;
    submitLabel?: string;
    resetLabel?: string;
    showReset?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
    progressiveEnhancement?: boolean;
    className?: string;
    formId?: string;
}

/**
 * Enhanced Form Component with Mobile Optimization
 * Implements Requirements 8.4 - Form optimization with appropriate input types,
 * real-time validation feedback, and progressive form enhancement
 */
export const EnhancedForm: React.FC<EnhancedFormProps> = ({
    fields,
    validationConfig,
    onSubmit,
    onAutoSave,
    initialValues = {},
    submitLabel = 'Submit',
    resetLabel = 'Reset',
    showReset = false,
    autoSave = false,
    autoSaveInterval = 30000,
    progressiveEnhancement = true,
    className = '',
    formId = `form-${Math.random().toString(36).substr(2, 9)}`
}) => {
    const { isMobile } = useMobile();
    const [values, setValues] = useState<Record<string, any>>(initialValues);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [fieldStates, setFieldStates] = useState<Record<string, {
        hasError: boolean;
        errors: string[];
        warnings: string[];
        isTouched: boolean;
        validationState?: 'valid' | 'invalid' | 'pending';
    }>>({});

    const formRef = useRef<HTMLFormElement>(null);
    const validatorRef = useRef<FormValidator>(new FormValidator(validationConfig));
    const autoSaveCleanupRef = useRef<(() => void) | null>(null);

    // Initialize form
    useEffect(() => {
        // Set up auto-save if enabled
        if (autoSave && onAutoSave) {
            autoSaveCleanupRef.current = progressiveFormEnhancement.enableAutoSave(
                formId,
                onAutoSave,
                autoSaveInterval
            );
        }

        // Set up progressive enhancements
        if (progressiveEnhancement) {
            fields.forEach(field => {
                // Add accessibility labels
                formAccessibility.associateLabel(`${formId}-${field.name}`, field.label);
            });
        }

        return () => {
            if (autoSaveCleanupRef.current) {
                autoSaveCleanupRef.current();
            }
        };
    }, [autoSave, onAutoSave, autoSaveInterval, formId, fields, progressiveEnhancement]);

    // Handle field change with validation
    const handleFieldChange = useCallback((fieldName: string, value: any) => {
        setValues(prev => ({ ...prev, [fieldName]: value }));

        // Validate field with debouncing
        validatorRef.current.handleFieldChange(fieldName, value, (result: ValidationResult) => {
            setFieldStates(prev => ({
                ...prev,
                [fieldName]: {
                    hasError: !result.isValid,
                    errors: result.errors,
                    warnings: result.warnings,
                    isTouched: prev[fieldName]?.isTouched || false,
                    validationState: result.isValid ? 'valid' : 'invalid'
                }
            }));

            // Announce errors for accessibility
            if (!result.isValid && result.errors.length > 0) {
                formAccessibility.announceErrors(`${formId}-${fieldName}`, result.errors);
            }
        });
    }, [formId]);

    // Handle field blur with immediate validation
    const handleFieldBlur = useCallback((fieldName: string, value: any) => {
        validatorRef.current.handleFieldBlur(fieldName, value, (result: ValidationResult) => {
            setFieldStates(prev => ({
                ...prev,
                [fieldName]: {
                    hasError: !result.isValid,
                    errors: result.errors,
                    warnings: result.warnings,
                    isTouched: true,
                    validationState: result.isValid ? 'valid' : 'invalid'
                }
            }));

            // Announce errors for accessibility
            if (!result.isValid && result.errors.length > 0) {
                formAccessibility.announceErrors(`${formId}-${fieldName}`, result.errors);
            }
        });
    }, [formId]);

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitAttempted(true);

        // Validate entire form
        const { isValid, errors } = validatorRef.current.validateForm(values);

        if (!isValid) {
            // Update field states with errors
            const newFieldStates: typeof fieldStates = {};
            Object.entries(errors).forEach(([fieldName, fieldErrors]) => {
                newFieldStates[fieldName] = {
                    hasError: true,
                    errors: fieldErrors,
                    warnings: [],
                    isTouched: true,
                    validationState: 'invalid'
                };
            });
            setFieldStates(prev => ({ ...prev, ...newFieldStates }));

            // Announce form errors
            const totalErrors = Object.values(errors).reduce((sum, errs) => sum + errs.length, 0);
            screenReaderAnnouncer.announceError(`Form has ${totalErrors} error${totalErrors > 1 ? 's' : ''}. Please correct the highlighted fields.`);

            // Focus first error field
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const fieldElement = document.getElementById(`${formId}-${firstErrorField}`);
                if (fieldElement) {
                    fieldElement.focus();
                }
            }

            return;
        }

        // Submit form
        setIsSubmitting(true);
        try {
            await onSubmit(values);
            screenReaderAnnouncer.announceSuccess('Form submitted successfully');

            // Reset form if submission was successful
            handleReset();
        } catch (error) {
            console.error('Form submission error:', error);
            screenReaderAnnouncer.announceError('Form submission failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle form reset
    const handleReset = () => {
        setValues(initialValues);
        setFieldStates({});
        setSubmitAttempted(false);
        validatorRef.current.reset();
        screenReaderAnnouncer.announce('Form has been reset', 'polite');
    };

    // Get form summary for progress indication
    const formSummary = validatorRef.current.getFormSummary();

    // Render field based on type
    const renderField = (field: FormField) => {
        const fieldId = `${formId}-${field.name}`;
        const fieldState = fieldStates[field.name] || { hasError: false, errors: [], warnings: [], isTouched: false };
        const value = values[field.name] || '';

        // Determine input type for mobile optimization
        const inputType = getMobileInputType(field.name, field.type || 'text');

        // Common props for all input types
        const commonProps = {
            id: fieldId,
            name: field.name,
            label: field.label,
            value,
            placeholder: field.placeholder,
            hint: field.hint,
            required: field.required,
            disabled: field.disabled || isSubmitting,
            error: fieldState.hasError && fieldState.isTouched ? fieldState.errors[0] : undefined,
            validationState: fieldState.validationState,
            showValidation: submitAttempted || fieldState.isTouched,
            leftIcon: field.leftIcon,
            rightIcon: field.rightIcon,
            onRightIconClick: field.onRightIconClick,
            touchOptimized: isMobile,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                handleFieldChange(field.name, e.target.value);
            },
            onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                handleFieldBlur(field.name, e.target.value);
            }
        };

        // Render different field types
        switch (field.type) {
            case 'select':
                return (
                    <div key={field.name} className="w-full">
                        <label
                            htmlFor={fieldId}
                            className={`
                block text-sm font-semibold mb-2 transition-colors duration-200
                ${fieldState.hasError && fieldState.isTouched ? 'text-red-600' : 'text-slate-700'}
                ${field.required ? "after:content-['*'] after:text-red-500 after:ml-1" : ''}
              `}
                        >
                            {field.label}
                        </label>
                        <select
                            {...commonProps}
                            className={`
                w-full rounded-xl transition-all duration-200 px-4 py-3 text-base
                border focus:outline-none focus:ring-4 focus:ring-opacity-20
                disabled:opacity-50 disabled:cursor-not-allowed
                ${fieldState.hasError && fieldState.isTouched
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                                }
                ${isMobile ? 'text-base' : ''}
              `}
                            style={{ minHeight: isMobile ? '48px' : '44px' }}
                        >
                            <option value="">{field.placeholder || `Select ${field.label}`}</option>
                            {field.options?.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {fieldState.hasError && fieldState.isTouched && (
                            <p className="mt-2 text-sm text-red-600 flex items-center" role="alert">
                                <i className="fa-solid fa-exclamation-triangle mr-2" aria-hidden="true"></i>
                                {fieldState.errors[0]}
                            </p>
                        )}
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.name} className="w-full">
                        <label
                            htmlFor={fieldId}
                            className={`
                block text-sm font-semibold mb-2 transition-colors duration-200
                ${fieldState.hasError && fieldState.isTouched ? 'text-red-600' : 'text-slate-700'}
                ${field.required ? "after:content-['*'] after:text-red-500 after:ml-1" : ''}
              `}
                        >
                            {field.label}
                        </label>
                        <textarea
                            {...commonProps}
                            rows={field.rows || 4}
                            className={`
                w-full rounded-xl transition-all duration-200 px-4 py-3 text-base
                border focus:outline-none focus:ring-4 focus:ring-opacity-20
                disabled:opacity-50 disabled:cursor-not-allowed resize-vertical
                ${fieldState.hasError && fieldState.isTouched
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                                }
                ${isMobile ? 'text-base' : ''}
              `}
                            style={{ minHeight: isMobile ? '96px' : '88px' }}
                        />
                        {fieldState.hasError && fieldState.isTouched && (
                            <p className="mt-2 text-sm text-red-600 flex items-center" role="alert">
                                <i className="fa-solid fa-exclamation-triangle mr-2" aria-hidden="true"></i>
                                {fieldState.errors[0]}
                            </p>
                        )}
                    </div>
                );

            default:
                return (
                    <MobileFormInput
                        key={field.name}
                        {...commonProps}
                        type={inputType}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        autoComplete={field.autoComplete}
                    />
                );
        }
    };

    return (
        <form
            ref={formRef}
            id={formId}
            onSubmit={handleSubmit}
            className={`space-y-6 ${className}`}
            noValidate
            aria-label="Enhanced form with real-time validation"
        >
            {/* Form progress indicator */}
            {fields.length > 3 && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                        <span>Form Progress</span>
                        <span>{formSummary.completedFields} of {fields.length} fields completed</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(formSummary.completedFields / fields.length) * 100}%` }}
                            role="progressbar"
                            aria-valuenow={formSummary.completedFields}
                            aria-valuemin={0}
                            aria-valuemax={fields.length}
                            aria-label={`Form completion progress: ${formSummary.completedFields} of ${fields.length} fields`}
                        />
                    </div>
                </div>
            )}

            {/* Form fields */}
            {fields.map(renderField)}

            {/* Form actions */}
            <div className={`flex gap-4 pt-6 ${isMobile ? 'flex-col' : 'flex-row justify-end'}`}>
                {showReset && (
                    <MobileButton
                        type="button"
                        variant="outline"
                        size="lg"
                        fullWidth={isMobile}
                        onClick={handleReset}
                        disabled={isSubmitting}
                    >
                        {resetLabel}
                    </MobileButton>
                )}

                <MobileButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth={isMobile}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    icon="fa-solid fa-check"
                >
                    {submitLabel}
                </MobileButton>
            </div>

            {/* Form summary for screen readers */}
            <div className="sr-only" aria-live="polite">
                {formSummary.totalErrors > 0 && (
                    <div>
                        Form has {formSummary.totalErrors} error{formSummary.totalErrors > 1 ? 's' : ''}.
                    </div>
                )}
                {formSummary.isValid && formSummary.completedFields === fields.length && (
                    <div>All form fields are completed and valid.</div>
                )}
            </div>
        </form>
    );
};

export default EnhancedForm;