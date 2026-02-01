import React from 'react';

// Enhanced base shimmer animation component with improved timing and visual feedback
const ShimmerEffect: React.FC<{
    className?: string;
    intensity?: 'subtle' | 'normal' | 'strong';
    speed?: 'slow' | 'normal' | 'fast';
}> = ({ className = '', intensity = 'normal', speed = 'normal' }) => {
    const intensityClasses = {
        subtle: 'from-slate-100 via-slate-200 to-slate-100',
        normal: 'from-slate-200 via-slate-300 to-slate-200',
        strong: 'from-slate-300 via-slate-400 to-slate-300'
    };

    const speedClasses = {
        slow: 'animate-shimmer-slow',
        normal: 'animate-shimmer',
        fast: 'animate-shimmer-fast'
    };

    return (
        <div
            className={`animate-pulse bg-gradient-to-r ${intensityClasses[intensity]} bg-[length:200%_100%] ${speedClasses[speed]} ${className}`}
            style={{
                backgroundImage: `linear-gradient(90deg, 
                    transparent 0%, 
                    rgba(255,255,255,0.4) 50%, 
                    transparent 100%
                )`,
                backgroundSize: '200% 100%',
                animation: `shimmer ${speed === 'fast' ? '1s' : speed === 'slow' ? '3s' : '2s'} ease-in-out infinite`
            }}
        ></div>
    );
};

