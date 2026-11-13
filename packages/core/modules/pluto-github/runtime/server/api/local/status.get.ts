import { defineEventHandler } from 'h3'
import { handleLocalGitStatus } from '../../utils/local-git-routes'

export default defineEventHandler(handleLocalGitStatus)
