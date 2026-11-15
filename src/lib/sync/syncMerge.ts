/**
 * Conflict Resolution and 3-Way Merge Engine for Eva Cloud Sync
 *
 * Rules:
 * - Characters: Deduplicated by ID. Newer updatedAt wins field conflicts. Tombstoned items are excluded.
 * - Worlds: Deduplicated by ID. Newer updatedAt wins. Tombstoned items are excluded.
 * - Conversations: Deduplicated by ID. Messages merged by message ID without dropping either side.
 * - Tombstones: Deletions record a deletion timestamp so deleted items do not resurface on sync.
 * - Settings: Non-destructive merge preserving local UI and theme preferences. API keys never synced.
 */

import type { Character, Conversation, Message, World } from '@/types'
import type { SyncableData, SyncTombstones } from './syncTypes'

const TOMBSTONE_STORAGE_KEY = 'eva_sync_tombstones'
const TOMBSTONE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000 // 60 days

export function getLocalTombstones(): SyncTombstones {
  if (typeof window === 'undefined') {
    return { characters: {}, worlds: {}, conversations: {}, messages: {} }
  }
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_STORAGE_KEY)
    if (!raw) return { characters: {}, worlds: {}, conversations: {}, messages: {} }
    const parsed = JSON.parse(raw)
    return {
      characters: parsed.characters || {},
      worlds: parsed.worlds || {},
      conversations: parsed.conversations || {},
      messages: parsed.messages || {},
    }
  } catch {
    return { characters: {}, worlds: {}, conversations: {}, messages: {} }
  }
}

export function saveLocalTombstones(tombstones: SyncTombstones): void {
  if (typeof window === 'undefined') return
  try {
    const now = Date.now()
    // Prune entries older than 60 days
    const pruned: SyncTombstones = {
      characters: {},
      worlds: {},
      conversations: {},
      messages: {},
    }
    for (const [k, v] of Object.entries(tombstones.characters)) {
      if (now - v < TOMBSTONE_MAX_AGE_MS) pruned.characters[k] = v
    }
    for (const [k, v] of Object.entries(tombstones.worlds)) {
      if (now - v < TOMBSTONE_MAX_AGE_MS) pruned.worlds[k] = v
    }
    for (const [k, v] of Object.entries(tombstones.conversations)) {
      if (now - v < TOMBSTONE_MAX_AGE_MS) pruned.conversations[k] = v
    }
    for (const [k, v] of Object.entries(tombstones.messages)) {
      if (now - v < TOMBSTONE_MAX_AGE_MS) pruned.messages[k] = v
    }
    window.localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(pruned))
  } catch {
    // Ignore localStorage write failures
  }
}

export function recordTombstone(
  type: keyof SyncTombstones,
  id: string,
  timestamp: number = Date.now(),
): void {
  const current = getLocalTombstones()
  current[type][id] = timestamp
  saveLocalTombstones(current)
}

export interface MergeStats {
  charactersAdded: number
  charactersUpdated: number
  worldsAdded: number
  worldsUpdated: number
  conversationsAdded: number
  conversationsUpdated: number
  messagesMerged: number
}

/**
 * Merges local and remote SyncableData deterministically.
 */
