import { describe, test, expect } from 'vitest'
import { buildGoogleAuthorizeUrl } from '../../lib/google.js'

describe('buildGoogleAuthorizeUrl', () => {
  test('builds a Google authorize URL with offline access and both readonly scopes', () => {
    const url = buildGoogleAuthorizeUrl('https://home-hub-family-dev.web.app/settings')
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)
    expect(url).toContain('response_type=code')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly'))
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/tasks.readonly'))
    expect(url).toContain(encodeURIComponent('https://home-hub-family-dev.web.app/settings'))
  })
})
