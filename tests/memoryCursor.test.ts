import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateMemory } from '@/lib/memory'
import { DEFAULT_SETTINGS } from '@/store/useStore'
import type { Conversation, Message, Settings } from '@/types'

describe('Memory Summarization & Turn Cursor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function createMessages(userTurns: number): Message[] {
    const list: Message[] = [
      { id: 'm_greet', role: 'assistant', content: 'Greetings traveller.', timestamp: Date.now() },
    ]
    for (let i = 1; i <= userTurns; i++) {
      list.push({ id: `u_${i}`, role: 'user', content: `Player turn ${i}`, timestamp: Date.now() })
      list.push({ id: `a_${i}`, role: 'assistant', content: `Assistant turn ${i}`, timestamp: Date.now() })
    }
    return list
  }

  it('triggers memory summarization reliably when 4 dialogue turns are completed, even though message count is odd', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '- Player explored the cave\n- Discovered a glowing crystal' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const oddLengthMessages = createMessages(4)
    // 1 greeting + 4 pairs = 9 messages total (odd number!)
    expect(oddLengthMessages.length).toBe(9)
    expect(oddLengthMessages.length % 8).not.toBe(0) // Old buggy check failed here!

    const conversation: Conversation = {
      id: 'conv_mem_1',
      theme: 'chatbot',
      characterId: 'char_1',
      title: 'Adventure',
      messages: oddLengthMessages,
      memory: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      memoryEnabled: true,
      chatDefault: { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      apiKey: 'gsk_fake_key',
    }

    const memoryUpdate = await updateMemory({ settings, conversation })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(memoryUpdate).toContain('crystal')
  })

  it('does not trigger memory summarization before reaching 4 dialogue turns', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const shortMessages = createMessages(3) // 3 turns
    const conversation: Conversation = {
      id: 'conv_mem_2',
      theme: 'chatbot',
      characterId: 'char_1',
      title: 'Short Chat',
      messages: shortMessages,
      memory: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      memoryEnabled: true,
    }

    const result = await updateMemory({ settings, conversation })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does not trigger memory summarization on an incomplete turn (assistant has not responded)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const messages = createMessages(4)
    // Add user message without assistant reply
    messages.push({ id: 'u_incomplete', role: 'user', content: 'What next?', timestamp: Date.now() })

    const conversation: Conversation = {
      id: 'conv_mem_3',
      theme: 'chatbot',
      characterId: 'char_1',
      title: 'Incomplete turn',
      messages,
      memory: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      memoryEnabled: true,
    }

    const result = await updateMemory({ settings, conversation })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})
