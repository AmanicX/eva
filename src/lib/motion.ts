import type { Transition, Variants } from 'motion/react'

/**
 * Eva Motion System
 * Refined, responsive, purposeful animations tuned for 60Hz/90Hz displays
 * and mobile WebView performance on Android.
 */

// Centralized easing curves
export const EASE_OUT = [0.16, 1, 0.3, 1] as const
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

// Centralized spring transitions
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 36,
  mass: 0.8,
}

export const springModal: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.9,
}

export const springDrawer: Transition = {
  type: 'spring',
  damping: 32,
  stiffness: 320,
  mass: 1,
}

// Fade & quick transitions
export const transitionFade: Transition = {
  duration: 0.18,
  ease: EASE_OUT,
}

export const transitionFast: Transition = {
  duration: 0.14,
  ease: EASE_OUT,
}

// Standard modal card animation
export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
}

// Mobile bottom sheet animation
export const sheetVariants: Variants = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
}

// Backdrop overlay animation
export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

// Popover / dropdown animation with origin-aware scale
export const dropdownVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4 },
}

// Reduced motion fallbacks (replaces transforms with subtle opacity)
export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}
