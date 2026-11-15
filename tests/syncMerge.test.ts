import { describe, it, expect, beforeEach } from 'vitest'
import { mergeSyncData, saveLocalTombstones, getLocalTombstones } from '../src/lib/sync/syncMerge'
import type { SyncableData, Character } from '../src/lib/sync/syncTypes'

class MockStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

if (typeof (globalThis as any).window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
;(globalThis as any).window.localStorage = new MockStorage()

describe('Conflict Resolution & 3-Way Merge Engine (syncMerge)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('merges characters created on two devices without dropping either', () => {
    const localData: SyncableData = {
      characters: [
        {
          id: 'char_a',
          name: 'Character Alpha',
          theme: 'chatbot',
          avatar: '🤖',
          avatarColor: '#0a84ff',
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      worlds: [],
      conversations: [],
    }

    const remoteData: SyncableData = {
      characters: [
        {
          id: 'char_b',
          name: 'Character Beta',
          theme: 'anime',
          avatar: '🌸',
          avatarColor: '#ff6fae',
          createdAt: 1500,
          updatedAt: 2500,
        },
      ],
      worlds: [],
      conversations: [],
    }

    const { merged, stats } = mergeSyncData(localData, remoteData)
    expect(merged.characters.length).toBe(2)
    expect(merged.characters.some((c) => c.id === 'char_a')).toBe(true)
    expect(merged.characters.some((c) => c.id === 'char_b')).toBe(true)
    expect(stats.charactersAdded).toBe(1)
  })

  it('updates conflicting characters choosing the newer updatedAt timestamp', () => {
    const localData: SyncableData = {
      characters: [
        {
          id: 'char_common',
          name: 'Old Name',
          theme: 'chatbot',
          avatar: '🤖',
          avatarColor: '#0a84ff',
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      worlds: [],
      conversations: [],
    }

    const remoteData: SyncableData = {
      characters: [
        {
          id: 'char_common',
          name: 'Updated Name by Cloud Device',
          theme: 'chatbot',
          avatar: '🤖',
          avatarColor: '#0a84ff',
          createdAt: 1000,
          updatedAt: 5000, // Newer!
        },
      ],
      worlds: [],
      conversations: [],
    }

    const { merged, stats } = mergeSyncData(localData, remoteData)
    expect(merged.characters.length).toBe(1)
    expect(merged.characters[0].name).toBe('Updated Name by Cloud Device')
    expect(stats.charactersUpdated).toBe(1)
  })

  it('merges character tags into a unique set', () => {
    const localData: SyncableData = {
      characters: [
        {
          id: 'char_tags',
          name: 'Tagged Character',
          theme: 'chatbot',
          tags: ['cyberpunk', 'ai'],
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      worlds: [],
      conversations: [],
    }

    const remoteData: SyncableData = {
      characters: [
        {
          id: 'char_tags',
          name: 'Tagged Character',
          theme: 'chatbot',
          tags: ['ai', 'sci-fi', 'futuristic'],
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      worlds: [],
      conversations: [],
    }

    const { merged } = mergeSyncData(localData, remoteData)
    expect(merged.characters[0].tags).toEqual(['cyberpunk', 'ai', 'sci-fi', 'futuristic'])
  })

  it('detects concurrent conflicting field edits and preserves a branched conflict copy', () => {
    const localChar: Character = {
      id: 'char_conflict',
      name: 'Elena Vance',
      description: 'Elena is a scientist in sector 7.',
      greeting: 'Welcome back.',
      theme: 'chatbot',
      createdAt: 1000,
      updatedAt: 3000,
    }

    const remoteChar: Character = {
      id: 'char_conflict',
      name: 'Elena Vance',
      description: 'Elena is now a rebel commander.', // Conflicting edit!
      greeting: 'We need your help.', // Conflicting edit!
      theme: 'chatbot',
      createdAt: 1000,
      updatedAt: 3000, // Same timestamp -> concurrent conflict
    }

    const localData: SyncableData = {
      characters: [localChar],
      worlds: [],
      conversations: [],
    }

    const remoteData: SyncableData = {
      characters: [remoteChar],
      worlds: [],
      conversations: [],
    }

    const { merged, stats, conflicts } = mergeSyncData(localData, remoteData)

    expect(stats.conflictsDetected).toBe(1)
    expect(conflicts.length).toBeGreaterThanOrEqual(1)

    // Merged characters must contain BOTH the original and the preserved branched copy
    expect(merged.characters.length).toBe(2)
    const original = merged.characters.find((c) => c.id === 'char_conflict')
    const branched = merged.characters.find((c) => c.name.includes('(Remote Conflict)'))

    expect(original).toBeDefined()
    expect(branched).toBeDefined()
    expect(branched?.description).toBe('Elena is now a rebel commander.')
  })

  it('merges conversations and deduplicates messages by message ID', () => {
    const localData: SyncableData = {
      characters: [],
      worlds: [],
      conversations: [
        {
          id: 'conv_1',
          characterId: 'char_1',
          title: 'Chat 1',
          theme: 'chatbot',
          messages: [
            { id: 'm1', role: 'assistant', content: 'Message 1', timestamp: 100 },
            { id: 'm2', role: 'user', content: 'Local Reply', timestamp: 200 },
          ],
          createdAt: 100,
          updatedAt: 200,
        },
      ],
    }

    const remoteData: SyncableData = {
      characters: [],
      worlds: [],
      conversations: [
        {
          id: 'conv_1',
          characterId: 'char_1',
          title: 'Chat 1',
          theme: 'chatbot',
          messages: [
            { id: 'm1', role: 'assistant', content: 'Message 1', timestamp: 100 }, // Duplicate!
            { id: 'm3', role: 'user', content: 'Remote Reply from Phone', timestamp: 300 }, // New!
          ],
          createdAt: 100,
          updatedAt: 300,
        },
      ],
    }

    const { merged, stats } = mergeSyncData(localData, remoteData)
    expect(merged.conversations.length).toBe(1)
    const messages = merged.conversations[0].messages
    expect(messages.length).toBe(3) // m1, m2, m3
    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(stats.messagesMerged).toBe(1)
  })

  it('prevents deleted items from resurfacing using deletion tombstones', () => {
    const localData: SyncableData = {
      characters: [],
      worlds: [],
      conversations: [],
      tombstones: {
        characters: {
          char_deleted: 5000, // Deleted at t=5000
        },
        worlds: {},
        conversations: {},
        messages: {},
      },
    }

    const remoteData: SyncableData = {
      characters: [
        {
          id: 'char_deleted',
          name: 'Stale Character from old phone',
          theme: 'chatbot',
          avatar: '👻',
          avatarColor: '#0a84ff',
          createdAt: 1000,
          updatedAt: 4000, // Older than tombstone (4000 <= 5000)
        },
        {
          id: 'char_alive',
          name: 'Active Character',
          theme: 'chatbot',
          avatar: '🌟',
          avatarColor: '#0a84ff',
          createdAt: 1000,
          updatedAt: 6000,
        },
      ],
      worlds: [],
      conversations: [],
    }

    const { merged } = mergeSyncData(localData, remoteData)
    expect(merged.characters.length).toBe(1)
    expect(merged.characters[0].id).toBe('char_alive')
    expect(merged.characters.some((c) => c.id === 'char_deleted')).toBe(false)
  })

  it('prunes tombstones older than 90 days when saved to local storage', () => {
    const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000

    saveLocalTombstones({
      characters: {
        char_expired_tombstone: ninetyOneDaysAgo,
        char_active_tombstone: tenDaysAgo,
      },
      worlds: {},
      conversations: {},
      messages: {},
    })

    const retrieved = getLocalTombstones()
    expect(retrieved.characters['char_expired_tombstone']).toBeUndefined()
    expect(retrieved.characters['char_active_tombstone']).toBe(tenDaysAgo)
  })

  it('ensures API keys are never included in merged sync settings', () => {
    const localData: SyncableData = {
      characters: [],
      worlds: [],
      conversations: [],
      settings: {
        appearanceMode: 'dark',
        apiKey: 'local_secret_key_should_not_leak',
      },
    }

    const remoteData: SyncableData = {
      characters: [],
      worlds: [],
      conversations: [],
      settings: {
        appearanceMode: 'light',
        apiKey: 'remote_secret_key_should_not_leak',
      },
    }

    const { merged } = mergeSyncData(localData, remoteData)
    expect(merged.settings?.apiKey).toBe('')
  })
})
