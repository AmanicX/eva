import { describe, expect, it } from 'vitest'
import {
  computeDoneState,
  computeSuccessAction,
} from '../src/lib/doneStateMachine'

describe('doneStateMachine', () => {
  it('starts in IDLE_DISABLED when current matches saved value', () => {
    expect(computeDoneState({ currentKey: '', savedKey: '' }, 'IDLE_DISABLED')).toBe('IDLE_DISABLED')
    expect(computeDoneState({ currentKey: 'abc', savedKey: 'abc' }, 'IDLE_DISABLED')).toBe('IDLE_DISABLED')
  })

  it('transitions to IDLE_ENABLED when current differs from saved value', () => {
    expect(computeDoneState({ currentKey: 'a', savedKey: '' }, 'IDLE_DISABLED')).toBe('IDLE_ENABLED')
    expect(computeDoneState({ currentKey: '', savedKey: 'abc' }, 'IDLE_DISABLED')).toBe('IDLE_ENABLED')
    expect(computeDoneState({ currentKey: 'abcd', savedKey: 'abc' }, 'IDLE_DISABLED')).toBe('IDLE_ENABLED')
  })

  it('handles extra fields for Cloudflare (Account ID + Token)', () => {
    expect(
      computeDoneState(
        { currentKey: 'token1', savedKey: 'token1', currentExtra: 'id1', savedExtra: 'id1' },
        'IDLE_DISABLED',
      ),
    ).toBe('IDLE_DISABLED')

    expect(
      computeDoneState(
        { currentKey: 'token1', savedKey: 'token1', currentExtra: 'id2', savedExtra: 'id1' },
        'IDLE_DISABLED',
      ),
    ).toBe('IDLE_ENABLED')
  })

  it('leaves SUCCESS immediately if user edits the value during success timer', () => {
    // Value modified while in SUCCESS
    expect(
      computeDoneState({ currentKey: 'new_val', savedKey: 'saved_val' }, 'SUCCESS'),
    ).toBe('IDLE_ENABLED')

    // Value matches newly saved value -> stays in SUCCESS until timer ends
    expect(
      computeDoneState({ currentKey: 'saved_val', savedKey: 'saved_val' }, 'SUCCESS'),
    ).toBe('SUCCESS')
  })

  it('computes correct success action (inserted vs removed)', () => {
    expect(computeSuccessAction('new_key', '')).toBe('inserted')
    expect(computeSuccessAction('updated_key', 'old_key')).toBe('inserted')
    expect(computeSuccessAction('', 'old_key')).toBe('removed')
  })
})
