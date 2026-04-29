import React, { useState } from 'react';
import { ClassReleaseSettings, SubjectConfig } from '../../../domain/entities/types';

interface ReleaseSettingsTabProps {
    allowedClasses: string[];
    releaseSettings: ClassReleaseSettings;
    onUpdateSetting: (className: string, key: keyof any, value: any) => void;
    supplementaryExams?: any[];
    subjects?: SubjectConfig[];
}

const ReleaseSettingsTab: React.FC<ReleaseSettingsTabProps> = ({
    allowedClasses,
    releaseSettings,
    onUpdateSetting,
    supplementaryExams = [],
    subjects = []
}) => {
    const [expandedClass, setExpandedClass] = useState<string | null>(null);

    return (
        <div className="px-4 md:px-0 mt-8 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
                <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tighter">
                    <i className="fa-solid fa-calendar-check mr-2 text-emerald-600"></i>
                    Scorecard Release Schedule
                </h3>
                <p className="text-slate-600 mb-8 text-sm">
                    Control when student scorecards become visible in the Public Portal. You can release them immediately or schedule a future date.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allowedClasses.map(cls => {
                        const settings = releaseSettings[cls] || { isReleased: false };
                        const classSupps = supplementaryExams.filter(su => 
                            su.className === cls && 
                            su.status === 'Completed'
                        );

                        return (
                            <div key={cls} className="bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-emerald-300 transition-all flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-bold text-slate-900">{cls} Class</h4>
                                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${settings.isReleased ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {settings.isReleased ? 'Released' : 'Hidden'}
                                    </div>
                                </div>

                                <div className="space-y-4 flex-grow">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-700">Release Status</span>
                                        <button
                                            onClick={() => onUpdateSetting(cls, 'isReleased', !settings.isReleased)}
                                            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${settings.isReleased ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings.isReleased ? 'left-7' : 'left-1'}`}></div>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Release Date & Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={settings.releaseDate ? settings.releaseDate.substring(0, 16) : ''}
                                            onChange={(e) => onUpdateSetting(cls, 'releaseDate', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                            disabled={settings.isReleased}
                                        />
                                    </div>

                                    {settings.releaseDate && !settings.isReleased && (
                                        <div className="text-[10px] font-medium text-blue-600 flex items-center gap-1">
                                            <i className="fa-solid fa-clock"></i>
                                            Scheduled for {new Date(settings.releaseDate).toLocaleString()}
                                        </div>
                                    )}

                                    <div className="pt-4 mt-2 border-t border-slate-200 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-orange-700">Supp. Release Status</span>
                                            <button
                                                onClick={() => onUpdateSetting(cls, 'isSupplementaryReleased', !settings.isSupplementaryReleased)}
                                                className={`w-12 h-6 rounded-full transition-all duration-300 relative ${settings.isSupplementaryReleased ? 'bg-orange-500' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings.isSupplementaryReleased ? 'left-7' : 'left-1'}`}></div>
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-orange-600 uppercase tracking-wider">
                                                Supp. Release Date
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={settings.supplementaryReleaseDate ? settings.supplementaryReleaseDate.substring(0, 16) : ''}
                                                onChange={(e) => onUpdateSetting(cls, 'supplementaryReleaseDate', e.target.value)}
                                                className="w-full p-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 bg-orange-50/30"
                                                disabled={settings.isSupplementaryReleased}
                                            />
                                        </div>

                                        {settings.supplementaryReleaseDate && !settings.isSupplementaryReleased && (
                                            <div className="text-[10px] font-medium text-orange-600 flex items-center gap-1">
                                                <i className="fa-solid fa-clock"></i>
                                                Scheduled for {new Date(settings.supplementaryReleaseDate).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {classSupps.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <button 
                                            onClick={() => setExpandedClass(expandedClass === cls ? null : cls)}
                                            className="w-full flex items-center justify-between p-2 rounded-lg bg-orange-100/50 text-orange-700 hover:bg-orange-100 transition-colors"
                                        >
                                            <span className="text-xs font-black uppercase tracking-tighter">
                                                <i className="fa-solid fa-list-check mr-2"></i>
                                                Entered Supp. Results ({classSupps.length})
                                            </span>
                                            <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${expandedClass === cls ? 'rotate-180' : ''}`}></i>
                                        </button>

                                        {expandedClass === cls && (
                                            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                                                {classSupps.map(su => {
                                                    const sub = subjects.find(s => s.id === su.subjectId);
                                                    const isImproved = su.marks && su.previousMarks && su.marks.total > su.previousMarks.total;
                                                    
                                                    return (
                                                        <div key={su.id} className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="text-[10px] font-bold text-slate-800 truncate block max-w-[120px]">{su.studentName}</span>
                                                                <span className={`text-[8px] font-black uppercase px-1 rounded ${su.marks?.status === 'Passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {su.marks?.status || 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="text-[9px] text-slate-500 font-medium mb-1 truncate">{sub?.name || su.subjectName}</div>
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                <span className="text-slate-400 line-through">{su.previousMarks?.total ?? '-'}</span>
                                                                <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
                                                                <span className={`font-black ${isImproved ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                                    {su.marks?.total ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default React.memo(ReleaseSettingsTab);
