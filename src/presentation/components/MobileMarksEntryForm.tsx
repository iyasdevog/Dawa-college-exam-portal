import React, { useState, useEffect, useCallback } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';
import { FormValidator, FormValidationConfig, validationPresets } from '../utils/formValidation';
import { screenReaderAnnouncer } from '../utils/accessibility';
import MobileFormInput from './MobileFormInput';
import MobileButton from './MobileButton';

interface MobileMarksEntryFormProps {
    student: StudentRecord;
    subject: SubjectConfig;
    initialMarks?: { ta: string; ce: string };
    onSave: (studentId: string, marks: { ta: number; ce: number }) => Promise<void>;
    onCancel?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
    studentIndex?: number;
    totalStudents?: number;
}

/**
 * Mobile-Optimized Marks Entry Form
 * Implements Requirements 8.4 - Mobile form optimization with appropriate input types,
 * real-time validation, and progressive enhancement for marks entry
 */
export const MobileMarksEntryForm: React.FC<MobileMarksEntryFormProps> = ({
    student,
    subject,
    initialMarks = { ta: '', ce: '' },
    onSave,
    onCancel,
    onNext,
    onPrevious,
    hasNext = false,
    hasPrevious = false,
    studentIndex = 0,
    totalStudents = 1
}) => {
    const { isMobile, orientation } = useMobile();
    const [marks, setMarks] = useState(initialMarks);
    const [isSaving, setIsSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ ta?: string; ce?: string }>({});
    const [showValidation, setShowValidation] = useState(false);

    // Create validation configuration
    const validationConfig: FormValidationConfig = {
        ta: {
            rules: [
                validationPresets.required('TA marks are required'),
                validationPresets.marks(subject.maxTA, `TA marks must be between 0 and ${subject.maxTA}`)
            ],
            validateOnChange: true,
            validateOnBlur: true,
            debounceMs: 500
        },
        ce: {
            rules: [
                validationPresets.required('CE marks are required'),
                validationPresets.marks(subject.maxCE, `CE marks must be between 0 and ${subject.maxCE}`)
            ],
            validateOnChange: true,
            validateOnBlur: true,
            debounceMs: 500
        }
    };

    const validator = new FormValidator(validationConfig);

    // Update marks when props change
    useEffect(() => {
        setMarks(initialMarks);
        setValidationErrors({});
        setShowValidation(false);
    }, [initialMarks, student.id]);

    // Calculate totals and status
    const taValue = parseInt(marks.ta) || 0;
    const ceValue = parseInt(marks.ce) || 0;
    const total = taValue + ceValue;
    const maxTotal = subject.maxTA + subject.maxCE;
    const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

    // Determine pass/fail status
    const minTA = Math.ceil(subject.maxTA * 0.4);
    const minCE = Math.ceil(subject.maxCE * 0.5);
    const passedTA = taValue >= minTA;
    const passedCE = ceValue >= minCE;
    const overallStatus = passedTA && passedCE ? 'Passed' : 'Failed';

    // Handle field change with validation
    const handleFieldChange = useCallback((field: 'ta' | 'ce', value: string) => {
        // Only allow numeric input
        if (value && !/^\d*$/.test(value)) {
            return;
        }

        setMarks(prev => ({ ...prev, [field]: value }));

        // Validate field
        validator.handleFieldChange(field, value, (result) => {
            setValidationErrors(prev => ({
                ...prev,
                [field]: result.isValid ? undefined : result.errors[0]
            }));
        });
    }, [validator]);

    // Handle field blur
    const handleFieldBlur = useCallback((field: 'ta' | 'ce', value: string) => {
        setShowValidation(true);

        validator.handleFieldBlur(field, value, (result) => {
            setValidationErrors(prev => ({
                ...prev,
                [field]: result.isValid ? undefined : result.errors[0]
            }));
        });
    }, [validator]);

    // Handle save
    const handleSave = async () => {
        setShowValidation(true);

        // Validate form
        const { isValid, errors } = validator.validateForm(marks);

        if (!isValid) {
            const newErrors: { ta?: string; ce?: string } = {};
            if (errors.ta) newErrors.ta = errors.ta[0];
            if (errors.ce) newErrors.ce = errors.ce[0];
            setValidationErrors(newErrors);

            screenReaderAnnouncer.announceError('Please correct the validation errors before saving');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(student.id, {
                ta: parseInt(marks.ta),
                ce: parseInt(marks.ce)
            });

            screenReaderAnnouncer.announceSuccess(`Marks saved for ${student.name}`);

            // Auto-advance to next student if available
            if (hasNext && onNext) {
                setTimeout(() => {
                    onNext();
                }, 500);
            }
        } catch (error) {
            console.error('Error saving marks:', error);
            screenReaderAnnouncer.announceError('Failed to save marks. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    handleSave();
                    break;
                case 'ArrowLeft':
                    if (hasPrevious && onPrevious) {
                        e.preventDefault();
                        onPrevious();
                    }
                    break;
                case 'ArrowRight':
                    if (hasNext && onNext) {
                        e.preventDefault();
                        onNext();
                    }
                    break;
            }
        }
    }, [handleSave, hasPrevious, onPrevious, hasNext, onNext]);

    return (
        <div
            className={`
        bg-white rounded-2xl shadow-lg border border-slate-200
        ${isMobile ? 'p-4' : 'p-6'}
        ${orientation === 'landscape' && isMobile ? 'max-h-[90vh] overflow-y-auto' : ''}
      `}
            onKeyDown={handleKeyDown}
            role="form"
            aria-label={`Marks entry form for ${student.name}`}
        >
            {/* Student Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className={`font-bold text-slate-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                        {student.name}
                    </h2>
                    <div className="text-sm text-slate-500">
                        {studentIndex + 1} of {totalStudents}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>
                        <i className="fa-solid fa-id-card mr-1" aria-hidden="true"></i>
                        Adm: {student.adNo}
                    </span>
                    <span>
                        <i className="fa-solid fa-graduation-cap mr-1" aria-hidden="true"></i>
                        Class: {student.className}
                    </span>
                    <span>
                        <i className="fa-solid fa-book mr-1" aria-hidden="true"></i>
                        Subject: {subject.name}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(((studentIndex + 1) / totalStudents) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((studentIndex + 1) / totalStudents) * 100}%` }}
                            role="progressbar"
                            aria-valuenow={studentIndex + 1}
                            aria-valuemin={1}
                            aria-valuemax={totalStudents}
                            aria-label={`Student ${studentIndex + 1} of ${totalStudents}`}
                        />
                    </div>
                </div>
            </div>

            {/* Marks Input Section */}
            <div className={`grid gap-4 mb-6 ${isMobile && orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* TA Marks */}
                <MobileFormInput
                    label={`TA Marks (Max: ${subject.maxTA})`}
                    type="number"
                    value={marks.ta}
                    placeholder="0"
                    min={0}
                    max={subject.maxTA}
                    required
                    error={showValidation ? validationErrors.ta : undefined}
                    validationState={
                        showValidation
                            ? validationErrors.ta
                                ? 'invalid'
                                : marks.ta
                                    ? 'valid'
                                    : undefined
                            : undefined
                    }
                    leftIcon="fa-solid fa-pencil"
                    onChange={(e) => handleFieldChange('ta', e.target.value)}
                    onBlur={(e) => handleFieldBlur('ta', e.target.value)}
                    hint={`Minimum required: ${minTA} marks`}
                    touchOptimized
                    autoComplete="off"
                />

                {/* CE Marks */}
                <MobileFormInput
                    label={`CE Marks (Max: ${subject.maxCE})`}
                    type="number"
                    value={marks.ce}
                    placeholder="0"
                    min={0}
                    max={subject.maxCE}
                    required
                    error={showValidation ? validationErrors.ce : undefined}
                    validationState={
                        showValidation
                            ? validationErrors.ce
                                ? 'invalid'
                                : marks.ce
                                    ? 'valid'
                                    : undefined
                            : undefined
                    }
                    leftIcon="fa-solid fa-file-alt"
                    onChange={(e) => handleFieldChange('ce', e.target.value)}
                    onBlur={(e) => handleFieldBlur('ce', e.target.value)}
                    hint={`Minimum required: ${minCE} marks`}
                    touchOptimized
                    autoComplete="off"
                />
            </div>

            {/* Results Summary */}
            {(marks.ta || marks.ce) && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-3">Results Summary</h3>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-600">Total Marks:</span>
                            <div className="font-bold text-lg">
                                {total} / {maxTotal}
                            </div>
                        </div>

                        <div>
                            <span className="text-slate-600">Percentage:</span>
                            <div className="font-bold text-lg">
                                {percentage}%
                            </div>
                        </div>

                        <div className="col-span-2">
                            <span className="text-slate-600">Status:</span>
                            <div className={`font-bold text-lg ${overallStatus === 'Passed' ? 'text-green-600' : 'text-red-600'}`}>
                                <i className={`fa-solid ${overallStatus === 'Passed' ? 'fa-check-circle' : 'fa-times-circle'} mr-2`} aria-hidden="true"></i>
                                {overallStatus}
                            </div>
                        </div>
                    </div>

                    {/* Individual component status */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex justify-between text-sm">
                            <span className={`${passedTA ? 'text-green-600' : 'text-red-600'}`}>
                                <i className={`fa-solid ${passedTA ? 'fa-check' : 'fa-times'} mr-1`} aria-hidden="true"></i>
                                TA: {passedTA ? 'Pass' : 'Fail'}
                            </span>
                            <span className={`${passedCE ? 'text-green-600' : 'text-red-600'}`}>
                                <i className={`fa-solid ${passedCE ? 'fa-check' : 'fa-times'} mr-1`} aria-hidden="true"></i>
                                CE: {passedCE ? 'Pass' : 'Fail'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row justify-between'}`}>
                {/* Navigation buttons */}
                <div className={`flex gap-2 ${isMobile ? 'order-2' : ''}`}>
                    <MobileButton
                        variant="outline"
                        size="md"
                        onClick={onPrevious}
                        disabled={!hasPrevious || isSaving}
                        icon="fa-solid fa-chevron-left"
                        touchSize="comfortable"
                        aria-label="Previous student"
                    >
                        {isMobile ? '' : 'Previous'}
                    </MobileButton>

                    <MobileButton
                        variant="outline"
                        size="md"
                        onClick={onNext}
                        disabled={!hasNext || isSaving}
                        icon="fa-solid fa-chevron-right"
                        iconPosition="right"
                        touchSize="comfortable"
                        aria-label="Next student"
                    >
                        {isMobile ? '' : 'Next'}
                    </MobileButton>
                </div>

                {/* Action buttons */}
                <div className={`flex gap-2 ${isMobile ? 'order-1' : ''}`}>
                    {onCancel && (
                        <MobileButton
                            variant="ghost"
                            size="md"
                            onClick={onCancel}
                            disabled={isSaving}
                            touchSize="comfortable"
                        >
                            Cancel
                        </MobileButton>
                    )}

                    <MobileButton
                        variant="primary"
                        size="md"
                        onClick={handleSave}
                        loading={isSaving}
                        disabled={isSaving || (!marks.ta && !marks.ce)}
                        icon="fa-solid fa-save"
                        touchSize="comfortable"
                        fullWidth={isMobile}
                    >
                        Save Marks
                    </MobileButton>
                </div>
            </div>

            {/* Keyboard shortcuts hint */}
            {!isMobile && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                    <div className="flex flex-wrap gap-4">
                        <span><kbd className="px-1 py-0.5 bg-slate-200 rounded">Ctrl+S</kbd> Save</span>
                        <span><kbd className="px-1 py-0.5 bg-slate-200 rounded">Ctrl+←</kbd> Previous</span>
                        <span><kbd className="px-1 py-0.5 bg-slate-200 rounded">Ctrl+→</kbd> Next</span>
                    </div>
                </div>
            )}

            {/* Screen reader announcements */}
            <div className="sr-only" aria-live="polite">
                {marks.ta && marks.ce && (
                    <div>
                        Current marks: TA {marks.ta} out of {subject.maxTA}, CE {marks.ce} out of {subject.maxCE}.
                        Total: {total} out of {maxTotal}. Status: {overallStatus}.
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileMarksEntryForm;