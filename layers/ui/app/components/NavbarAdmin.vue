<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { domainFromUrl } from '#imports'

const route = useRoute('admin-product-edit-id')

const { isLoggedIn, userData, logout } = useAuth()

const { actions: adminActions } = useAdminActions()

const has_settings_modified = useState('has_settings_modified')

const { data: settingsData, status } = await useFetch('/api/settings', {
  watch: [has_settings_modified],
})

const items = ref<DropdownMenuItem[][]>([
  [
    {
      label: `${userData.value?.first_name} ${userData.value?.last_name}` || '',
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
      onSelect() {
        if (isLoggedIn.value) {
          navigateTo('/admin/settings')
        }
      },
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
      onSelect() {
        logout({ showToast: true })
      },
    },
  ],
])

defineShortcuts(extractShortcuts(items.value))
</script>

<template>
  <nav
    class="light:bg-white light:border-black/10 font-outfit sticky top-0 z-50 h-10 shrink-0 border-b dark:border-white/5 dark:bg-black dark:text-white"
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
            <ActionButton
              :show="route.path.startsWith('/admin')"
              :title="`Visit ${domainFromUrl(settingsData?.settings.website_url)}`"
              :icon="
                status === 'pending'
                  ? 'lucide:loader-circle'
                  : 'lucide:external-link'
              "
              :disabled="status === 'pending'"
              :to="settingsData?.settings.website_url"
              target="_blank"
              label="View site"
            />

            <ClientOnly>
              <template #fallback>
                <li class="h-full">
                  <div
                    class="light:text-zinc-800/50 flex h-full items-center gap-x-2 rounded-sm px-2 text-white/50"
                  >
                    <Icon name="svg-spinners:ring-resize" />
                  </div>
                </li>
              </template>

              <component
                :is="action"
                v-for="(action, i) in adminActions"
                :key="i"
              />
            </ClientOnly>
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
            :modal="false"
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
                  :alt="userData?.first_name || ''"
                  size="sm"
                  icon="lucide:user"
                  class="bg-green-600"
                />

                <span
                  class="light:text-zinc-800 text-sm font-bold dark:text-white"
                >
                  {{ userData?.first_name }}
                </span>
              </div>
            </button>
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </nav>
</template>
