import { definePlutoPageType } from '../../../../shared/utils/page-type'

export const plutoGithubPageType = definePlutoPageType({
  source: 'pages',
  files: { nested: true },
  publishedAtColumn: 'publishedAt',
  timestamps: { created: 'createdAt', updated: 'updatedAt' },
  capabilities: {
    read: 'pages:read_drafts',
    write: 'pages:publish',
    delete: 'pages:delete',
  },
  defaultSort: { field: 'id', direction: 'asc' },
})
