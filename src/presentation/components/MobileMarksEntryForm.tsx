import React, { useState, useEffect, useCallback } from 'react';
import type { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';
import { FormValidator, FormValidationConfig, validationPresets } from '../utils/formValidation';
import { screenReaderAnnouncer } from '../utils/accessibility';
import { getSubjectMaxMarks } from '../../domain/utils/subjectUtils';
import MobileFormInput from './MobileFormInput';
import MobileButton from './MobileButton';

interface MobileMarksEntryFormProps {
    student: StudentRecord;
    subject: SubjectConfig;
    initialMarks?: { int?: string; ext?: string; ta?: string; ce?: string };
    onSave: (studentId: string, marks: { int: number; ext: number; ta?: number; ce?: number }) => Promise<void>;
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
    initialMarks = { int: '', ext: '', ta: '', ce: '' },
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
    const [marks, setMarks] = useState({
        int: initialMarks.int || initialMarks.ce || '',
        ext: initialMarks.ext || initialMarks.ta || ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{ int?: string; ext?: string }>({});
    const [showValidation, setShowValidation] = useState(false);

    const { maxINT, maxEXT, maxTotal } = getSubjectMaxMarks(subject);

    // Create validation configuration
    const validationConfig: FormValidationConfig = {
        int: {
            rules: [
                validationPresets.required('INT marks are required'),
                validationPresets.marks(maxINT, `INT marks must be between 0 and ${maxINT}`)
            ],
            validateOnChange: true,
            validateOnBlur: true,
            debounceMs: 500
        },
        ext: {
            rules: [
                validationPresets.required('EXT marks are required'),
                validationPresets.marks(maxEXT, `EXT marks must be between 0 and ${maxEXT}`)
            ],
            validateOnChange: true,
            validateOnBlur: true,
            debounceMs: 500
        }
    };

    const validator = new FormValidator(validationConfig);

    // Update marks when props change
    useEffect(() => {
        setMarks({
            int: initialMarks.int || initialMarks.ce || '',
            ext: initialMarks.ext || initialMarks.ta || ''
        });
        setValidationErrors({});
        setShowValidation(false);
    }, [initialMarks, student.id]);

    // Calculate totals and status
    const intValue = parseInt(marks.int) || 0;
    const extValue = parseInt(marks.ext) || 0;
    const total = intValue + extValue;
    const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

    // Determine pass/fail status
    const minINT = Math.ceil(maxINT * 0.5);
    const minEXT = Math.ceil(maxEXT * 0.4);
    const passedINT = intValue >= minINT;
    const passedEXT = extValue >= minEXT;
    const overallStatus = passedINT && passedEXT ? 'Passed' : 'Failed';

    // Handle field change with validation
    const handleFieldChange = useCallback((field: 'int' | 'ext', value: string) => {
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
    const handleFieldBlur = useCallback((field: 'int' | 'ext', value: string) => {
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
            const newErrors: { int?: string; ext?: string } = {};
            if (errors.int) newErrors.int = errors.int[0];
            if (errors.ext) newErrors.ext = errors.ext[0];
            setValidationErrors(newErrors);

            screenReaderAnnouncer.announceError('Please correct the validation errors before saving');
            return;
        }

        setIsSaving(true);
        try {
            const parsedInt = parseInt(marks.int) || 0;
            const parsedExt = parseInt(marks.ext) || 0;
            await onSave(student.id, {
                int: parsedInt,
                ext: parsedExt,
                ta: parsedExt,
                ce: parsedInt
            });

            screenReaderAnnouncer.announceSuccess(`Marks saved for ${student.name}`);

            // Auto-advance to next student if available
            if (hasNext && onNext) {
                setTimeout(() => {
                    onNext();
                }, 500);
            }
        } catch (error) {
            console.error('Failed to save marks:', error);
            screenReaderAnnouncer.announceError('Failed to save marks. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

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
                {/* EXT Marks (Legacy TA) */}
                <MobileFormInput
                    label={`EXT Marks (Max: ${maxEXT})`}
                    type="number"
                    value={marks.ta}
                    placeholder="0"
                    min={0}
                    max={maxEXT}
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
                    hint={`Minimum required: ${minCE} marks`}
                    touchOptimized
                    autoComplete="off"
                />

                {/* INT Marks (Legacy CE) */}
                <MobileFormInput
                    label={`INT Marks (Max: ${maxINT})`}
                    type="number"
                    value={marks.ce}
                    placeholder="0"
                    min={0}
                    max={maxINT}
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
                    hint={`Minimum required: ${minTA} marks`}
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
                            <span className={`${passedCE ? 'text-green-600' : 'text-red-600'}`}>
                                <i className={`fa-solid ${passedCE ? 'fa-check' : 'fa-times'} mr-1`} aria-hidden="true"></i>
                                EXT: {passedCE ? 'Pass' : 'Fail'}
                            </span>
                            <span className={`${passedTA ? 'text-green-600' : 'text-red-600'}`}>
                                <i className={`fa-solid ${passedTA ? 'fa-check' : 'fa-times'} mr-1`} aria-hidden="true"></i>
                                INT: {passedTA ? 'Pass' : 'Fail'}
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
                        Current marks: TA {marks.ta} out of {maxINT}, CE {marks.ce} out of {maxEXT}.
                        Total: {total} out of {maxTotal}. Status: {overallStatus}.
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileMarksEntryForm;