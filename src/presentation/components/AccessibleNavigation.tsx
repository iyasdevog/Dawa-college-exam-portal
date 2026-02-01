import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ViewType } from '../../domain/entities/types';
import { useMobile } from '../hooks/useMobile';
import { keyboardNavigation, screenReaderAnnouncer, ariaHelpers } from '../utils/accessibility';
import MobileButton from './MobileButton';

interface NavigationItem {
    id: ViewType;
    label: string;
    icon: string;
    description?: string;
    badge?: string | number;
}

interface AccessibleNavigationProps {
    items: NavigationItem[];
    activeItem: ViewType;
    onItemSelect: (item: ViewType) => void;
    orientation?: 'horizontal' | 'vertical';
    variant?: 'tabs' | 'menu' | 'breadcrumb';
    showLabels?: boolean;
    className?: string;
}

/**
 * Accessible Navigation Component
 * Implements Requirements 8.5 - WCAG 2.1 AA compliant navigation with proper ARIA attributes,
 * keyboard navigation (arrow keys, home, end), and screen reader support
 */
export const AccessibleNavigation: React.FC<AccessibleNavigationProps> = ({
    items,
    activeItem,
    onItemSelect,
    orientation = 'horizontal',
    variant = 'tabs',
    showLabels = true,
    className = ''
}) => {
    const { isMobile } = useMobile();
    const [focusedIndex, setFocusedIndex] = useState<number>(() =>
        items.findIndex(item => item.id === activeItem)
    );
    const navigationRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Update focused index when active item changes
    useEffect(() => {
        const activeIndex = items.findIndex(item => item.id === activeItem);
        if (activeIndex !== -1) {
            setFocusedIndex(activeIndex);
        }
    }, [activeItem, items]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const { key } = e;
        let newIndex = focusedIndex;

        switch (key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                newIndex = orientation === 'horizontal' && key === 'ArrowDown' ? focusedIndex :
                    (focusedIndex + 1) % items.length;
                break;

            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                newIndex = orientation === 'horizontal' && key === 'ArrowUp' ? focusedIndex :
                    (focusedIndex - 1 + items.length) % items.length;
                break;

            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;

            case 'End':
                e.preventDefault();
                newIndex = items.length - 1;
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                handleItemSelect(items[focusedIndex]);
                return;

            default:
                return;
        }

        setFocusedIndex(newIndex);
        itemRefs.current[newIndex]?.focus();
    }, [focusedIndex, items, orientation]);

    // Handle item selection
    const handleItemSelect = useCallback((item: NavigationItem) => {
        onItemSelect(item.id);
        screenReaderAnnouncer.announceNavigation(item.label, item.description);
    }, [onItemSelect]);

    // Handle item focus
    const handleItemFocus = useCallback((index: number) => {
        setFocusedIndex(index);
    }, []);

    // Get ARIA attributes based on variant
    const getAriaAttributes = () => {
        switch (variant) {
            case 'tabs':
                return {
                    role: 'tablist',
                    'aria-orientation': orientation
                };
            case 'menu':
                return {
                    role: 'menubar',
                    'aria-orientation': orientation
                };
            case 'breadcrumb':
                return {
                    role: 'navigation',
                    'aria-label': 'Breadcrumb'
                };
            default:
                return {
                    role: 'navigation'
                };
        }
    };

    // Get item ARIA attributes
    const getItemAriaAttributes = (item: NavigationItem, index: number) => {
        const isActive = item.id === activeItem;
        const isFocused = index === focusedIndex;

        switch (variant) {
            case 'tabs':
                return {
                    role: 'tab',
                    'aria-selected': isActive,
                    'aria-controls': `${item.id}-panel`,
                    tabIndex: isFocused ? 0 : -1
                };
            case 'menu':
                return {
                    role: 'menuitem',
                    'aria-current': isActive ? 'page' : undefined,
                    tabIndex: isFocused ? 0 : -1
                };
            case 'breadcrumb':
                return {
                    'aria-current': isActive ? 'page' : undefined,
                    tabIndex: 0
                };
            default:
                return {
                    'aria-current': isActive ? 'page' : undefined,
                    tabIndex: isFocused ? 0 : -1
                };
        }
    };

    // Get container classes
    const getContainerClasses = () => {
        const baseClasses = [
            'flex',
            orientation === 'horizontal' ? 'flex-row' : 'flex-col',
            variant === 'breadcrumb' ? 'items-center space-x-2' : '',
            isMobile ? 'touch-manipulation' : ''
        ];

        return baseClasses.filter(Boolean).join(' ');
    };

    // Get item classes
    const getItemClasses = (item: NavigationItem, index: number) => {
        const isActive = item.id === activeItem;
        const isFocused = index === focusedIndex;

        const baseClasses = [
            'relative flex items-center justify-center transition-all duration-200',
            'focus:outline-none focus:ring-4 focus:ring-opacity-50',
            isMobile ? 'touch-target-comfortable' : 'touch-target-min'
        ];

        switch (variant) {
            case 'tabs':
                baseClasses.push(
                    'px-4 py-3 font-semibold text-sm rounded-lg',
                    isActive
                        ? 'bg-emerald-600 text-white shadow-lg focus:ring-emerald-500'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500'
                );
                break;

            case 'menu':
                baseClasses.push(
                    'px-4 py-3 font-medium text-sm rounded-lg w-full text-left',
                    isActive
                        ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 focus:ring-emerald-500'
                        : 'text-slate-700 hover:bg-slate-50 focus:ring-slate-500'
                );
                break;

            case 'breadcrumb':
                baseClasses.push(
                    'px-2 py-1 text-sm font-medium rounded',
                    isActive
                        ? 'text-emerald-600 focus:ring-emerald-500'
                        : 'text-slate-500 hover:text-slate-700 focus:ring-slate-500'
                );
                break;

            default:
                baseClasses.push(
                    'px-4 py-2 font-medium text-sm rounded-lg',
                    isActive
                        ? 'bg-emerald-600 text-white focus:ring-emerald-500'
                        : 'text-slate-600 hover:bg-slate-100 focus:ring-slate-500'
                );
        }

        return baseClasses.join(' ');
    };

    return (
        <nav
            ref={navigationRef}
            className={`${getContainerClasses()} ${className}`}
            onKeyDown={handleKeyDown}
            {...getAriaAttributes()}
            aria-label={`${variant} navigation`}
        >
            {items.map((item, index) => (
                <React.Fragment key={item.id}>
                    <button
                        ref={el => itemRefs.current[index] = el}
                        className={getItemClasses(item, index)}
                        onClick={() => handleItemSelect(item)}
                        onFocus={() => handleItemFocus(index)}
                        {...getItemAriaAttributes(item, index)}
                        aria-label={`${item.label}${item.description ? `. ${item.description}` : ''}`}
                    >
                        {/* Icon */}
                        <i
                            className={`${item.icon} ${showLabels ? 'mr-2' : ''}`}
                            aria-hidden="true"
                        />

                        {/* Label */}
                        {showLabels && (
                            <span className="truncate">
                                {item.label}
                            </span>
                        )}

                        {/* Badge */}
                        {item.badge && (
                            <span
                                className="ml-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full"
                                aria-label={`${item.badge} notifications`}
                            >
                                {item.badge}
                            </span>
                        )}

                        {/* Active indicator for tabs */}
                        {variant === 'tabs' && item.id === activeItem && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full"
                                aria-hidden="true"
                            />
                        )}
                    </button>

                    {/* Breadcrumb separator */}
                    {variant === 'breadcrumb' && index < items.length - 1 && (
                        <i
                            className="fa-solid fa-chevron-right text-slate-400 text-xs"
                            aria-hidden="true"
                        />
                    )}
                </React.Fragment>
            ))}

            {/* Screen reader instructions */}
            <div className="sr-only" aria-live="polite">
                Use arrow keys to navigate between {variant} items. Press Enter or Space to select.
                {variant === 'tabs' && ' Use Home and End keys to jump to first or last tab.'}
            </div>
        </nav>
    );
};

export default AccessibleNavigation;