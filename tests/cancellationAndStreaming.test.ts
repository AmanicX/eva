import { describe, it, expect, vi } from 'vitest'
import { executeChatWithFallback, judgeReplyRefusal } from '@/lib/fallbackEngine'
import { chatGroq } from '@/lib/groq'
import { DEFAULT_SETTINGS } from '@/store/useStore'
import type { Settings } from '@/types'

describe('Cancellation, Timeouts, Streaming & Top P', () => {
  it('sends top_p in chatGroq request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'test reply' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await chatGroq({
      apiKey: 'test-key',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'test' }],
      topP: 0.95,
    })

    expect(fetchMock).toHaveBeenCalled()
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody.top_p).toBe(0.95)
  })

  it('rethrows AbortError in judgeReplyRefusal when user cancels', async () => {
    const controller = new AbortController()
    controller.abort() // Immediately aborted

    await expect(
      judgeReplyRefusal(
        'User prompt',
        'Assistant reply',
        { providerId: 'groq', model: 'llama-3.1-8b-instant' },
        controller.signal,
      ),
    ).rejects.toThrow('Chat generation stopped by user.')
  })

  it('streams tokens incrementally via onDelta during chat execution when streaming is enabled', async () => {
    // Mock SSE streaming response
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]

    const encoder = new TextEncoder()
    let chunkIndex = 0
    const stream = new ReadableStream({
      pull(ctrl) {
        if (chunkIndex < sseChunks.length) {
          ctrl.enqueue(encoder.encode(sseChunks[chunkIndex++]))
        } else {
          ctrl.close()
        }
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    })
    vi.stubGlobal('fetch', fetchMock)

    const streamedChunks: string[] = []
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      streaming: true,
      chatDefault: { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      keyedProviders: ['groq'],
    }

    const result = await executeChatWithFallback({
      messages: [{ role: 'user', content: 'Say hello' }],
      settings,
      onDelta: (chunk) => streamedChunks.push(chunk),
    })

    expect(result.content).toBe('Hello world')
    expect(streamedChunks).toEqual(['Hello', ' world'])
  })

  it('stops immediately when user aborts during chat generation', async () => {
    const controller = new AbortController()

    const fetchMock = vi.fn().mockImplementation(() => {
      controller.abort()
      const err = new DOMException('Chat generation stopped by user.', 'AbortError')
      return Promise.reject(err)
    })
    vi.stubGlobal('fetch', fetchMock)

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      chatDefault: { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      keyedProviders: ['groq'],
    }

    await expect(
      executeChatWithFallback({
        messages: [{ role: 'user', content: 'Hello' }],
        settings,
        signal: controller.signal,
      }),
    ).rejects.toThrow('Chat generation stopped by user.')
  })
})
