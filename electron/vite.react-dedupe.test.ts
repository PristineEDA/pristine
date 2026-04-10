import { describe, expect, it } from 'vitest'

import mainConfig from '../vite.config'
import webConfig from '../vite.config.web'

type ResolvedConfig = {
  resolve?: {
    dedupe?: string[]
  }
}

function resolveConfig(config: unknown): ResolvedConfig {
  if (typeof config === 'function') {
    return config({ command: 'serve', mode: 'test', isSsrBuild: false, isPreview: false }) as ResolvedConfig
  }

  return config as ResolvedConfig
}

describe('vite react dedupe regression', () => {
  it('keeps react and react-dom deduped in the desktop app config', () => {
    const config = resolveConfig(mainConfig)

    expect(config.resolve?.dedupe).toEqual(expect.arrayContaining(['react', 'react-dom']))
  })

  it('keeps react and react-dom deduped in the web config', () => {
    const config = resolveConfig(webConfig)

    expect(config.resolve?.dedupe).toEqual(expect.arrayContaining(['react', 'react-dom']))
  })
})