export function mergeSyncData(
  local: SyncableData,
  remote: SyncableData,
): { merged: SyncableData; stats: MergeStats } {
  const stats: MergeStats = {
    charactersAdded: 0,
    charactersUpdated: 0,
    worldsAdded: 0,
    worldsUpdated: 0,
    conversationsAdded: 0,
    conversationsUpdated: 0,
    messagesMerged: 0,
  }

  // Combine tombstones from local and remote
  const localTombstones = local.tombstones || getLocalTombstones()
  const remoteTombstones = remote.tombstones || { characters: {}, worlds: {}, conversations: {}, messages: {} }
  const combinedTombstones: SyncTombstones = {
    characters: { ...localTombstones.characters, ...remoteTombstones.characters },
    worlds: { ...localTombstones.worlds, ...remoteTombstones.worlds },
    conversations: { ...localTombstones.conversations, ...remoteTombstones.conversations },
    messages: { ...localTombstones.messages, ...remoteTombstones.messages },
  }

  // 1. Merge Characters
  const characterMap = new Map<string, Character>()
  const localChars = local.characters || []
  const remoteChars = remote.characters || []

  for (const c of localChars) {
    const deletedAt = combinedTombstones.characters[c.id]
    const itemTimestamp = c.updatedAt || c.createdAt || 0
    if (!deletedAt || itemTimestamp > deletedAt) {
      characterMap.set(c.id, { ...c })
    }
  }

  for (const c of remoteChars) {
    const deletedAt = combinedTombstones.characters[c.id]
    const itemTimestamp = c.updatedAt || c.createdAt || 0
    if (deletedAt && itemTimestamp <= deletedAt) {
      continue
    }

    if (!characterMap.has(c.id)) {
      characterMap.set(c.id, { ...c })
      stats.charactersAdded++
    } else {
      const existing = characterMap.get(c.id)!
      const existingTime = existing.updatedAt || existing.createdAt || 0
      if (itemTimestamp > existingTime) {
        characterMap.set(c.id, { ...c })
        stats.charactersUpdated++
      }
    }
  }

  // 2. Merge Worlds
  const worldMap = new Map<string, World>()
  const localWorlds = local.worlds || []
  const remoteWorlds = remote.worlds || []

  for (const w of localWorlds) {
    const deletedAt = combinedTombstones.worlds[w.id]
    const itemTimestamp = w.updatedAt || w.createdAt || 0
    if (!deletedAt || itemTimestamp > deletedAt) {
      worldMap.set(w.id, { ...w })
    }
  }

  for (const w of remoteWorlds) {
    const deletedAt = combinedTombstones.worlds[w.id]
    const itemTimestamp = w.updatedAt || w.createdAt || 0
    if (deletedAt && itemTimestamp <= deletedAt) {
      continue
    }

    if (!worldMap.has(w.id)) {
      worldMap.set(w.id, { ...w })
      stats.worldsAdded++
    } else {
      const existing = worldMap.get(w.id)!
      const existingTime = existing.updatedAt || existing.createdAt || 0
      if (itemTimestamp > existingTime) {
        worldMap.set(w.id, { ...w })
        stats.worldsUpdated++
      }
    }
  }

  // 3. Merge Conversations & Messages
  const conversationMap = new Map<string, Conversation>()
  const localConvs = local.conversations || []
  const remoteConvs = remote.conversations || []

  for (const conv of localConvs) {
    const deletedAt = combinedTombstones.conversations[conv.id]
    const itemTimestamp = conv.updatedAt || conv.createdAt || 0
    if (!deletedAt || itemTimestamp > deletedAt) {
      conversationMap.set(conv.id, { ...conv, messages: [...(conv.messages || [])] })
    }
  }

  for (const rConv of remoteConvs) {
    const deletedAt = combinedTombstones.conversations[rConv.id]
    const itemTimestamp = rConv.updatedAt || rConv.createdAt || 0
    if (deletedAt && itemTimestamp <= deletedAt) {
      continue
    }

    if (!conversationMap.has(rConv.id)) {
      // Filter out tombstoned messages
      const filteredMessages = (rConv.messages || []).filter((m) => {
        const msgDeleted = combinedTombstones.messages[m.id]
        return !msgDeleted || m.timestamp > msgDeleted
      })
      conversationMap.set(rConv.id, { ...rConv, messages: filteredMessages })
      stats.conversationsAdded++
    } else {
      const lConv = conversationMap.get(rConv.id)!
      const isRemoteNewer = itemTimestamp > (lConv.updatedAt || lConv.createdAt || 0)

      // Merge messages deduplicated by ID
      const messageMap = new Map<string, Message>()
      for (const m of lConv.messages || []) {
        const msgDeleted = combinedTombstones.messages[m.id]
        if (!msgDeleted || m.timestamp > msgDeleted) {
          messageMap.set(m.id, m)
        }
      }

      for (const m of rConv.messages || []) {
        const msgDeleted = combinedTombstones.messages[m.id]
        if (msgDeleted && m.timestamp <= msgDeleted) {
          continue
        }
        if (!messageMap.has(m.id)) {
          messageMap.set(m.id, m)
          stats.messagesMerged++
        } else {
          // If message exists on both, keep the one with longer content or updated fields
          const existing = messageMap.get(m.id)!
          if (m.content.length > existing.content.length || m.raw) {
            messageMap.set(m.id, { ...existing, ...m })
          }
        }
      }

      // Sort merged messages chronologically
      const mergedMessages = Array.from(messageMap.values()).sort(
        (a, b) => a.timestamp - b.timestamp,
      )

      const mergedWorldState =
        lConv.worldState || rConv.worldState
          ? {
              reputation: {
                ...(lConv.worldState?.reputation || {}),
                ...(rConv.worldState?.reputation || {}),
              },
              events: Array.from(
                new Set([
                  ...(lConv.worldState?.events || []),
                  ...(rConv.worldState?.events || []),
                ]),
              ),
              notes: isRemoteNewer
                ? rConv.worldState?.notes ?? lConv.worldState?.notes ?? ''
                : lConv.worldState?.notes ?? rConv.worldState?.notes ?? '',
            }
          : undefined

      const mergedConv: Conversation = {
        ...lConv,
        ...(isRemoteNewer ? rConv : {}),
        messages: mergedMessages,
        memory: isRemoteNewer ? (rConv.memory || lConv.memory) : (lConv.memory || rConv.memory),
        worldState: mergedWorldState,
        updatedAt: Math.max(lConv.updatedAt || 0, rConv.updatedAt || 0),
      }

      conversationMap.set(rConv.id, mergedConv)
      stats.conversationsUpdated++
    }
  }

  // Save merged tombstones
  saveLocalTombstones(combinedTombstones)

  // 4. Settings non-destructive merge (preserve local preferences, never merge API keys)
  const mergedSettings = {
    ...(remote.settings || {}),
    ...(local.settings || {}),
    apiKey: '', // Always empty in sync payload
  }

  const mergedData: SyncableData = {
    characters: Array.from(characterMap.values()),
    worlds: Array.from(worldMap.values()),
    conversations: Array.from(conversationMap.values()),
    settings: mergedSettings,
    tombstones: combinedTombstones,
  }

  return { merged: mergedData, stats }
}
