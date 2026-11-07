import type { UserConfig } from '@commitlint/types'

// Conventional Commits: semantic-release derives the next version from these messages.
const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
}

export default config
