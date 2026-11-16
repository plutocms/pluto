import * as vue from 'vue'
import {
  matchVimeoUrl,
  matchYoutubeUrl,
} from '../../../core/shared/utils/embed'
import { BLOCKS_NETWORKS } from '../app/utils/blocks-names'
import {
  blocksColor,
  blocksCssUrl,
  blocksLength,
  blocksLevel,
  blocksLink,
  blocksPercent,
  blocksSpace,
  blocksUnwrapParagraphs,
  blocksUrl,
} from '../app/utils/blocks-style'

const auto = {
  computed: vue.computed,
  defineComponent: vue.defineComponent,
  inject: vue.inject,
  provide: vue.provide,
  useId: vue.useId,
  blocksColor,
  blocksCssUrl,
  blocksLength,
  blocksLevel,
  blocksLink,
  blocksPercent,
  blocksSpace,
  blocksUnwrapParagraphs,
  blocksUrl,
  BLOCKS_NETWORKS,
  definePlutoBlock: <T>(definition: T) => definition,
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
  usePlutoRegistry: () => ({
    embedProviders: {
      list: {
        value: [
          { id: 'youtube', match: matchYoutubeUrl, component: 'youtube-embed' },
          { id: 'vimeo', match: matchVimeoUrl, component: 'vimeo-embed' },
        ],
      },
    },
  }),
}

Object.assign(globalThis, auto)
