<script setup lang="ts">
import type { User } from '#shared/types/user'
import type { DropdownMenuItem } from '@nuxt/ui'

const supabase = useSupabaseClient()

const {
  data: { user: userData },
} = await supabase.auth.getUser()

const user = userData?.user_metadata as User

const items = ref<DropdownMenuItem[][]>([
  [
    {
      label: user?.first_name || '',
      avatar: {
        icon: 'lucide:user',
        class: 'bg-green-600',
        ui: {
          icon: 'text-white text-sm',
        },
      },
      type: 'label',
    },
  ],

  [
    {
      label: 'Settings',
      icon: 'i-lucide-cog',
      type: 'link',
      to: '/admin/settings',
      kbds: ['meta', ','],
    },
  ],

  [
    {
      label: 'GitHub',
      icon: 'i-simple-icons-github',
      type: 'link',
      to: 'https://github.com/ojvribeiro/pluto',
      target: '_blank',
      external: true,
    },
  ],

  [
    {
      label: 'Logout',
      icon: 'i-lucide-log-out',
      kbds: ['meta', 'shift', 'q'],
      class: 'cursor-pointer',
      async onSelect() {
        await supabase.auth.signOut()

        navigateTo('/admin/login')
      },
    },
  ],
])
</script>

<template>
  <nav
    class="sticky top-0 z-50 h-10 shrink-0 border-b border-black/10 bg-black/90 text-white dark:border-white/5 dark:bg-black"
  >
    <div class="flex h-full items-stretch justify-between px-4">
      <div class="flex items-center gap-x-3">
        <div>
          <ULink to="/admin/home" class="font-bold"> Logo </ULink>
        </div>

        <div class="h-full">
          <ul class="flex h-full items-center text-sm">
            <li class="h-full">
              <ULink
                href="https://emibiscuit.vercel.app"
                class="flex h-full items-center gap-x-2 bg-transparent px-2 transition-none hover:bg-white/20"
                target="_blank"
                title="emibiscuit.com"
              >
                <span> View site </span>

                <Icon name="lucide:external-link" />
              </ULink>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <ColorModeButton />

        <div>
          <UDropdownMenu
            :items="items"
            :ui="{
              content: 'w-48',
            }"
          >
            <UTooltip :text="`${user.first_name} ${user.last_name}` || ''">
              <UAvatar
                :ui="{
                  root: 'rounded-xl',
                  icon: 'text-white text-lg',
                }"
                :alt="user.first_name || ''"
                size="sm"
                icon="lucide:user"
                class="bg-green-600"
              />
            </UTooltip>
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </nav>
</template>
