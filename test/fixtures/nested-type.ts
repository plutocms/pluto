import type { PlutoContentType } from '../../shared/types/content'
import { plutoCmsPostType } from '../../modules/pluto-cms/runtime/shared/post-type'

/**
 * The post type, stored in nested folders under `content/docs`. The capability
 * keys stay the post keys, so the content adapter contract runs on it.
 */
export const nestedType: PlutoContentType = {
  ...plutoCmsPostType,
  name: 'doc',
  label: 'Doc',
  labelPlural: 'Docs',
  source: 'docs',
  files: { nested: true },
}
