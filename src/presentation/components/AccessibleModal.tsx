import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { keyboardNavigation, screenReaderAnnouncer, focusManagement, ariaHelpers } from '../utils/accessibility';
import { useMobile } from '../hooks/useMobile';
import MobileButton from './MobileButton';

interface AccessibleModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    initialFocus?: 'first' | 'close' | 'none';
    returnFocus?: boolean;
    className?: string;
}

/**
 * Accessible Modal Component
 * Implements Requirements 8.5 - WCAG 2.1 AA compliant modal with proper ARIA attributes,
 * keyboard navigation, focus management, and screen reader support
 */
export const AccessibleModal: React.FC<AccessibleModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    initialFocus = 'first',
    returnFocus = true,
    className = ''
}) => {
    const { isMobile, screenWidth } = useMobile();
    const modalRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const disableFocusTrapRef = useRef<(() => void) | null>(null);

    // Generate unique IDs for ARIA relationships
    const modalId = `modal-${Math.random().toString(36).substr(2, 9)}`;
    const titleId = `${modalId}-title`;
    const descriptionId = `${modalId}-description`;

    // Handle escape key
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape && isOpen) {
            e.preventDefault();
            onClose();
        }
    }, [closeOnEscape, isOpen, onClose]);

    // Handle overlay click
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (closeOnOverlayClick && e.target === overlayRef.current) {
            onClose();
        }
    }, [closeOnOverlayClick, onClose]);

    // Track if modal was already open to prevent focus hijacking on re-renders
    const wasOpenRef = useRef(false);

    // Set up modal when opened
    useEffect(() => {
        if (isOpen) {
            // Save current focus only on initial open
            if (!wasOpenRef.current && returnFocus) {
                previousFocusRef.current = focusManagement.saveFocus();
            }

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            document.body.classList.add('modal-open');

            // Set up keyboard event listeners
            document.addEventListener('keydown', handleEscape);

            if (!wasOpenRef.current) {
                // Announce modal opening to screen readers
                screenReaderAnnouncer.announce(`Dialog opened: ${title}`, 'polite');

                // Set up focus trap and initial focus after modal is rendered
                setTimeout(() => {
                    if (modalRef.current) {
                        disableFocusTrapRef.current = keyboardNavigation.enableFocusTrap(modalRef.current);

                        // Set initial focus
                        if (initialFocus === 'first') {
                            keyboardNavigation.focusFirst(modalRef.current);
                        } else if (initialFocus === 'close' && closeButtonRef.current) {
                            closeButtonRef.current.focus();
                        }
                    }
                }, 100);
            }

            wasOpenRef.current = true;
        } else {
            // Clean up when modal closes
            if (wasOpenRef.current) {
                document.body.style.overflow = '';
                document.body.classList.remove('modal-open');
                document.removeEventListener('keydown', handleEscape);

                // Disable focus trap
                if (disableFocusTrapRef.current) {
                    disableFocusTrapRef.current();
                    disableFocusTrapRef.current = null;
                }

                // Restore focus
                if (returnFocus && previousFocusRef.current) {
                    focusManagement.restoreFocus(previousFocusRef.current);
                    previousFocusRef.current = null;
                }

                // Announce modal closing
                screenReaderAnnouncer.announce('Dialog closed', 'polite');
            }
            wasOpenRef.current = false;
        }

        // Cleanup function for intermediate changes
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, handleEscape, title, initialFocus, returnFocus]);

    // Get modal size classes
    const getSizeClasses = () => {
        if (isMobile) {
            return 'w-full h-full max-w-none max-h-none rounded-none';
        }

        const sizeMap = {
            sm: 'max-w-md',
            md: 'max-w-lg',
            lg: 'max-w-2xl',
            xl: 'max-w-4xl',
            full: 'max-w-full max-h-full'
        };

        return `${sizeMap[size]} max-h-[90vh] rounded-2xl`;
    };

    // Don't render if not open
    if (!isOpen) {
        return null;
    }

    const modalContent = (
        <div
            ref={overlayRef}
            className={`
        fixed inset-0 z-50 flex items-center justify-center
        bg-black bg-opacity-50 backdrop-blur-sm
        transition-opacity duration-300
        ${isMobile ? 'p-0' : 'p-4'}
      `}
            onClick={handleOverlayClick}
            aria-hidden="true"
        >
            <div
                ref={modalRef}
                className={`
          bg-white shadow-2xl relative flex flex-col
          ${getSizeClasses()}
          ${isMobile ? '' : 'animate-modal-slide-in'}
          ${className}
        `}
                {...ariaHelpers.dialog(title, description ? descriptionId : undefined)}
                aria-labelledby={titleId}
                aria-modal="true"
                role="dialog"
                tabIndex={-1}
            >
                {/* Header */}
                <div className={`
          flex items-center justify-between p-6 border-b border-slate-200
          ${isMobile ? 'mobile-safe-area-top' : ''}
        `}>
                    <div className="flex-1 min-w-0">
                        <h2
                            id={titleId}
                            className={`
                font-bold text-slate-900 truncate
                ${isMobile ? 'text-lg' : 'text-xl'}
              `}
                        >
                            {title}
                        </h2>
                        {description && (
                            <p
                                id={descriptionId}
                                className="mt-1 text-sm text-slate-600"
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {showCloseButton && (
                        <MobileButton
                            ref={closeButtonRef}
                            variant="ghost"
                            size="sm"
                            touchSize="comfortable"
                            onClick={onClose}
                            className="ml-4 flex-shrink-0"
                            aria-label={`Close ${title} dialog`}
                            icon="fa-solid fa-times"
                        >
                            {null}
                        </MobileButton>
                    )}
                </div>

                {/* Content */}
                <div className={`
          flex-1 overflow-y-auto p-6
          ${isMobile ? 'mobile-safe-area-bottom' : ''}
        `}>
                    {children}
                </div>
            </div>
        </div>
    );

    // Render modal in portal
    return createPortal(modalContent, document.body);
};

export default AccessibleModal;