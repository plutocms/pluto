import { defineEventHandler } from 'h3'
import { handleLocalGitPush } from '../../utils/local-git-routes'

export default defineEventHandler(handleLocalGitPush)
