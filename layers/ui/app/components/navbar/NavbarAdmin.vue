<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const host = useRequestURL().host

const route = useRoute()

const { isLoggedIn, user, logout } = await useAuth()

const { actions: adminActions } = useNavbarAdminActions()

const has_settings_modified = useState<boolean>('has_settings_modified')

const { data: settingsData, status } = await useFetch('/api/settings', {
  watch: [has_settings_modified],
})

const maybeDevUrl = computed(() => {
  if (import.meta.dev) {
    return `http://${host}`
  }

  return settingsData.value?.settings.website_url || ''
})

const items = ref<DropdownMenuItem[][]>([
  [
    {
      label: `${user.value?.first_name} ${user.value?.last_name}` || '',
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
        <div class="h-full shrink-0 py-1">
          <NuxtLink
            title="Go to dashboard home"
            to="/admin/home"
            class="group block h-full"
          >
            <img
              src="/img/pluto.png"
              class="block h-full grayscale-100 group-hover:grayscale-0"
            />
          </NuxtLink>
        </div>

        <div class="h-full">
          <ul class="flex h-full items-center text-sm">
            <NavbarAdminActionButton
              :show="route.path.startsWith('/admin')"
              :title="`Visit ${domainFromUrl(maybeDevUrl)}`"
              :icon="
                status === 'pending'
                  ? 'lucide:loader-circle'
                  : 'lucide:external-link'
              "
              :disabled="status === 'pending'"
              :to="maybeDevUrl"
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
                  :alt="user?.first_name || ''"
                  size="sm"
                  icon="lucide:user"
                  class="bg-green-600"
                />

                <span
                  class="light:text-zinc-800 text-sm font-bold dark:text-white"
                >
                  {{ user?.first_name }}
                </span>
              </div>
            </button>
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </nav>
</template>
