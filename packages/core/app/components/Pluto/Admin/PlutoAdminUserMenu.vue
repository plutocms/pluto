<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  displayName,
  shortName,
} from '../../../composables/internal/admin-shell'

// The user menu of the admin navbar: the avatar, the short name and a dropdown
// with Settings, the items of the layers, the Pluto link and Sign out. An
// administrator (the capability '*') gets a chip on the avatar and an "Admin"
// badge in the menu header.
const { t } = usePlutoI18n()
const { user, signOut } = usePlutoAuth()
const account = usePlutoAccountMenu()
const { isAdmin } = usePlutoPermissions()
// The brand (white label) adds a help link and the agency link, and can hide
// the link to Pluto.
const { brand, plutoLinks } = usePlutoBrand()
const linkItems = computed<DropdownMenuItem[]>(() => [
  ...(brand.value.helpUrl
    ? [
        {
          label: t('pluto.navbar.help'),
          icon: 'i-lucide-life-buoy',
          type: 'link' as const,
          to: brand.value.helpUrl,
          target: '_blank',
          external: true,
        },
      ]
    : []),
  ...(brand.value.url
    ? [
        {
          label:
            brand.value.name ||
            domainFromUrl(brand.value.url) ||
            brand.value.url,
          icon: 'i-lucide-external-link',
          type: 'link' as const,
          to: brand.value.url,
          target: '_blank',
          external: true,
        },
      ]
    : []),
  ...(plutoLinks.value
    ? [
        {
          label: t('pluto.navbar.github'),
          icon: 'i-pluto-github',
          type: 'link' as const,
          to: 'https://github.com/plutocms/pluto',
          target: '_blank',
          external: true,
        },
      ]
    : []),
])

const name = computed(() =>
  displayName(user.value, t('pluto.navbar.defaultUserName'))
)
const short = computed(() =>
  shortName(user.value, t('pluto.navbar.defaultUserName'))
)
const menuLabel = computed(() =>
  user.value?.username && user.value.username !== name.value
    ? `${name.value} (${user.value.username})`
    : name.value
)
const avatar = computed(() => user.value?.avatarUrl || undefined)
const buttonLabel = computed(() =>
  isAdmin.value
    ? `${t('pluto.navbar.openUserMenu')} (${t('pluto.navbar.administrator')})`
    : t('pluto.navbar.openUserMenu')
)

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: menuLabel.value,
      avatar: avatar.value
        ? { src: avatar.value, alt: name.value }
        : {
            icon: 'lucide:user',
            class: 'bg-primary',
            ui: { icon: 'text-inverted text-sm' },
          },
      type: 'label',
      slot: 'account' as const,
    },
  ],
  [
    {
      label: t('pluto.common.settings'),
      icon: 'i-lucide-cog',
      type: 'link',
      to: '/admin/settings',
      kbds: ['meta', ','],
      onSelect: () => navigateTo('/admin/settings'),
    },
    ...account.items.value.map<DropdownMenuItem>((item) => ({
      label: item.label,
      icon: item.icon,
      type: item.to ? 'link' : undefined,
      to: item.to,
      target: item.target,
      kbds: item.kbds,
      // A shortcut needs a handler. A link with a shortcut navigates in it.
      onSelect:
        item.onSelect ??
        (item.to && item.kbds ? () => navigateTo(item.to) : undefined),
    })),
  ],
  ...(linkItems.value.length > 0 ? [linkItems.value] : []),
  [
    {
      label: t('pluto.navbar.signOut'),
      icon: 'i-lucide-log-out',
      kbds: ['meta', 'shift', 'q'],
      class: 'cursor-pointer',
      onSelect: signOut,
    },
  ],
])

defineShortcuts(computed(() => extractShortcuts(items.value)))

// The portal target gives the menu the admin theme on a public page too.
const portalTarget = usePlutoAdminPortal()
</script>

<template>
  <div class="h-full">
    <UDropdownMenu
      :items="items"
      :content="{ sideOffset: 2 }"
      :ui="{
        content: 'w-64 bg-(--pluto-admin-navbar)',
        arrow: 'fill-(--pluto-admin-navbar)',
      }"
      :modal="false"
      :portal="portalTarget ?? true"
      :arrow="{ width: 14, height: 7 }"
    >
      <!--
        The button fills the height of the bar. The pill inside it keeps the
        hover and focus look. See PlutoNavbarHit.
      -->
      <button
        :aria-label="buttonLabel"
        class="group flex h-full items-center outline-none"
        type="button"
      >
        <div
          class="outline-inverted/25 group-hover:bg-elevated group-focus-visible:bg-elevated group-data-[state=open]:bg-elevated flex h-8 items-center gap-x-2 rounded-sm rounded-l-xl pr-2 pl-0.5 group-focus-visible:outline-3"
        >
          <UAvatar
            :src="avatar"
            :alt="name"
            :ui="{ root: 'rounded-xl', icon: 'text-inverted text-lg' }"
            :chip="
              isAdmin
                ? { color: 'warning', position: 'bottom-right' }
                : undefined
            "
            size="sm"
            icon="lucide:user"
            class="bg-primary"
          />

          <span class="text-highlighted hidden text-sm font-semibold lg:inline">
            {{ short }}
          </span>
        </div>
      </button>

      <template #account-trailing>
        <UBadge
          v-if="isAdmin"
          :label="t('pluto.navbar.adminBadge')"
          :title="t('pluto.navbar.administrator')"
          icon="lucide:shield-check"
          color="warning"
          variant="subtle"
          size="sm"
        />
      </template>
    </UDropdownMenu>
  </div>
</template>
