import { definePlutoAreaType } from '../../../../shared/utils/area-type'

export const plutoGithubAreaType = definePlutoAreaType({
  source: 'areas',
  timestamps: { created: 'createdAt', updated: 'updatedAt' },
  capabilities: {
    write: 'areas:write',
    delete: 'areas:write',
  },
  defaultSort: { field: 'id', direction: 'asc' },
})
