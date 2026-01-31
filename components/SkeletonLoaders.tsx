import React from 'react';

// Base shimmer animation component
const ShimmerEffect: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 bg-[length:200%_100%] animate-shimmer ${className}`}></div>
);

// Mobile Faculty Entry Skeleton Components
export const MobileFacultyEntrySkeleton: React.FC = () => (
    <div className="space-y-4 p-4 md:p-0">
        {/* Header Skeleton */}
        <div className="px-4 md:px-0">
            <ShimmerEffect className="h-8 w-64 rounded mb-2" />
            <ShimmerEffect className="h-4 w-48 rounded" />
        </div>

        {/* Selection Controls Skeleton */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200 mx-4 md:mx-0">
            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
                <div>
                    <ShimmerEffect className="h-4 w-16 rounded mb-2" />
                    <ShimmerEffect className="h-12 w-full rounded-xl" />
                </div>
                <div>
                    <ShimmerEffect className="h-4 w-20 rounded mb-2" />
                    <ShimmerEffect className="h-12 w-full rounded-xl" />
                </div>
            </div>

            {/* Subject Info Skeleton */}
            <div className="mt-4 p-3 md:p-4 bg-slate-50 rounded-xl">
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                    <div className="space-y-2">
                        <ShimmerEffect className="h-4 w-24 rounded" />
                        <ShimmerEffect className="h-4 w-32 rounded" />
                    </div>
                    <div className="space-y-2">
                        <ShimmerEffect className="h-4 w-20 rounded" />
                        <ShimmerEffect className="h-8 w-full rounded" />
                    </div>
                </div>
            </div>
        </div>

        {/* Mobile Navigation Header Skeleton */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mx-4 md:mx-0">
            <div className="flex items-center justify-between mb-4">
                <ShimmerEffect className="h-6 w-32 rounded" />
                <div className="flex items-center gap-3">
                    <ShimmerEffect className="h-10 w-10 rounded-xl" />
                    <div className="text-right">
                        <ShimmerEffect className="h-4 w-20 rounded mb-1" />
                        <ShimmerEffect className="h-3 w-16 rounded" />
                    </div>
                </div>
            </div>

            {/* Navigation Controls Skeleton */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                    <ShimmerEffect className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 mx-4 text-center">
                        <ShimmerEffect className="h-6 w-32 rounded mb-1 mx-auto" />
                        <ShimmerEffect className="h-4 w-24 rounded mb-2 mx-auto" />
                        <ShimmerEffect className="h-4 w-40 rounded mb-2 mx-auto" />
                        <ShimmerEffect className="h-6 w-20 rounded mx-auto" />
                    </div>
                    <ShimmerEffect className="h-12 w-12 rounded-xl" />
                </div>

                {/* Progress Bar Skeleton */}
                <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <ShimmerEffect className="h-3 w-20 rounded" />
                        <ShimmerEffect className="h-3 w-8 rounded" />
                    </div>
                    <ShimmerEffect className="h-2 w-full rounded-full" />
                    <div className="flex items-center justify-between mt-1">
                        <ShimmerEffect className="h-3 w-16 rounded" />
                        <ShimmerEffect className="h-3 w-16 rounded" />
                    </div>
                </div>

                {/* Quick Jump Indicators Skeleton */}
                <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <ShimmerEffect key={i} className="flex-shrink-0 w-8 h-8 rounded-full" />
                    ))}
                </div>
            </div>
        </div>

        {/* Student Cards Skeleton */}
        {[1, 2, 3].map(i => (
            <StudentCardSkeleton key={i} />
        ))}

        {/* Action Buttons Skeleton */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mx-4 md:mx-0">
            <div className="text-center mb-4">
                <ShimmerEffect className="h-6 w-24 rounded mb-1 mx-auto" />
                <ShimmerEffect className="h-4 w-32 rounded mx-auto" />
            </div>
            <div className="flex gap-4">
                <ShimmerEffect className="flex-1 h-14 rounded-xl" />
                <ShimmerEffect className="flex-2 h-14 rounded-xl" />
            </div>
        </div>
    </div>
);

// Individual Student Card Skeleton
export const StudentCardSkeleton: React.FC = () => (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mx-4 md:mx-0 animate-pulse">
        <div className="flex items-center justify-between mb-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <ShimmerEffect className="h-5 w-32 rounded" />
                    <ShimmerEffect className="h-6 w-16 rounded-full" />
                </div>
                <ShimmerEffect className="h-4 w-24 rounded" />
            </div>
            <div className="text-right">
                <ShimmerEffect className="h-8 w-20 rounded-full" />
                <ShimmerEffect className="h-3 w-16 rounded mt-1" />
            </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(j => (
                <div key={j}>
                    <ShimmerEffect className="h-4 w-16 rounded mb-2" />
                    <ShimmerEffect className="h-12 w-full rounded-xl" />
                    {j < 3 && <ShimmerEffect className="h-8 w-full rounded-xl mt-3" />}
                </div>
            ))}
        </div>
    </div>
);

// Desktop Table Skeleton
export const DesktopTableSkeleton: React.FC = () => (
    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Header Skeleton */}
        <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
                <ShimmerEffect className="h-6 w-48 rounded" />
                <ShimmerEffect className="h-4 w-20 rounded" />
            </div>
        </div>

        {/* Table Content Skeleton */}
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50">
                    <tr>
                        {[1, 2, 3, 4, 5, 6, 7].map(i => (
                            <th key={i} className="p-4">
                                <ShimmerEffect className="h-4 w-16 rounded mx-auto" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {[1, 2, 3, 4, 5].map(i => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-4"><ShimmerEffect className="h-4 w-16 rounded" /></td>
                            <td className="p-4"><ShimmerEffect className="h-4 w-24 rounded" /></td>
                            <td className="p-4"><ShimmerEffect className="h-12 w-20 rounded-xl mx-auto" /></td>
                            <td className="p-4"><ShimmerEffect className="h-12 w-20 rounded-xl mx-auto" /></td>
                            <td className="p-4"><ShimmerEffect className="h-4 w-12 rounded mx-auto" /></td>
                            <td className="p-4"><ShimmerEffect className="h-6 w-16 rounded-full mx-auto" /></td>
                            <td className="p-4"><ShimmerEffect className="h-6 w-6 rounded mx-auto" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Table Footer Skeleton */}
        <div className="p-6 border-t border-slate-200 flex justify-between items-center">
            <ShimmerEffect className="h-4 w-48 rounded" />
            <div className="flex gap-4">
                <ShimmerEffect className="h-10 w-24 rounded-xl" />
                <ShimmerEffect className="h-10 w-32 rounded-xl" />
            </div>
        </div>
    </div>
);

// Progressive Loading Component with contextual messages
export const ProgressiveLoadingSkeleton: React.FC<{
    stage: 'initializing' | 'loading-subjects' | 'loading-students' | 'preparing-interface';
    progress?: number;
}> = ({ stage, progress = 0 }) => {
    const getLoadingMessage = () => {
        switch (stage) {
            case 'initializing':
                return 'Initializing faculty entry system...';
            case 'loading-subjects':
                return 'Loading subject configurations...';
            case 'loading-students':
                return 'Fetching student records...';
            case 'preparing-interface':
                return 'Preparing marks entry interface...';
            default:
                return 'Loading...';
        }
    };

    const getLoadingIcon = () => {
        switch (stage) {
            case 'initializing':
                return 'fa-cog';
            case 'loading-subjects':
                return 'fa-book';
            case 'loading-students':
                return 'fa-users';
            case 'preparing-interface':
                return 'fa-clipboard-list';
            default:
                return 'fa-spinner';
        }
    };

    return (
        <div className="space-y-4 p-4 md:p-0">
            {/* Mobile Progressive Loading */}
            <div className="block md:hidden">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center mx-4">
                    <div className="mb-6">
                        <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                            <div
                                className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
                                style={{
                                    transform: `rotate(${progress * 3.6}deg)`,
                                    transition: 'transform 0.3s ease-out'
                                }}
                            ></div>
                            <i className={`fa-solid ${getLoadingIcon()} text-emerald-600 text-xl animate-pulse`}></i>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                            Faculty Marks Entry
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            {getLoadingMessage()}
                        </p>

                        {progress > 0 && (
                            <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                                <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        )}

                        {progress > 0 && (
                            <div className="text-xs text-slate-500">
                                {Math.round(progress)}% complete
                            </div>
                        )}
                    </div>

                    {/* Contextual skeleton preview */}
                    <div className="space-y-3 opacity-50">
                        <ShimmerEffect className="h-4 w-32 rounded mx-auto" />
                        <ShimmerEffect className="h-8 w-full rounded-xl" />
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map(i => (
                                <ShimmerEffect key={i} className="h-6 w-full rounded" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Progressive Loading */}
            <div className="hidden md:flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                        <div
                            className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
                            style={{
                                transform: `rotate(${progress * 3.6}deg)`,
                                transition: 'transform 0.3s ease-out'
                            }}
                        ></div>
                        <i className={`fa-solid ${getLoadingIcon()} text-emerald-600 text-2xl animate-pulse`}></i>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Faculty Marks Entry System
                    </h3>
                    <p className="text-slate-600 mb-4">
                        {getLoadingMessage()}
                    </p>

                    {progress > 0 && (
                        <>
                            <div className="w-64 bg-slate-200 rounded-full h-2 mb-2 mx-auto">
                                <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <div className="text-sm text-slate-500">
                                {Math.round(progress)}% complete
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Loading state for individual operations
export const OperationLoadingSkeleton: React.FC<{
    operation: 'saving' | 'clearing' | 'loading-students' | 'validating';
    message?: string;
}> = ({ operation, message }) => {
    const getOperationDetails = () => {
        switch (operation) {
            case 'saving':
                return { icon: 'fa-save', text: message || 'Saving marks to database...', color: 'emerald' };
            case 'clearing':
                return { icon: 'fa-trash', text: message || 'Clearing marks data...', color: 'red' };
            case 'loading-students':
                return { icon: 'fa-users', text: message || 'Loading student records...', color: 'blue' };
            case 'validating':
                return { icon: 'fa-check-circle', text: message || 'Validating marks data...', color: 'orange' };
            default:
                return { icon: 'fa-spinner', text: 'Processing...', color: 'slate' };
        }
    };

    const { icon, text, color } = getOperationDetails();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-200 max-w-sm mx-4 text-center">
                <div className="mb-4">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${color}-100 mb-4`}>
                        <i className={`fa-solid ${icon} text-${color}-600 text-2xl animate-pulse`}></i>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                        Processing Request
                    </h3>
                    <p className="text-sm text-slate-600">
                        {text}
                    </p>
                </div>

                <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`w-2 h-2 bg-${color}-500 rounded-full animate-bounce`}
                            style={{ animationDelay: `${i * 0.1}s` }}
                        ></div>
                    ))}
                </div>
            </div>
        </div>
    );
};