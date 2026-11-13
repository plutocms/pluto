import { defineEventHandler } from 'h3'
import { handleGithubUsers } from '../utils/github-users'

export default defineEventHandler(handleGithubUsers)
