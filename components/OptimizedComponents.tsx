import React, { memo, useMemo, useCallback } from 'react';
import { StudentRecord, SubjectConfig } from '../types';

// Memoized Student Card Component for better performance
interface StudentCardProps {
    student: StudentRecord;
    index: number;
    totalStudents: number;
    selectedSubject: SubjectConfig;
    marksData: Record<string, { ta: string; ce: string }>;
    isCurrent: boolean;
    onMarksChange: (studentId: string, field: 'ta' | 'ce', value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, studentId: string, field: 'ta' | 'ce') => void;
    onClearMarks: (studentId: string, studentName: string) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    isSaving: boolean;
    operationLoading: { type: string | null };
}

export const OptimizedStudentCard = memo<StudentCardProps>(({
    student,
    index,
    totalStudents,
    selectedSubject,
    marksData,
    isCurrent,
    onMarksChange,
    onKeyDown,
    onClearMarks,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    isSaving,
    operationLoading
}) => {
    // Memoized calculations to prevent unnecessary re-computations
    const calculations = useMemo(() => {
        const marks = marksData[student.id];
        const ta = parseInt(marks?.ta || '0') || 0;
        const ce = parseInt(marks?.ce || '0') || 0;
        const total = ta + ce;

        // Validation checks
        const isTAExceeding = ta > selectedSubject.maxTA;
        const isCEExceeding = ce > selectedSubject.maxCE;
        const minTA = Math.ceil(selectedSubject.maxTA * 0.4);
        const minCE = Math.ceil(selectedSubject.maxCE * 0.5);
        const isTAFailing = ta > 0 && ta < minTA && ta <= selectedSubject.maxTA;
        const isCEFailing = ce > 0 && ce < minCE && ce <= selectedSubject.maxCE;

        // Status calculation
        let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
        if (marks?.ta && marks?.ce) {
            const passedTA = ta >= minTA;
            const passedCE = ce >= minCE;
            status = (passedTA && passedCE) ? 'Passed' : 'Failed';
        }

        return {
            total,
            status,
            isTAExceeding,
            isCEExceeding,
            isTAFailing,
            isCEFailing,
            minTA,
            minCE,
            hasValidTA: marks?.ta && !isTAFailing && !isTAExceeding,
            hasValidCE: marks?.ce && !isCEFailing && !isCEExceeding
        };
    }, [student.id, marksData, selectedSubject]);

    // Memoized event handlers to prevent unnecessary re-renders
    const handleTAChange = useCallback((value: string) => {
        onMarksChange(student.id, 'ta', value);
    }, [student.id, onMarksChange]);

    const handleCEChange = useCallback((value: string) => {
        onMarksChange(student.id, 'ce', value);
    }, [student.id, onMarksChange]);

    const handleTAKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown(e, student.id, 'ta');
    }, [student.id, onKeyDown]);

    const handleCEKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown(e, student.id, 'ce');
    }, [student.id, onKeyDown]);

    const handleClearClick = useCallback(() => {
        onClearMarks(student.id, student.name);
    }, [student.id, student.name, onClearMarks]);

    const isDisabled = isSaving || operationLoading.type !== null;
    const currentMarks = marksData[student.id] || { ta: '', ce: '' };

    return (
        <div
            className={`bg-white rounded-3xl p-8 shadow-xl border-2 hover:shadow-2xl transition-all duration-300 scroll-mt-24 ${isCurrent
                ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-blue-500/20 shadow-2xl scale-[1.02]'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-slate-200/50'
                } backdrop-blur-sm`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: isCurrent
                    ? '0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1)'
                    : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
        >
            <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-black text-xl md:text-2xl text-slate-900 leading-tight">{student.name}</h3>
                        {isCurrent && (
                            <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-xs font-bold shadow-lg">
                                <i className="fa-solid fa-arrow-right mr-1.5"></i>
                                Current
                            </div>
                        )}
                    </div>
                    <p className="text-base text-slate-600 font-semibold">Admission: {student.adNo}</p>
                    <div className="text-sm text-slate-500 mt-1">
                        Student {index + 1} of {totalStudents}
                    </div>
                </div>
                <div className="text-right ml-4">
                    <span className={`px-5 py-2.5 rounded-2xl text-base font-black uppercase tracking-wider shadow-lg ${calculations.status === 'Passed' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' :
                        calculations.status === 'Failed' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                            'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
                        }`}>
                        {calculations.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
                {/* TA Input */}
                <div className="space-y-3">
                    <label className="block text-base font-black text-slate-800 mb-3 tracking-wide">
                        TA <span className="text-slate-600 font-semibold">(Max: {selectedSubject.maxTA})</span>
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        enterKeyHint="next"
                        data-student={student.id}
                        data-field="ta"
                        value={currentMarks.ta}
                        onChange={(e) => handleTAChange(e.target.value)}
                        onKeyDown={handleTAKeyDown}
                        className={`w-full p-5 text-2xl text-center border-3 rounded-2xl focus:ring-6 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all duration-300 ease-out transform font-bold ${calculations.isTAExceeding
                            ? 'border-red-600 bg-red-50 text-red-800 ring-6 ring-red-500/30 shadow-2xl shadow-red-500/25 animate-pulse scale-[1.02]'
                            : calculations.isTAFailing
                                ? 'border-orange-600 bg-orange-50 text-orange-800 ring-6 ring-orange-500/30 shadow-xl shadow-orange-500/20 scale-[1.01]'
                                : calculations.hasValidTA
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-6 ring-emerald-500/30 shadow-xl shadow-emerald-500/20 scale-[1.02]'
                                    : 'border-slate-300 hover:border-slate-400 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] active:shadow-inner bg-white'
                            }`}
                        placeholder="0"
                        disabled={isDisabled}
                        maxLength={3}
                        style={{
                            minHeight: '64px',
                            boxShadow: calculations.isTAExceeding
                                ? '0 25px 50px -12px rgba(220, 38, 38, 0.25), inset 0 2px 4px 0 rgba(220, 38, 38, 0.06)'
                                : calculations.hasValidTA
                                    ? '0 25px 50px -12px rgba(16, 185, 129, 0.25), inset 0 2px 4px 0 rgba(16, 185, 129, 0.06)'
                                    : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        }}
                    />
                    {calculations.isTAExceeding && (
                        <ValidationMessage
                            type="error"
                            message={`Maximum allowed: ${selectedSubject.maxTA}`}
                        />
                    )}
                    {!calculations.isTAExceeding && calculations.isTAFailing && (
                        <ValidationMessage
                            type="warning"
                            message={`Minimum required: ${calculations.minTA}`}
                        />
                    )}
                    {calculations.hasValidTA && (
                        <ValidationMessage
                            type="success"
                            message="Valid marks entered"
                        />
                    )}
                </div>

                {/* CE Input */}
                <div className="space-y-3">
                    <label className="block text-base font-black text-slate-800 mb-3 tracking-wide">
                        CE <span className="text-slate-600 font-semibold">(Max: {selectedSubject.maxCE})</span>
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        enterKeyHint="done"
                        data-student={student.id}
                        data-field="ce"
                        value={currentMarks.ce}
                        onChange={(e) => handleCEChange(e.target.value)}
                        onKeyDown={handleCEKeyDown}
                        className={`w-full p-5 text-2xl text-center border-3 rounded-2xl focus:ring-6 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all duration-300 ease-out transform font-bold ${calculations.isCEExceeding
                            ? 'border-red-600 bg-red-50 text-red-800 ring-6 ring-red-500/30 shadow-2xl shadow-red-500/25 animate-pulse scale-[1.02]'
                            : calculations.isCEFailing
                                ? 'border-orange-600 bg-orange-50 text-orange-800 ring-6 ring-orange-500/30 shadow-xl shadow-orange-500/20 scale-[1.01]'
                                : calculations.hasValidCE
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-6 ring-emerald-500/30 shadow-xl shadow-emerald-500/20 scale-[1.02]'
                                    : 'border-slate-300 hover:border-slate-400 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] active:shadow-inner bg-white'
                            }`}
                        placeholder="0"
                        disabled={isDisabled}
                        maxLength={3}
                        style={{
                            minHeight: '64px',
                            boxShadow: calculations.isCEExceeding
                                ? '0 25px 50px -12px rgba(220, 38, 38, 0.25), inset 0 2px 4px 0 rgba(220, 38, 38, 0.06)'
                                : calculations.hasValidCE
                                    ? '0 25px 50px -12px rgba(16, 185, 129, 0.25), inset 0 2px 4px 0 rgba(16, 185, 129, 0.06)'
                                    : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        }}
                    />
                    {calculations.isCEExceeding && (
                        <ValidationMessage
                            type="error"
                            message={`Maximum allowed: ${selectedSubject.maxCE}`}
                        />
                    )}
                    {!calculations.isCEExceeding && calculations.isCEFailing && (
                        <ValidationMessage
                            type="warning"
                            message={`Minimum required: ${calculations.minCE}`}
                        />
                    )}
                    {calculations.hasValidCE && (
                        <ValidationMessage
                            type="success"
                            message="Valid marks entered"
                        />
                    )}
                </div>

                {/* Total Score */}
                <div className="space-y-3">
                    <label className="block text-base font-black text-slate-800 mb-3 tracking-wide">
                        Total Score
                    </label>
                    <div
                        className="w-full p-5 text-3xl text-center font-black text-slate-900 bg-gradient-to-br from-slate-100 via-white to-slate-50 border-3 border-slate-300 rounded-2xl shadow-lg"
                        style={{
                            minHeight: '64px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), inset 0 2px 4px 0 rgba(255, 255, 255, 0.06)'
                        }}
                    >
                        <div className="flex items-center justify-center h-full">
                            {currentMarks.ta && currentMarks.ce ? (
                                <span className="bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
                                    {calculations.total}
                                </span>
                            ) : (
                                <span className="text-slate-400">-</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleClearClick}
                        disabled={isDisabled || (!currentMarks.ta && !currentMarks.ce)}
                        className="w-full mt-4 px-4 py-3 text-base font-bold bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl active:shadow-inner"
                        title={`Clear marks for ${student.name}`}
                        style={{
                            minHeight: '56px',
                            boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.4), 0 4px 6px -2px rgba(220, 38, 38, 0.05)'
                        }}
                    >
                        <i className="fa-solid fa-trash text-base mr-2"></i>
                        Clear Marks
                    </button>
                </div>
            </div>
        </div>
    );
});

