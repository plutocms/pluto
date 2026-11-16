import { definePlutoMenuType } from '../../../../shared/utils/menu-type'

export const plutoGithubMenuType = definePlutoMenuType({
  source: 'menus',
  timestamps: { created: 'createdAt', updated: 'updatedAt' },
  capabilities: {
    write: 'menus:write',
    delete: 'menus:write',
  },
  defaultSort: { field: 'id', direction: 'asc' },
})
