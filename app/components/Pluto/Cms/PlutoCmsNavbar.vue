<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { usePlutoCmsSession } from '../../../../modules/pluto-cms/runtime/app/composables/pluto-cms-session'

// The CMS admin navbar. It has the same structure as the supabase layer's
// NavbarAdmin: the 40px bar, the menu button for small screens, the logo and
// site name, "View site", the layer actions, the color mode button and the
// user menu.
const route = useRoute()
const isSidebarOpen = usePlutoAdminMenuOpen()
const { t } = usePlutoI18n()
const { user, logout } = usePlutoCmsSession()
const siteName = useRuntimeConfig().public.websiteName

const isAdmin = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'))
const displayName = computed(() => user.value?.name || user.value?.login || t('pluto.cms.navbar.defaultUserName'))

async function signOut() {
  await logout()
  await navigateTo('/admin/login')
}

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: user.value?.login ? `${displayName.value} (${user.value.login})` : displayName.value,
      avatar: user.value?.avatarUrl ? { src: user.value.avatarUrl, alt: displayName.value } : { icon: 'lucide:user' },
      type: 'label',
    },
  ],
  [
    {
      label: t('pluto.common.settings'),
      icon: 'i-lucide-cog',
      onSelect: () => navigateTo('/admin/settings'),
    },
  ],
  [
    {
      label: t('pluto.cms.navbar.signOut'),
      icon: 'i-lucide-log-out',
      class: 'cursor-pointer',
      onSelect: signOut,
    },
  ],
])
</script>

<template>
  <PlutoNavbarAdmin>
    <div class="flex h-full min-w-0 items-stretch justify-between gap-1 px-2 lg:px-4">
      <div class="flex min-w-0 items-center gap-x-1 lg:gap-x-3">
        <UButton
          :aria-label="t('pluto.cms.navbar.openNavigation')"
          class="lg:hidden"
          icon="lucide:menu"
          color="neutral"
          variant="ghost"
          square
          @click="isSidebarOpen = true"
        />

        <div class="h-full shrink-0 py-1">
          <NuxtLink
            :title="t('pluto.cms.navbar.goHome')"
            to="/admin/home"
            class="group flex h-full items-center gap-x-2"
          >
            <img
              src="/img/pluto.png"
              alt=""
              class="block h-full grayscale-100 group-hover:grayscale-0"
            />
            <span class="text-highlighted hidden max-w-48 truncate text-sm font-semibold md:inline">{{ siteName }}</span>
          </NuxtLink>
        </div>

        <div class="h-full min-w-0 overflow-hidden">
          <ul class="flex h-full min-w-0 items-center gap-x-1 text-sm">
            <li v-if="isAdmin" class="shrink-0">
              <UButton
                :label="t('pluto.cms.navbar.viewSite')"
                :title="t('pluto.cms.navbar.viewSiteTitle')"
                icon="lucide:external-link"
                to="/"
                target="_blank"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </li>

            <ClientOnly>
              <PlutoNavbarAdminActions />
            </ClientOnly>
          </ul>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1 lg:gap-3">
        <ColorModeButton />

        <div class="h-full">
          <UDropdownMenu :items="items" :ui="{ content: 'w-64' }" :modal="false">
            <button
              :aria-label="t('pluto.cms.navbar.openUserMenu')"
              class="group h-full py-1"
              type="button"
            >
              <div class="flex h-full items-center gap-x-2 rounded-sm rounded-l-xl pr-2 pl-0.5 group-hover:bg-elevated">
                <UAvatar
                  :src="user?.avatarUrl || undefined"
                  :alt="displayName"
                  :ui="{ root: 'rounded-xl', icon: 'text-inverted text-lg' }"
                  size="sm"
                  icon="lucide:user"
                  class="bg-primary"
                />

                <span class="text-highlighted hidden text-sm font-semibold lg:inline">
                  {{ user?.login ?? displayName }}
                </span>
              </div>
            </button>
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </PlutoNavbarAdmin>
</template>