OptimizedStudentCard.displayName = 'OptimizedStudentCard';

// Memoized Validation Message Component
interface ValidationMessageProps {
    type: 'error' | 'warning' | 'success';
    message: string;
}

const ValidationMessage = memo<ValidationMessageProps>(({ type, message }) => {
    const styles = {
        error: {
            container: 'mt-3 p-4 bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-2xl shadow-lg animate-in slide-in-from-top-2 duration-300',
            icon: 'fa-solid fa-exclamation-triangle text-red-700 text-base animate-bounce',
            text: 'text-base font-bold text-red-800'
        },
        warning: {
            container: 'mt-3 p-4 bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-2xl shadow-lg animate-in slide-in-from-top-2 duration-300',
            icon: 'fa-solid fa-exclamation-circle text-orange-700 text-base',
            text: 'text-base font-semibold text-orange-800'
        },
        success: {
            container: 'mt-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-2xl shadow-lg animate-in slide-in-from-top-2 duration-300',
            icon: 'fa-solid fa-check-circle text-emerald-700 text-base animate-pulse',
            text: 'text-base font-bold text-emerald-800'
        }
    };

    const style = styles[type];

    return (
        <div
            className={style.container}
            style={{
                boxShadow: type === 'error'
                    ? '0 10px 15px -3px rgba(220, 38, 38, 0.2), 0 4px 6px -2px rgba(220, 38, 38, 0.05)'
                    : type === 'warning'
                        ? '0 10px 15px -3px rgba(251, 146, 60, 0.2), 0 4px 6px -2px rgba(251, 146, 60, 0.05)'
                        : '0 10px 15px -3px rgba(16, 185, 129, 0.2), 0 4px 6px -2px rgba(16, 185, 129, 0.05)'
            }}
        >
            <div className="flex items-center gap-3">
                <i className={style.icon}></i>
                <span className={style.text}>{message}</span>
            </div>
        </div>
    );
});

