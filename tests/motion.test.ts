import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  EASE_DRAWER,
  EASE_IN_OUT,
  EASE_OUT,
  backdropVariants,
  dropdownVariants,
  modalVariants,
  reducedMotionVariants,
  sheetVariants,
  springDrawer,
  springModal,
  springSnappy,
  transitionFade,
  transitionFast,
} from '../src/lib/motion'

describe('Eva Motion System Tokens & Variants', () => {
  it('defines valid cubic-bezier easing tokens within standard coordinate bounds', () => {
    expect(EASE_OUT).toHaveLength(4)
    expect(EASE_OUT[0]).toBeGreaterThanOrEqual(0)
    expect(EASE_OUT[2]).toBeLessThanOrEqual(1)

    expect(EASE_DRAWER).toHaveLength(4)
    // iOS / Android drawer sheet physics: [0.32, 0.72, 0, 1]
    expect(EASE_DRAWER[0]).toBe(0.32)
    expect(EASE_DRAWER[1]).toBe(0.72)
    expect(EASE_DRAWER[2]).toBe(0)
    expect(EASE_DRAWER[3]).toBe(1)

    expect(EASE_IN_OUT).toHaveLength(4)
  })

  it('provides well-damped spring presets that prevent floaty overshoot', () => {
    expect(springSnappy.type).toBe('spring')
    expect(springSnappy.damping).toBeGreaterThanOrEqual(30)
    expect(springSnappy.stiffness).toBeGreaterThanOrEqual(400)

    expect(springModal.type).toBe('spring')
    expect(springModal.damping).toBeGreaterThanOrEqual(30)
    expect(springModal.stiffness).toBeLessThanOrEqual(450)

    expect(springDrawer.type).toBe('spring')
    expect(springDrawer.damping).toBeGreaterThanOrEqual(30)
  })

  it('defines fast transition presets for responsive feedback', () => {
    expect(transitionFast.duration).toBeLessThanOrEqual(0.16)
    expect(transitionFade.duration).toBeLessThanOrEqual(0.2)
  })

  it('configures proper enter/exit transform and opacity targets for dialogs and sheets', () => {
    // Modal variants
    expect(modalVariants.initial).toEqual({ opacity: 0, scale: 0.96 })
    expect(modalVariants.animate).toEqual({ opacity: 1, scale: 1 })
    expect(modalVariants.exit).toEqual({ opacity: 0, scale: 0.96 })

    // Sheet variants (mobile bottom drawer)
    expect(sheetVariants.initial).toEqual({ y: '100%' })
    expect(sheetVariants.animate).toEqual({ y: 0 })
    expect(sheetVariants.exit).toEqual({ y: '100%' })

    // Dropdown / Popover variants
    expect(dropdownVariants.initial).toMatchObject({ opacity: 0, scale: 0.95 })
    expect(dropdownVariants.animate).toMatchObject({ opacity: 1, scale: 1 })
    expect(dropdownVariants.exit).toMatchObject({ opacity: 0, scale: 0.95 })

    // Backdrop
    expect(backdropVariants.initial).toEqual({ opacity: 0 })
    expect(backdropVariants.animate).toEqual({ opacity: 1 })
    expect(backdropVariants.exit).toEqual({ opacity: 0 })
  })

  it('safely eliminates transforms in reduced motion variants', () => {
    expect(reducedMotionVariants.initial).toEqual({ opacity: 0 })
    expect(reducedMotionVariants.animate).toEqual({ opacity: 1 })
    expect(reducedMotionVariants.exit).toEqual({ opacity: 0 })
    expect(reducedMotionVariants.initial).not.toHaveProperty('scale')
    expect(reducedMotionVariants.initial).not.toHaveProperty('y')
    expect(reducedMotionVariants.initial).not.toHaveProperty('x')
  })
})

describe('Chat Scroll Anchoring Physics', () => {
  function computeAtBottom(scrollHeight: number, scrollTop: number, clientHeight: number, threshold = 80) {
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    return {
      distanceFromBottom,
      atBottom: distanceFromBottom <= threshold,
    }
  }

  it('detects when user is pinned at or near the bottom', () => {
    // Exactly at bottom
    expect(computeAtBottom(1000, 600, 400).atBottom).toBe(true)

    // 40px above bottom (within 80px threshold)
    expect(computeAtBottom(1000, 560, 400).atBottom).toBe(true)

    // Exactly at 80px threshold
    expect(computeAtBottom(1000, 520, 400).atBottom).toBe(true)
  })

  it('detects when user is scrolled up reading previous history', () => {
    // 81px above bottom
    expect(computeAtBottom(1000, 519, 400).atBottom).toBe(false)

    // Scrolled far up into older dialogue
    expect(computeAtBottom(3000, 500, 400).atBottom).toBe(false)
    expect(computeAtBottom(3000, 500, 400).distanceFromBottom).toBe(2100)
  })
})

describe('CSS Design System Motion Declarations', () => {
  const cssPath = path.resolve(__dirname, '../src/index.css')
  const cssContent = fs.readFileSync(cssPath, 'utf8')

  it('contains tokens for --ease-out, --ease-drawer, and keyframes in index.css', () => {
    expect(cssContent).toContain('--ease-out:')
    expect(cssContent).toContain('--ease-drawer:')
    expect(cssContent).toContain('@keyframes rise')
    expect(cssContent).toContain('@keyframes pop')
    expect(cssContent).toContain('@keyframes fade')
  })

  it('contains prefers-reduced-motion media query handling', () => {
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('guards hover pseudo-classes with pointer media queries to prevent stuck mobile taps', () => {
    expect(cssContent).toContain('@media (hover: hover) and (pointer: fine)')
  })
})
