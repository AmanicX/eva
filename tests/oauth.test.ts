import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generatePKCECodes,
  generateOAuthState,
  buildGoogleAuthUrl,
  refreshGoogleAccessToken,
  DEFAULT_GOOGLE_CLIENT_ID,
  GOOGLE_DRIVE_APPDATA_SCOPE,
} from '../src/lib/sync/googleDriveProvider'
import {
  startGitHubDeviceFlow,
  pollGitHubDeviceFlow,
  DEFAULT_GITHUB_CLIENT_ID,
} from '../src/lib/sync/githubProvider'

describe('OAuth & Device Authorization Flows', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('Google OAuth 2.0 with PKCE (RFC 7636)', () => {
    it('generates high-entropy PKCE code verifier and S256 challenge', async () => {
      const { verifier, challenge } = await generatePKCECodes()

      expect(verifier).toBeDefined()
      expect(verifier.length).toBe(64) // 32 bytes in hex
      expect(challenge).toBeDefined()
      // URL-safe base64: no '+', '/', or '='
      expect(challenge).not.toMatch(/[+/=]/)

      // Verify that two consecutive calls produce unique cryptographic values
      const second = await generatePKCECodes()
      expect(second.verifier).not.toBe(verifier)
      expect(second.challenge).not.toBe(challenge)
    })

    it('generates secure CSRF state tokens', () => {
      const state1 = generateOAuthState()
      const state2 = generateOAuthState()

      expect(state1.length).toBe(32) // 16 bytes in hex
      expect(state2.length).toBe(32)
      expect(state1).not.toBe(state2)
    })

    it('builds RFC-compliant Google authorization URLs with S256 PKCE params', () => {
      const redirectUri = 'http://127.0.0.1:54321/oauth2callback'
      const state = 'csrf_state_token_123'
      const challenge = 'mock_pkce_challenge_abc'

      const urlString = buildGoogleAuthUrl(DEFAULT_GOOGLE_CLIENT_ID, redirectUri, state, challenge)
      const url = new URL(urlString)

      expect(url.origin).toBe('https://accounts.google.com')
      expect(url.pathname).toBe('/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe(DEFAULT_GOOGLE_CLIENT_ID)
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri)
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('code_challenge')).toBe(challenge)
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('state')).toBe(state)
      expect(url.searchParams.get('access_type')).toBe('offline')
      expect(url.searchParams.get('prompt')).toBe('consent')
      expect(url.searchParams.get('scope')).toContain(GOOGLE_DRIVE_APPDATA_SCOPE)
    })

    it('successfully refreshes Google tokens before expiration', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'fresh_google_access_token_789',
          refresh_token: 'retained_or_rotated_refresh_token',
          expires_in: 3600,
        }),
      } as any)

      const result = await refreshGoogleAccessToken('client-id-123', 'old_refresh_token')

      expect(result.accessToken).toBe('fresh_google_access_token_789')
      expect(result.expiresIn).toBe(3600)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })

    it('handles invalid_grant error during Google token refresh by prompting reconnection', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        }),
      } as any)

      await expect(
        refreshGoogleAccessToken('client-id-123', 'revoked_refresh_token'),
      ).rejects.toThrow('Google authorization has expired or was revoked. Please reconnect your account.')
    })
  })

  describe('GitHub Device Authorization Flow (RFC 8628)', () => {
    it('initiates device flow and returns user code and verification URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          device_code: 'dc_1234567890',
          user_code: 'WDJB-MJHT',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      } as any)

      const response = await startGitHubDeviceFlow(DEFAULT_GITHUB_CLIENT_ID, 'repo')

      expect(response.user_code).toBe('WDJB-MJHT')
      expect(response.verification_uri).toBe('https://github.com/login/device')
      expect(response.device_code).toBe('dc_1234567890')
    })

    it('polls device flow until authorization is confirmed', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn(async () => {
        callCount++
        if (callCount < 2) {
          return {
            ok: true,
            json: async () => ({ error: 'authorization_pending' }),
          } as any
        }
        return {
          ok: true,
          json: async () => ({ access_token: 'gho_device_flow_success_token' }),
        } as any
      })

      // Fast interval for test
      const token = await pollGitHubDeviceFlow(DEFAULT_GITHUB_CLIENT_ID, 'dc_123', 0.01)
      expect(token).toBe('gho_device_flow_success_token')
      expect(callCount).toBe(2)
    })

    it('throws when device code expires during polling', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'expired_token' }),
      } as any)

      await expect(
        pollGitHubDeviceFlow(DEFAULT_GITHUB_CLIENT_ID, 'dc_123', 0.01),
      ).rejects.toThrow('The device code has expired. Please try connecting again.')
    })

    it('throws when user denies authorization on GitHub', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'access_denied' }),
      } as any)

      await expect(
        pollGitHubDeviceFlow(DEFAULT_GITHUB_CLIENT_ID, 'dc_123', 0.01),
      ).rejects.toThrow('Authorization was denied on GitHub.')
    })

    it('aborts cleanly when user cancels device authorization', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(
        pollGitHubDeviceFlow(DEFAULT_GITHUB_CLIENT_ID, 'dc_123', 0.01, controller.signal),
      ).rejects.toThrow('Device authorization cancelled by user.')
    })
  })
})
