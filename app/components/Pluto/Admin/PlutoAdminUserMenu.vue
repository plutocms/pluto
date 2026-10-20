<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { displayName, shortName } from '../../../composables/internal/admin-shell'

// The user menu of the admin navbar: the avatar, the short name and a dropdown
// with Settings, the items of the layers, the Pluto link and Sign out.
const { t } = usePlutoI18n()
const { user, signOut } = usePlutoAuth()
const account = usePlutoAccountMenu()

const name = computed(() => displayName(user.value, t('pluto.navbar.defaultUserName')))
const short = computed(() => shortName(user.value, t('pluto.navbar.defaultUserName')))
const menuLabel = computed(() =>
  user.value?.username && user.value.username !== name.value ? `${name.value} (${user.value.username})` : name.value
)
const avatar = computed(() => user.value?.avatarUrl || undefined)

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: menuLabel.value,
      avatar: avatar.value
        ? { src: avatar.value, alt: name.value }
        : { icon: 'lucide:user', class: 'bg-primary', ui: { icon: 'text-inverted text-sm' } },
      type: 'label',
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
      onSelect: item.onSelect ?? (item.to && item.kbds ? () => navigateTo(item.to) : undefined),
    })),
  ],
  [
    {
      label: t('pluto.navbar.github'),
      icon: 'i-simple-icons-github',
      type: 'link',
      to: 'https://github.com/plutocms/pluto',
      target: '_blank',
      external: true,
    },
  ],
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
</script>

<template>
  <div class="h-full">
    <UDropdownMenu :items="items" :ui="{ content: 'w-64' }" :modal="false">
      <button
        :aria-label="t('pluto.navbar.openUserMenu')"
        class="group h-full py-1"
        type="button"
      >
        <div class="flex h-full items-center gap-x-2 rounded-sm rounded-l-xl pr-2 pl-0.5 group-hover:bg-elevated">
          <UAvatar
            :src="avatar"
            :alt="name"
            :ui="{ root: 'rounded-xl', icon: 'text-inverted text-lg' }"
            size="sm"
            icon="lucide:user"
            class="bg-primary"
          />

          <span class="text-highlighted hidden text-sm font-semibold lg:inline">
            {{ short }}
          </span>
        </div>
      </button>
    </UDropdownMenu>
  </div>
</template>
