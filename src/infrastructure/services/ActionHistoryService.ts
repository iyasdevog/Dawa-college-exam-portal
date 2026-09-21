import { dataService } from './dataService';

export interface ActionHistoryItem {
    id: string;
    actionType: 'create' | 'update' | 'delete';
    entityType: 'student' | 'subject' | 'curriculum' | 'supp_exam' | 'marks' | 'settings';
    entityId: string;
    description: string;
    timestamp: number;
    previousState?: any;
    currentState?: any;
    undone?: boolean;
}

const LOCAL_STORAGE_KEY = 'dawa_action_history_v1';
const MAX_HISTORY_ITEMS = 50;

class ActionHistoryService {
    private getLocalHistory(): ActionHistoryItem[] {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!raw) return [];
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    private saveLocalHistory(items: ActionHistoryItem[]) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
        } catch (error) {
            console.error('Failed to save action history:', error);
        }
    }

    public async logAction(entry: {
        actionType: 'create' | 'update' | 'delete';
        entityType: 'student' | 'subject' | 'curriculum' | 'supp_exam' | 'marks' | 'settings';
        entityId: string;
        description: string;
        previousState?: any;
        currentState?: any;
    }): Promise<ActionHistoryItem> {
        const newItem: ActionHistoryItem = {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            undone: false,
            ...entry
        };

        const currentHistory = this.getLocalHistory();
        const updatedHistory = [newItem, ...currentHistory].slice(0, MAX_HISTORY_ITEMS);
        this.saveLocalHistory(updatedHistory);

        return newItem;
    }

    public async getRecentActions(limit: number = 20): Promise<ActionHistoryItem[]> {
        const history = this.getLocalHistory();
        return history.slice(0, limit);
    }

    public async undoAction(actionId: string): Promise<{ success: boolean; message: string }> {
        const history = this.getLocalHistory();
        const targetIndex = history.findIndex(a => a.id === actionId);

        if (targetIndex === -1) {
            return { success: false, message: 'Action not found in history.' };
        }

        const action = history[targetIndex];

        if (action.undone) {
            return { success: false, message: 'This action has already been undone.' };
        }

        try {
            const { actionType, entityType, entityId, previousState } = action;

            if (actionType === 'create') {
                // To undo a creation: delete/soft-delete the created entity
                switch (entityType) {
                    case 'student':
                        await dataService.studentService.deleteStudent(entityId);
                        break;
                    case 'subject':
                        await dataService.academicService.deleteSubject(entityId);
                        break;
                    case 'curriculum':
                        await dataService.curriculumService.deleteCurriculumEntry(entityId);
                        break;
                    case 'supp_exam':
                        await dataService.supplementaryService.deleteSupplementaryExam(entityId);
                        break;
                    default:
                        return { success: false, message: `Undo create not supported for ${entityType}` };
                }
            } else if (actionType === 'delete') {
                // To undo a deletion: restore the item using previousState or restore API
                switch (entityType) {
                    case 'student':
                        if (previousState) {
                            await dataService.studentService.saveStudent(previousState);
                        } else {
                            await dataService.studentService.restoreStudent(entityId);
                        }
                        break;
                    case 'subject':
                        if (previousState) {
                            await dataService.academicService.saveSubject(previousState);
                        } else {
                            await dataService.academicService.restoreSubject(entityId);
                        }
                        break;
                    case 'curriculum':
                        if (previousState) {
                            await dataService.curriculumService.saveCurriculumEntry(previousState);
                        } else {
                            await dataService.curriculumService.restoreCurriculumEntry(entityId);
                        }
                        break;
                    case 'supp_exam':
                        if (previousState) {
                            await dataService.supplementaryService.saveSupplementaryExam(previousState);
                        } else {
                            await dataService.supplementaryService.restoreSupplementaryExam(entityId);
                        }
                        break;
                    default:
                        return { success: false, message: `Undo delete not supported for ${entityType}` };
                }
            } else if (actionType === 'update') {
                // To undo an update: revert to previousState
                if (!previousState) {
                    return { success: false, message: 'Previous state unavailable to undo update.' };
                }

                switch (entityType) {
                    case 'student':
                        await dataService.studentService.saveStudent(previousState);
                        break;
                    case 'subject':
                        await dataService.academicService.saveSubject(previousState);
                        break;
                    case 'curriculum':
                        await dataService.curriculumService.saveCurriculumEntry(previousState);
                        break;
                    case 'supp_exam':
                        await dataService.supplementaryService.saveSupplementaryExam(previousState);
                        break;
                    case 'settings':
                        await dataService.saveGlobalSettings(previousState);
                        break;
                    default:
                        return { success: false, message: `Undo update not supported for ${entityType}` };
                }
            }

            // Mark action as undone
            history[targetIndex] = { ...action, undone: true };
            this.saveLocalHistory(history);

            return { success: true, message: `Successfully undone: ${action.description}` };
        } catch (error) {
            console.error('Error executing undo:', error);
            return {
                success: false,
                message: `Failed to undo action: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    public async clearHistory(): Promise<void> {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
}

export const actionHistoryService = new ActionHistoryService();
