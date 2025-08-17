<script setup lang="ts">
import type { User } from '#shared/types/user'
import type { DropdownMenuItem } from '@nuxt/ui'

const supabase = useSupabaseClient()

const has_settings_modified = useState('has_settings_modified')

const {
  data: { user: userData },
} = await supabase.auth.getUser()

const user = userData?.user_metadata as User

const { data: settingsData, status } = await useFetch('/api/settings', {
  watch: [has_settings_modified],
})

const items = ref<DropdownMenuItem[][]>([
  [
    {
      label: `${user?.first_name} ${user?.last_name}` || '',
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
          <ULink
            :title="settingsData?.settings.website_title"
            to="/admin/home"
            class="font-bold"
          >
            {{ settingsData?.settings.website_title }}
          </ULink>
        </div>

        <div class="h-full">
          <ul class="flex h-full items-center text-sm">
            <li class="h-full">
              <ULink
                :title="domainFromUrl(settingsData?.settings.website_url)"
                :href="settingsData?.settings.website_url"
                :disabled="status === 'pending'"
                class="group block h-full bg-transparent py-1 transition-none"
                target="_blank"
              >
                <span
                  class="text-vulmix box-content flex h-full items-center gap-x-2 rounded-sm px-2 group-hover:bg-white/20"
                >
                  <span> View site </span>

                  <Icon
                    :name="
                      status === 'pending'
                        ? 'lucide:loader-circle'
                        : 'lucide:external-link'
                    "
                    :class="[status === 'pending' ? 'animate-spin' : '']"
                  />
                </span>
              </ULink>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <ColorModeButton />

        <div class="h-full">
          <UDropdownMenu
            :items="items"
            :ui="{
              content: 'w-48',
            }"
          >
            <button class="group h-full py-1">
              <div
                class="flex h-full items-center gap-x-2 rounded-sm rounded-l-xl pr-2 pl-0.5 group-hover:bg-white/20"
              >
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

                <span class="text-sm font-bold">{{ user.first_name }}</span>
              </div>
            </button>
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </nav>
</template>
