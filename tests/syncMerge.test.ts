import { describe, it, expect } from 'vitest'
import { mergeSyncData } from '../src/lib/sync/syncMerge'
import type { SyncableData } from '../src/lib/sync/syncTypes'

describe('Conflict Resolution & 3-Way Merge Engine (syncMerge)', () => {
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
