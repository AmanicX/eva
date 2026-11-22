import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Production Android update identity', () => {
  it('keeps the original package and increases the internal version for v2.5', () => {
    const gradle = read('android/app/build.gradle')
    expect(gradle).toContain('applicationId "com.nexus.chatstudio"')
    expect(gradle).toContain(`versionName "${JSON.parse(read('package.json')).version}"`)
    expect(Number(gradle.match(/versionCode (\d+)/)?.[1])).toBeGreaterThan(28)
    expect(read('android/variables.gradle')).toMatch(/minSdkVersion = 28/)
  })

  it('uses the legacy key only for rotation, never to sign the production APK', () => {
    const script = read('scripts/sign-android-release.sh')
    const signingCommand = script.slice(script.indexOf('"$APKSIGNER" sign'))
    expect(script).toContain('"$APKSIGNER" rotate')
    expect(signingCommand).toContain('--lineage "$LINEAGE"')
    expect(signingCommand).toContain('--rotation-min-sdk-version 28')
    expect(signingCommand).toContain('--v1-signing-enabled false')
    expect(signingCommand).toContain('--v2-signing-enabled false')
    expect(signingCommand).not.toContain('--old-signer')
    expect(signingCommand).not.toContain('LEGACY_KEYSTORE')
  })

  it('proves a real in-place update before production publication', () => {
    const workflow = read('.github/workflows/release.yml')
    expect(workflow).toContain('reactivecircus/android-emulator-runner@v2')
    expect(workflow).toContain('api-level: 36')
    expect(workflow).toContain('bash scripts/smoke-android-upgrade.sh')
    expect(workflow).toContain('--publish never')
    const smoke = read('scripts/smoke-android-upgrade.sh')
    expect(smoke).toContain('release download v2.2.2 -R AmanicX/eva')
    expect(smoke).toContain('adb install -r out/Eva-android.apk')
    expect(smoke).not.toMatch(/adb uninstall/)
    expect(smoke).toContain('BEFORE_UID')
    expect(smoke).toContain('AFTER_UID')
  })
})
