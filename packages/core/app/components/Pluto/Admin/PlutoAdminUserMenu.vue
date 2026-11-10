<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  displayName,
  shortName,
} from '../../../composables/internal/admin-shell'

// The user menu of the admin navbar: the avatar, the short name and a dropdown
// with the account (name, email or username), the theme (Light, Dark, System),
// Settings, the items of the layers, the links and Sign out. An administrator
// (the capability '*') gets a chip on the avatar and an "Admin" badge in the
// account header. The menu has the surface of the admin popovers (it follows the
// color mode), not the dark color of the navbar.
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
// Under the name: the email, else the username when the name is not the username.
const accountDetail = computed(() => {
  if (user.value?.email) {
    return user.value.email
  }
  return user.value?.username && user.value.username !== name.value
    ? `@${user.value.username}`
    : ''
})

// The theme of the admin: Light, Dark or System (the color mode of the device). A site that
// forces a color mode has no theme row.
const colorMode = useColorMode()
type Theme = 'light' | 'dark' | 'system'
const themes = computed<{ value: Theme; label: string; icon: string }[]>(() => [
  {
    value: 'light',
    label: t('pluto.navbar.themeLight'),
    icon: 'i-lucide-sun',
  },
  {
    value: 'dark',
    label: t('pluto.navbar.themeDark'),
    icon: 'i-lucide-moon',
  },
  {
    value: 'system',
    label: t('pluto.navbar.themeSystem'),
    icon: 'i-lucide-monitor',
  },
])
const theme = computed<Theme>(() =>
  colorMode.preference === 'light' || colorMode.preference === 'dark'
    ? colorMode.preference
    : 'system'
)
const currentTheme = computed(() =>
  themes.value.find((option) => option.value === theme.value)!
)
function setTheme(value: Theme) {
  colorMode.preference = value
}
/** The theme row as a menu item (Enter, or a click outside the buttons): the next theme. */
function nextTheme(event: Event) {
  // The menu stays open, so the author sees the new theme.
  event.preventDefault()
  const order: Theme[] = ['light', 'dark', 'system']
  setTheme(order[(order.indexOf(theme.value) + 1) % order.length]!)
}
const buttonLabel = computed(() =>
  isAdmin.value
    ? `${t('pluto.navbar.openUserMenu')} (${t('pluto.navbar.administrator')})`
    : t('pluto.navbar.openUserMenu')
)

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: menuLabel.value,
      type: 'label',
      slot: 'account' as const,
    },
  ],
  ...(colorMode.forced
    ? []
    : [
        [
          {
            label: t('pluto.navbar.theme'),
            icon: currentTheme.value.icon,
            slot: 'theme' as const,
            // The item lines up its content at the top; the control is taller than the label.
            class: 'items-center',
            onSelect: nextTheme,
          },
        ],
      ]),
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
const portalTarget = usePlutoAdminPortal({ dark: false })
</script>

<template>
  <div class="h-full">
    <UDropdownMenu
      :items="items"
      :content="{ align: 'end', sideOffset: 4 }"
      :ui="{ content: 'w-72' }"
      :modal="false"
      :portal="portalTarget ?? true"
      arrow
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

      <!-- The account: the avatar, the name, the email (or the username), the Admin badge. -->
      <template #account>
        <div class="flex w-full min-w-0 items-center gap-3 py-1">
          <UAvatar
            :src="avatar"
            :alt="name"
            :ui="{ root: 'rounded-xl', icon: 'text-inverted text-xl' }"
            size="lg"
            icon="lucide:user"
            class="bg-primary shrink-0"
          />
          <div class="min-w-0 flex-1">
            <p class="text-highlighted truncate text-sm font-semibold">
              {{ name }}
            </p>
            <p
              v-if="accountDetail"
              class="text-muted truncate text-xs font-normal"
            >
              {{ accountDetail }}
            </p>
          </div>
          <UBadge
            v-if="isAdmin"
            :label="t('pluto.navbar.adminBadge')"
            :title="t('pluto.navbar.administrator')"
            icon="lucide:shield-check"
            color="warning"
            variant="subtle"
            size="sm"
            class="shrink-0"
          />
        </div>
      </template>

      <!--
        The theme: a segmented control of three icons. A click on an icon picks that theme; the
        row is one menu item, so Enter (or a click outside the icons) moves to the next theme. The
        icons are for the pointer only (`aria-hidden`): the item names the current theme.
      -->
      <template #theme="{ ui: menuUi }">
        <UIcon :name="currentTheme.icon" :class="menuUi.itemLeadingIcon()" />
        <span :class="menuUi.itemLabel()">
          {{ t('pluto.navbar.theme') }}
          <span class="sr-only">: {{ currentTheme.label }}</span>
        </span>
        <span
          class="border-default ms-auto flex shrink-0 gap-0.5 rounded-md border p-0.5"
          aria-hidden="true"
        >
          <span
            v-for="option in themes"
            :key="option.value"
            :title="option.label"
            :class="
              option.value === theme
                ? 'bg-elevated text-highlighted'
                : 'text-dimmed hover:text-default'
            "
            class="flex size-6 items-center justify-center rounded-sm"
            @click.stop="setTheme(option.value)"
          >
            <UIcon :name="option.icon" class="size-3.5" />
          </span>
        </span>
      </template>
    </UDropdownMenu>
  </div>
</template>
