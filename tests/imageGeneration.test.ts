import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateImage, resolveImageModel } from '@/lib/imageGeneration'
import { DEFAULT_SETTINGS } from '@/store/useStore'
import { getProviderKey } from '@/lib/credentials'
import { checkImageExplicitContent } from '@/lib/imageGuard'
import { storeImageBlob } from '@/lib/imageStorage'

vi.mock('@/lib/credentials', () => ({ getProviderKey: vi.fn() }))
vi.mock('@/lib/imageGuard', () => ({ checkImageExplicitContent: vi.fn() }))
vi.mock('@/lib/imageStorage', () => ({ storeImageBlob: vi.fn() }))

// Real 1x1 PNG; response shape follows Google's REST reference.
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII='
const imageResponse = () => Response.json({
  candidates: [{ content: { parts: [
    { text: 'Here is your image.' },
    { inlineData: { mimeType: 'image/png', data: png } },
  ] } }],
})
const request = (extra = {}) => generateImage({
  prompt: '  A red kite above a lake.\n',
  preferredProviderId: 'google',
  preferredModel: 'gemini-2.5-flash-image',
  settings: { ...DEFAULT_SETTINGS, keyedProviders: [] },
  ...extra,
})

beforeEach(() => {
  vi.mocked(getProviderKey).mockResolvedValue('test-key')
  vi.mocked(checkImageExplicitContent).mockResolvedValue({ explicit: false })
  vi.mocked(storeImageBlob).mockResolvedValue('blob:saved')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(imageResponse()))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Image Gen provider isolation', () => {
  it('uses generateContent, real credentials, exact manual text and returned MIME', async () => {
    const result = await request()
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent')
    expect(url).not.toContain('test-key')
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' })
    const body = JSON.parse(init?.body as string)
    expect(body.contents[0].parts[0].text).toBe('  A red kite above a lake.\n')
    expect(body.generationConfig.responseModalities).toContain('IMAGE')
    expect(vi.mocked(storeImageBlob).mock.calls[0][1].type).toBe('image/png')
    expect(result.providerId).toBe('google')
    expect(result.prompt).toBe('  A red kite above a lake.\n')
  })

  it.each([
    [401, 'API_KEY_INVALID', /key/i],
    [403, 'PERMISSION_DENIED', /permission|access/i],
    [403, 'BILLING_DISABLED', /billing/i],
    [429, 'RESOURCE_EXHAUSTED', /quota|rate/i],
    [404, 'NOT_FOUND', /model/i],
  ])('explains HTTP %s without leaking errors or falling back', async (status, message, expected) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: { message: `${message} test-key` } }, { status }))
    await expect(request()).rejects.toThrow(expected)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(storeImageBlob).not.toHaveBeenCalled()
  })

  it('does not retry cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(request({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a safety-blocked success response without fallback', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ promptFeedback: { blockReason: 'SAFETY' } }))
    await expect(request()).rejects.toThrow(/safety/i)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects HTML disguised as an image', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: btoa('<html>bad</html>') } }] } }],
    }))
    await expect(request()).rejects.toThrow(/image/i)
    expect(storeImageBlob).not.toHaveBeenCalled()
  })

  it('uses Pollinations authenticated POST without putting prompts or keys in the URL', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ data: [{ b64_json: png }] }))
    const result = await request({ preferredProviderId: 'pollinations', preferredModel: 'flux' })
    expect(fetch).toHaveBeenCalledWith('https://gen.pollinations.ai/v1/images/generations', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
    }))
    expect(result.providerId).toBe('pollinations')
  })

  it('fails before any network request when the selected provider has no key', async () => {
    vi.mocked(getProviderKey).mockResolvedValue('')
    await expect(request()).rejects.toThrow(/key/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not store an image that arrives after cancellation', async () => {
    const controller = new AbortController()
    vi.mocked(fetch).mockImplementation(async () => { controller.abort(); return imageResponse() })
    await expect(request({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(storeImageBlob).not.toHaveBeenCalled()
  })

  it('never sends safety-blocked prompts to the image provider', async () => {
    vi.mocked(checkImageExplicitContent).mockResolvedValue({ explicit: true, reason: 'Explicit prompt' })
    await expect(request()).rejects.toThrow('Explicit prompt')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects disabled image capability before using credentials', async () => {
    await expect(request({ settings: { ...DEFAULT_SETTINGS, providerCapabilities: { google: { chat: true, image: false, tts: true } } } })).rejects.toThrow(/disabled/)
    expect(getProviderKey).not.toHaveBeenCalled()
  })

  it('migrates only known retired image selections and preserves custom IDs for explicit validation', () => {
    expect(resolveImageModel('google', 'imagen-3.0-generate-002')).toBe('gemini-3.1-flash-image')
    expect(resolveImageModel('google', 'gemini-2.5-flash-image')).toBe('gemini-2.5-flash-image')
    expect(resolveImageModel('pollinations', 'flux-anime')).toBe('flux')
    expect(resolveImageModel('google', 'unknown-custom-model')).toBe('unknown-custom-model')
  })
})