// Enhanced Mobile Faculty Entry Skeleton Components with better card structure matching
export const MobileFacultyEntrySkeleton: React.FC<{
    studentCount?: number;
    showNavigation?: boolean;
    showProgress?: boolean;
}> = ({ studentCount = 3, showNavigation = true, showProgress = true }) => (
    <div className="space-y-4 p-4 md:p-0">
        {/* Enhanced Header Skeleton with contextual information */}
        <div className="px-4 md:px-0">
            <ShimmerEffect className="h-8 w-64 rounded mb-2" intensity="strong" />
            <ShimmerEffect className="h-4 w-48 rounded" intensity="subtle" />
        </div>

        {/* Enhanced Selection Controls Skeleton with better visual hierarchy */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200 mx-4 md:mx-0">
            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
                <div>
                    <ShimmerEffect className="h-4 w-16 rounded mb-2" intensity="subtle" />
                    <ShimmerEffect className="h-12 w-full rounded-xl" />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <ShimmerEffect className="h-4 w-20 rounded" intensity="subtle" />
                        <ShimmerEffect className="h-4 w-12 rounded-full" intensity="subtle" />
                    </div>
                    <ShimmerEffect className="h-12 w-full rounded-xl" />
                </div>
            </div>

            {/* Enhanced Subject Info Skeleton with better layout */}
            <div className="mt-4 p-3 md:p-4 bg-slate-50 rounded-xl">
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <ShimmerEffect className="h-4 w-16 rounded" intensity="subtle" />
                            <ShimmerEffect className="h-4 w-8 rounded" />
                        </div>
                        <div className="flex items-center gap-2">
                            <ShimmerEffect className="h-4 w-16 rounded" intensity="subtle" />
                            <ShimmerEffect className="h-4 w-8 rounded" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <ShimmerEffect className="h-4 w-20 rounded" intensity="subtle" />
                        <ShimmerEffect className="h-8 w-full rounded bg-blue-50" intensity="subtle" />
                    </div>
                </div>
            </div>

            {/* Performance Monitor Skeleton */}
            <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShimmerEffect className="w-3 h-3 rounded-full" />
                        <div>
                            <ShimmerEffect className="h-4 w-32 rounded mb-1" intensity="subtle" />
                            <ShimmerEffect className="h-3 w-24 rounded" intensity="subtle" />
                        </div>
                    </div>
                    <ShimmerEffect className="h-8 w-20 rounded-lg" />
                </div>
            </div>
        </div>

        {/* Enhanced Mobile Navigation Header Skeleton */}
        {showNavigation && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mx-4 md:mx-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <ShimmerEffect className="h-6 w-32 rounded" intensity="strong" />
                        <ShimmerEffect className="h-4 w-4 rounded-full" intensity="subtle" />
                    </div>
                    <div className="flex items-center gap-3">
                        <ShimmerEffect className="h-10 w-10 rounded-xl" />
                        <div className="text-right">
                            <ShimmerEffect className="h-4 w-20 rounded mb-1" />
                            <ShimmerEffect className="h-3 w-16 rounded" intensity="subtle" />
                        </div>
                    </div>
                </div>

                {/* Enhanced Navigation Controls Skeleton */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <ShimmerEffect className="h-12 w-12 rounded-xl" />
                        <div className="flex-1 mx-4 text-center">
                            <ShimmerEffect className="h-6 w-32 rounded mb-1 mx-auto" intensity="strong" />
                            <ShimmerEffect className="h-4 w-24 rounded mb-2 mx-auto" />
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <ShimmerEffect className="h-3 w-3 rounded" intensity="subtle" />
                                <ShimmerEffect className="h-3 w-20 rounded" intensity="subtle" />
                                <ShimmerEffect className="h-3 w-3 rounded" intensity="subtle" />
                            </div>
                            <ShimmerEffect className="h-6 w-20 rounded-full mx-auto" />
                        </div>
                        <ShimmerEffect className="h-12 w-12 rounded-xl" />
                    </div>

                    {/* Enhanced Progress Bar Skeleton */}
                    {showProgress && (
                        <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <ShimmerEffect className="h-3 w-20 rounded" intensity="subtle" />
                                <ShimmerEffect className="h-3 w-8 rounded" intensity="subtle" />
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                <ShimmerEffect className="h-full w-3/5 rounded-full" intensity="normal" speed="slow" />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <ShimmerEffect className="h-3 w-16 rounded" intensity="subtle" />
                                <ShimmerEffect className="h-3 w-16 rounded" intensity="subtle" />
                            </div>
                        </div>
                    )}

                    {/* Enhanced Quick Jump Indicators Skeleton */}
                    <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2">
                        {Array.from({ length: Math.min(studentCount + 2, 8) }, (_, i) => (
                            <ShimmerEffect
                                key={i}
                                className={`flex-shrink-0 w-8 h-8 rounded-full ${i === 0 ? 'ring-2 ring-blue-300' : ''}`}
                                intensity={i === 0 ? 'strong' : 'normal'}
                            />
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Enhanced Student Cards Skeleton with varied loading states */}
        {Array.from({ length: studentCount }, (_, i) => (
            <StudentCardSkeleton
                key={i}
                isActive={i === 0}
                completionState={i < studentCount / 2 ? 'completed' : i < studentCount * 0.8 ? 'partial' : 'pending'}
            />
        ))}

        {/* Enhanced Action Buttons Skeleton */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mx-4 md:mx-0">
            <div className="text-center mb-4">
                <ShimmerEffect className="h-6 w-24 rounded mb-1 mx-auto" intensity="strong" />
                <ShimmerEffect className="h-4 w-32 rounded mx-auto" intensity="subtle" />
            </div>
            <div className="flex gap-4">
                <ShimmerEffect className="flex-1 h-14 rounded-xl" />
                <ShimmerEffect className="flex-2 h-14 rounded-xl" intensity="strong" />
            </div>
        </div>
    </div>
);

// Enhanced Individual Student Card Skeleton with completion states
export const StudentCardSkeleton: React.FC<{
    isActive?: boolean;
    completionState?: 'pending' | 'partial' | 'completed';
}> = ({ isActive = false, completionState = 'pending' }) => {
    const getCompletionStyles = () => {
        switch (completionState) {
            case 'completed':
                return {
                    border: 'border-emerald-200',
                    background: 'bg-gradient-to-br from-emerald-50 to-white',
                    intensity: 'subtle' as const
                };
            case 'partial':
                return {
                    border: 'border-orange-200',
                    background: 'bg-gradient-to-br from-orange-50 to-white',
                    intensity: 'normal' as const
                };
            default:
                return {
                    border: 'border-slate-200',
                    background: 'bg-white',
                    intensity: 'normal' as const
                };
        }
    };

    const styles = getCompletionStyles();
    const activeStyles = isActive ? 'ring-2 ring-blue-300 ring-offset-2' : '';

    return (
        <div className={`${styles.background} rounded-2xl p-6 shadow-lg ${styles.border} border mx-4 md:mx-0 animate-pulse ${activeStyles}`}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <ShimmerEffect className="h-5 w-32 rounded" intensity={styles.intensity} />
                        <ShimmerEffect
                            className={`h-6 w-16 rounded-full ${completionState === 'completed' ? 'bg-emerald-100' :
                                completionState === 'partial' ? 'bg-orange-100' :
                                    'bg-slate-100'
                                }`}
                            intensity={styles.intensity}
                        />
                    </div>
                    <ShimmerEffect className="h-4 w-24 rounded" intensity="subtle" />
                </div>
                <div className="text-right">
                    <ShimmerEffect
                        className={`h-8 w-20 rounded-full ${completionState === 'completed' ? 'bg-emerald-100' :
                            completionState === 'partial' ? 'bg-orange-100' :
                                'bg-slate-100'
                            }`}
                        intensity={styles.intensity}
                    />
                    <ShimmerEffect className="h-3 w-16 rounded mt-1" intensity="subtle" />
                </div>
            </div>

            {/* Enhanced input fields skeleton with better visual feedback */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(j => (
                    <div key={j}>
                        <ShimmerEffect className="h-4 w-16 rounded mb-2" intensity="subtle" />
                        <ShimmerEffect
                            className={`h-12 w-full rounded-xl ${j <= 2 ? (completionState === 'completed' ? 'bg-emerald-100' :
                                completionState === 'partial' && j === 1 ? 'bg-emerald-100' :
                                    'bg-slate-100') : 'bg-slate-50'
                                }`}
                            intensity={j <= 2 ? styles.intensity : 'subtle'}
                        />
                        {j < 3 && (
                            <ShimmerEffect
                                className={`h-8 w-full rounded-xl mt-3 ${completionState === 'completed' ? 'bg-emerald-50' :
                                    completionState === 'partial' && j === 1 ? 'bg-emerald-50' :
                                        'bg-slate-50'
                                    }`}
                                intensity="subtle"
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Completion indicator */}
            {completionState !== 'pending' && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-center gap-2">
                        <ShimmerEffect
                            className={`w-4 h-4 rounded-full ${completionState === 'completed' ? 'bg-emerald-200' : 'bg-orange-200'
                                }`}
                            intensity="subtle"
                        />
                        <ShimmerEffect
                            className={`h-3 w-16 rounded ${completionState === 'completed' ? 'bg-emerald-100' : 'bg-orange-100'
                                }`}
                            intensity="subtle"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

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

// Enhanced Progressive Loading Component with contextual messages and better UX
export const ProgressiveLoadingSkeleton: React.FC<{
    stage: 'initializing' | 'loading-subjects' | 'loading-students' | 'preparing-interface';
    progress?: number;
    message?: string;
    showDetailedProgress?: boolean;
}> = ({ stage, progress = 0, message, showDetailedProgress = true }) => {
    const getLoadingMessage = () => {
        if (message) return message;

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

    const getStageDescription = () => {
        switch (stage) {
            case 'initializing':
                return 'Setting up the marks entry environment and checking permissions';
            case 'loading-subjects':
                return 'Retrieving subject configurations and assessment criteria';
            case 'loading-students':
                return 'Loading student records and existing marks data';
            case 'preparing-interface':
                return 'Optimizing interface for your device and preparing input fields';
            default:
                return 'Please wait while we prepare your workspace';
        }
    };

    const getProgressColor = () => {
        switch (stage) {
            case 'initializing':
                return 'emerald';
            case 'loading-subjects':
                return 'blue';
            case 'loading-students':
                return 'purple';
            case 'preparing-interface':
                return 'indigo';
            default:
                return 'slate';
        }
    };

    const color = getProgressColor();

    return (
        <div className="space-y-4 p-4 md:p-0">
            {/* Mobile Progressive Loading */}
            <div className="block md:hidden">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center mx-4">
                    <div className="mb-6">
                        <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                            <div
                                className={`absolute inset-0 rounded-full border-4 border-${color}-500 border-t-transparent animate-spin`}
                                style={{
                                    transform: progress > 0 ? `rotate(${progress * 3.6}deg)` : undefined,
                                    transition: progress > 0 ? 'transform 0.3s ease-out' : undefined
                                }}
                            ></div>
                            <i className={`fa-solid ${getLoadingIcon()} text-${color}-600 text-xl animate-pulse`}></i>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                            Faculty Marks Entry
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                            {getLoadingMessage()}
                        </p>

                        {showDetailedProgress && (
                            <p className="text-xs text-slate-500 mb-4">
                                {getStageDescription()}
                            </p>
                        )}

                        {progress > 0 && (
                            <>
                                <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
                                    <div
                                        className={`bg-${color}-500 h-2 rounded-full transition-all duration-500 ease-out relative`}
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse`}></div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {Math.round(progress)}% complete
                                </div>
                            </>
                        )}

                        {/* Stage indicators */}
                        {showDetailedProgress && (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                {['initializing', 'loading-subjects', 'loading-students', 'preparing-interface'].map((stageKey, index) => {
                                    const isActive = stageKey === stage;
                                    const isCompleted = ['initializing', 'loading-subjects', 'loading-students', 'preparing-interface'].indexOf(stage) > index;

                                    return (
                                        <div
                                            key={stageKey}
                                            className={`w-2 h-2 rounded-full transition-all duration-300 ${isCompleted ? `bg-${color}-500` :
                                                isActive ? `bg-${color}-400 animate-pulse` :
                                                    'bg-slate-300'
                                                }`}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Enhanced contextual skeleton preview */}
                    <div className="space-y-3 opacity-30">
                        <ShimmerEffect className="h-4 w-32 rounded mx-auto" intensity="subtle" />
                        <ShimmerEffect className="h-8 w-full rounded-xl" intensity="subtle" />
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map(i => (
                                <ShimmerEffect key={i} className="h-6 w-full rounded" intensity="subtle" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Desktop Progressive Loading */}
            <div className="hidden md:flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                        <div
                            className={`absolute inset-0 rounded-full border-4 border-${color}-500 border-t-transparent animate-spin`}
                            style={{
                                transform: progress > 0 ? `rotate(${progress * 3.6}deg)` : undefined,
                                transition: progress > 0 ? 'transform 0.3s ease-out' : undefined
                            }}
                        ></div>
                        <i className={`fa-solid ${getLoadingIcon()} text-${color}-600 text-2xl animate-pulse`}></i>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Faculty Marks Entry System
                    </h3>
                    <p className="text-slate-600 mb-2">
                        {getLoadingMessage()}
                    </p>

                    {showDetailedProgress && (
                        <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
                            {getStageDescription()}
                        </p>
                    )}

                    {progress > 0 && (
                        <>
                            <div className="w-64 bg-slate-200 rounded-full h-2 mb-2 mx-auto overflow-hidden">
                                <div
                                    className={`bg-${color}-500 h-2 rounded-full transition-all duration-500 ease-out relative`}
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse`}></div>
                                </div>
                            </div>
                            <div className="text-sm text-slate-500">
                                {Math.round(progress)}% complete
                            </div>
                        </>
                    )}

                    {/* Desktop stage indicators */}
                    {showDetailedProgress && (
                        <div className="flex items-center justify-center gap-3 mt-4">
                            {[
                                { key: 'initializing', label: 'Init' },
                                { key: 'loading-subjects', label: 'Subjects' },
                                { key: 'loading-students', label: 'Students' },
                                { key: 'preparing-interface', label: 'Interface' }
                            ].map(({ key, label }, index) => {
                                const isActive = key === stage;
                                const isCompleted = ['initializing', 'loading-subjects', 'loading-students', 'preparing-interface'].indexOf(stage) > index;

                                return (
                                    <div key={key} className="flex flex-col items-center gap-1">
                                        <div
                                            className={`w-3 h-3 rounded-full transition-all duration-300 ${isCompleted ? `bg-${color}-500` :
                                                isActive ? `bg-${color}-400 animate-pulse` :
                                                    'bg-slate-300'
                                                }`}
                                        />
                                        <span className={`text-xs ${isCompleted || isActive ? `text-${color}-600` : 'text-slate-400'
                                            }`}>
                                            {label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Enhanced loading state for individual operations with better visual feedback
export const OperationLoadingSkeleton: React.FC<{
    operation: 'saving' | 'clearing' | 'loading-students' | 'validating' | 'syncing';
    message?: string;
    progress?: number;
    showProgress?: boolean;
}> = ({ operation, message, progress, showProgress = false }) => {
    const getOperationDetails = () => {
        switch (operation) {
            case 'saving':
                return {
                    icon: 'fa-save',
                    text: message || 'Saving marks to database...',
                    color: 'emerald',
                    description: 'Securely storing your marks data'
                };
            case 'clearing':
                return {
                    icon: 'fa-trash',
                    text: message || 'Clearing marks data...',
                    color: 'red',
                    description: 'Removing selected marks from database'
                };
            case 'loading-students':
                return {
                    icon: 'fa-users',
                    text: message || 'Loading student records...',
                    color: 'blue',
                    description: 'Fetching student information and existing marks'
                };
            case 'validating':
                return {
                    icon: 'fa-check-circle',
                    text: message || 'Validating marks data...',
                    color: 'orange',
                    description: 'Checking marks against validation rules'
                };
            case 'syncing':
                return {
                    icon: 'fa-sync-alt',
                    text: message || 'Syncing with cloud...',
                    color: 'purple',
                    description: 'Synchronizing offline changes with server'
                };
            default:
                return {
                    icon: 'fa-spinner',
                    text: 'Processing...',
                    color: 'slate',
                    description: 'Please wait while we process your request'
                };
        }
    };

    const { icon, text, color, description } = getOperationDetails();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-200 max-w-sm mx-4 text-center">
                <div className="mb-4">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${color}-100 mb-4 relative`}>
                        {showProgress && progress !== undefined ? (
                            <>
                                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                                <div
                                    className={`absolute inset-0 rounded-full border-4 border-${color}-500 border-t-transparent transition-all duration-300`}
                                    style={{
                                        transform: `rotate(${progress * 3.6}deg)`,
                                    }}
                                ></div>
                                <i className={`fa-solid ${icon} text-${color}-600 text-2xl relative z-10`}></i>
                            </>
                        ) : (
                            <i className={`fa-solid ${icon} text-${color}-600 text-2xl animate-pulse`}></i>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                        Processing Request
                    </h3>
                    <p className="text-sm text-slate-600 mb-2">
                        {text}
                    </p>
                    <p className="text-xs text-slate-500">
                        {description}
                    </p>

                    {showProgress && progress !== undefined && (
                        <div className="mt-4">
                            <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                                <div
                                    className={`bg-${color}-500 h-2 rounded-full transition-all duration-300 ease-out`}
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <div className="text-xs text-slate-500">
                                {Math.round(progress)}% complete
                            </div>
                        </div>
                    )}
                </div>

                {!showProgress && (
                    <div className="flex items-center justify-center gap-1">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className={`w-2 h-2 bg-${color}-500 rounded-full animate-bounce`}
                                style={{ animationDelay: `${i * 0.1}s` }}
                            ></div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};