ValidationMessage.displayName = 'ValidationMessage';

// Memoized Student List Item for quick access
interface StudentListItemProps {
    student: StudentRecord;
    index: number;
    originalIndex: number;
    isCompleted: boolean;
    isCurrent: boolean;
    onJumpToStudent: (studentId: string) => void;
}

export const OptimizedStudentListItem = memo<StudentListItemProps>(({
    student,
    index,
    originalIndex,
    isCompleted,
    isCurrent,
    onJumpToStudent
}) => {
    const handleClick = useCallback(() => {
        onJumpToStudent(student.id);
    }, [student.id, onJumpToStudent]);

    return (
        <button
            onClick={handleClick}
            className={`w-full p-3 text-left rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${isCurrent
                ? 'bg-blue-500 text-white shadow-md'
                : isCompleted
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium text-sm">{student.name}</div>
                    <div className="text-xs opacity-75">Adm: {student.adNo}</div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">#{originalIndex + 1}</span>
                    {isCompleted && <i className="fa-solid fa-check-circle text-xs"></i>}
                    {isCurrent && <i className="fa-solid fa-arrow-right text-xs"></i>}
                </div>
            </div>
        </button>
    );
});

OptimizedStudentListItem.displayName = 'OptimizedStudentListItem';

// Memoized Load More Button
interface LoadMoreButtonProps {
    hasMore: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    remainingCount: number;
}

export const LoadMoreButton = memo<LoadMoreButtonProps>(({
    hasMore,
    isLoading,
    onLoadMore,
    remainingCount
}) => {
    if (!hasMore) return null;

    return (
        <div className="mx-4 md:mx-0 mb-4">
            <button
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full p-4 bg-white border-2 border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99]"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading more students...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <i className="fa-solid fa-chevron-down"></i>
                        <span>Load {Math.min(remainingCount, 10)} more students ({remainingCount} remaining)</span>
                    </div>
                )}
            </button>
        </div>
    );
});

LoadMoreButton.displayName = 'LoadMoreButton';