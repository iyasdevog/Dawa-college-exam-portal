import React, { useState, useEffect } from 'react';
import { OfflineDraft } from '../../infrastructure/services/offlineStorageService';

interface DraftRecoveryModalProps {
    isVisible: boolean;
    drafts: OfflineDraft[];
    onRecoverDraft: (draft: OfflineDraft) => void;
    onDeleteDraft: (draftId: string) => void;
    onClose: () => void;
    currentSubjectId?: string;
}

const DraftRecoveryModal: React.FC<DraftRecoveryModalProps> = ({
    isVisible,
    drafts,
    onRecoverDraft,
    onDeleteDraft,
    onClose,
    currentSubjectId
}) => {
    const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
    const [filterSubject, setFilterSubject] = useState(true);

    // Filter drafts based on current subject if enabled
    const filteredDrafts = filterSubject && currentSubjectId
        ? drafts.filter(draft => draft.subjectId === currentSubjectId)
        : drafts;

    // Sort drafts by timestamp (newest first)
    const sortedDrafts = [...filteredDrafts].sort((a, b) => b.timestamp - a.timestamp);

    useEffect(() => {
        if (!isVisible) {
            setSelectedDrafts(new Set());
        }
    }, [isVisible]);

    const handleSelectDraft = (draftId: string) => {
        const newSelected = new Set(selectedDrafts);
        if (newSelected.has(draftId)) {
            newSelected.delete(draftId);
        } else {
            newSelected.add(draftId);
        }
        setSelectedDrafts(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedDrafts.size === sortedDrafts.length) {
            setSelectedDrafts(new Set());
        } else {
            setSelectedDrafts(new Set(sortedDrafts.map(draft => draft.id)));
        }
    };

    const handleBulkDelete = () => {
        if (selectedDrafts.size === 0) return;

        if (confirm(`Are you sure you want to delete ${selectedDrafts.size} draft(s)? This action cannot be undone.`)) {
            selectedDrafts.forEach(draftId => {
                onDeleteDraft(draftId);
            });
            setSelectedDrafts(new Set());
        }
    };

    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    const getDraftStatus = (draft: OfflineDraft): { color: string; text: string } => {
        const hasTA = draft.ta && draft.ta.trim() !== '';
        const hasCE = draft.ce && draft.ce.trim() !== '';

        if (hasTA && hasCE) {
            return { color: 'text-emerald-700 bg-emerald-100', text: 'Complete' };
        } else if (hasTA || hasCE) {
            return { color: 'text-orange-700 bg-orange-100', text: 'Partial' };
        } else {
            return { color: 'text-slate-700 bg-slate-100', text: 'Empty' };
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Draft Recovery</h2>
                            <p className="text-sm text-slate-600 mt-1">
                                Recover unsaved marks entries from local storage
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-white/50 transition-colors duration-200"
                            title="Close"
                        >
                            <i className="fa-solid fa-times text-slate-600 text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* Filters and Actions */}
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={filterSubject}
                                    onChange={(e) => setFilterSubject(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                />
                                <span className="text-sm font-medium text-slate-700">
                                    Show current subject only
                                </span>
                            </label>

                            <div className="text-sm text-slate-600">
                                {sortedDrafts.length} draft(s) found
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {sortedDrafts.length > 0 && (
                                <>
                                    <button
                                        onClick={handleSelectAll}
                                        className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors duration-200"
                                    >
                                        {selectedDrafts.size === sortedDrafts.length ? 'Deselect All' : 'Select All'}
                                    </button>

                                    {selectedDrafts.size > 0 && (
                                        <button
                                            onClick={handleBulkDelete}
                                            className="px-3 py-2 text-sm font-medium text-red-700 hover:text-red-900 hover:bg-red-100 rounded-lg transition-colors duration-200"
                                        >
                                            Delete Selected ({selectedDrafts.size})
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Drafts List */}
                <div className="flex-1 overflow-y-auto max-h-96">
                    {sortedDrafts.length === 0 ? (
                        <div className="p-12 text-center">
                            <i className="fa-solid fa-file-circle-question text-4xl text-slate-400 mb-4"></i>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Drafts Found</h3>
                            <p className="text-slate-600">
                                {filterSubject && currentSubjectId
                                    ? 'No drafts found for the current subject.'
                                    : 'No saved drafts available for recovery.'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {sortedDrafts.map((draft) => {
                                const status = getDraftStatus(draft);
                                const isSelected = selectedDrafts.has(draft.id);

                                return (
                                    <div
                                        key={draft.id}
                                        className={`p-4 border-2 rounded-xl transition-all duration-200 ${isSelected
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Selection Checkbox */}
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelectDraft(draft.id)}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded mt-1"
                                            />

                                            {/* Draft Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 truncate">
                                                            {draft.studentName}
                                                        </h4>
                                                        <p className="text-sm text-slate-600 truncate">
                                                            {draft.subjectName} • {draft.className}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2 ml-4">
                                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>
                                                            {status.text}
                                                        </span>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap">
                                                            {formatTimestamp(draft.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Marks Preview */}
                                                <div className="flex items-center gap-4 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-slate-600">TA:</span>
                                                        <span className={`text-sm font-mono px-2 py-1 rounded ${draft.ta ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            {draft.ta || '—'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-slate-600">CE:</span>
                                                        <span className={`text-sm font-mono px-2 py-1 rounded ${draft.ce ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            {draft.ce || '—'}
                                                        </span>
                                                    </div>

                                                    {draft.autoSaved && (
                                                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                                            Auto-saved
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => onRecoverDraft(draft)}
                                                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors duration-200"
                                                    >
                                                        <i className="fa-solid fa-download text-xs mr-1"></i>
                                                        Recover
                                                    </button>

                                                    <button
                                                        onClick={() => onDeleteDraft(draft.id)}
                                                        className="px-3 py-1.5 text-sm font-medium text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 rounded-lg transition-colors duration-200"
                                                    >
                                                        <i className="fa-solid fa-trash text-xs mr-1"></i>
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                            <i className="fa-solid fa-info-circle text-blue-500 mr-1"></i>
                            Drafts are automatically saved every 5 seconds while typing
                        </div>

                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DraftRecoveryModal;