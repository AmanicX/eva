import { describe, it, expect, vi, beforeEach } from 'vitest'
import { storeImageBlob, getImageBlob, clearAllImages } from '@/lib/imageStorage'
import { download } from '@/lib/utils'

describe('Image Durability & Download Verification', () => {
  beforeEach(async () => {
    await clearAllImages()
  })

  it('stores and retrieves image blobs by ID', async () => {
    const fakeBlob = new Blob(['fake image bytes'], { type: 'image/png' })
    const imageId = 'img_test_123'

    const storedUrl = await storeImageBlob(imageId, fakeBlob, 'a scenic mountain')
    expect(storedUrl).toBeDefined()

    // Restore from store by ID
    const restoredUrl = await getImageBlob(imageId)
    expect(restoredUrl).toBeDefined()
    expect(typeof restoredUrl).toBe('string')
  })

  it('clearAllImages wipes stored images', async () => {
    const fakeBlob = new Blob(['bytes'], { type: 'image/png' })
    await storeImageBlob('img_test_to_clear', fakeBlob, 'test prompt')

    await clearAllImages()

    const retrieved = await getImageBlob('img_test_to_clear')
    expect(retrieved).toBeNull()
  })

  it('download function correctly sets filename and triggers anchor click without argument reversal', async () => {
    let clickedHref = ''
    let clickedDownload = ''

    const fakeAnchor: any = {
      set href(val: string) {
        clickedHref = val
      },
      get href() {
        return clickedHref
      },
      set download(val: string) {
        clickedDownload = val
      },
      get download() {
        return clickedDownload
      },
      click: vi.fn(),
    }

    const mockDoc = {
      createElement: vi.fn().mockReturnValue(fakeAnchor),
      body: {
        appendChild: vi.fn().mockReturnValue(fakeAnchor),
        removeChild: vi.fn().mockReturnValue(fakeAnchor),
      },
    }

    ;(globalThis as any).document = mockDoc

    const filename = 'eva-scene-test123.png'
    const content = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    await download(filename, content, 'image/png')

    // Verify filename is in the download property, NOT the href property
    expect(clickedDownload).toBe('eva-scene-test123.png')
    expect(clickedHref).toBeDefined()
    expect(fakeAnchor.click).toHaveBeenCalledTimes(1)
  })
})
