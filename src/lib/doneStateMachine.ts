/**
 * Done Button State Machine for AI Provider Key Management
 *
 * States:
 * - IDLE_DISABLED: Input box matches saved value (or both are empty). Button is greyed out.
 * - IDLE_ENABLED: Input box differs from saved value (user is typing, pasting, editing, or clearing). Button is active.
 * - SUCCESS: Done was just clicked with a valid key. Shows "Inserted" (or "Removed") for ~2000ms.
 */

export type DoneState = 'IDLE_DISABLED' | 'IDLE_ENABLED' | 'SUCCESS'
export type DoneSuccessAction = 'inserted' | 'removed'

export interface DoneStateMachineConfig {
  currentKey: string
  savedKey: string
  currentExtra?: string
  savedExtra?: string
}

export function computeDoneState(
  config: DoneStateMachineConfig,
  currentStatus: DoneState,
): DoneState {
  const currentKey = config.currentKey ?? ''
  const savedKey = config.savedKey ?? ''
  const currentExtra = config.currentExtra ?? ''
  const savedExtra = config.savedExtra ?? ''

  const isDifferent = currentKey !== savedKey || currentExtra !== savedExtra

  if (currentStatus === 'SUCCESS') {
    // If the user modified the field while in SUCCESS state, leave SUCCESS immediately
    if (isDifferent) {
      return 'IDLE_ENABLED'
    }
    // If unmodified, stay in SUCCESS until timer ends
    return 'SUCCESS'
  }

  return isDifferent ? 'IDLE_ENABLED' : 'IDLE_DISABLED'
}

export function computeSuccessAction(
  currentKey: string,
  savedKey: string,
): DoneSuccessAction {
  const isClearing = !currentKey.trim() && !!savedKey.trim()
  return isClearing ? 'removed' : 'inserted'
}
