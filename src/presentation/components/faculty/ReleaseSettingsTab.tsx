import React from 'react';
import { ClassReleaseSettings } from '../../../domain/entities/types';

interface ReleaseSettingsTabProps {
    allowedClasses: string[];
    releaseSettings: ClassReleaseSettings;
    onUpdateSetting: (className: string, key: keyof any, value: any) => void;
}

const ReleaseSettingsTab: React.FC<ReleaseSettingsTabProps> = ({
    allowedClasses,
    releaseSettings,
    onUpdateSetting
}) => {
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
                        return (
                            <div key={cls} className="bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-emerald-300 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-bold text-slate-900">{cls} Class</h4>
                                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${settings.isReleased ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {settings.isReleased ? 'Released' : 'Hidden'}
                                    </div>
                                </div>

                                <div className="space-y-4">
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
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default React.memo(ReleaseSettingsTab);
