<script setup lang="ts">
import { isAdminPath } from '../../../composables/internal/admin-shell'

// The core admin navbar: the 40px bar, the menu button for small screens, the
// logo and site name, "View site", the actions of the layers, the color mode
// button and the user menu. It has no top-level await, so it renders from the
// state of the auth driver. See the admin-shell skill.
const route = useRoute()
const isSidebarOpen = usePlutoAdminMenuOpen()
const { t } = usePlutoI18n()
const { hasDriver } = usePlutoAuth()
const site = usePlutoSiteInfo()
const host = useRequestURL().host
const websiteName = useRuntimeConfig().public.websiteName as string | undefined

const isAdmin = computed(() => isAdminPath(route.path))
const siteName = computed(() => {
  const name = site.name.value || websiteName || ''
  return name === 'Untitled' ? '' : name
})
const siteUrl = computed(() => site.url.value || '/')
const siteDomain = computed(() => domainFromUrl(site.url.value) || host)
</script>

<template>
  <PlutoNavbarAdmin>
    <div
      class="flex h-full min-w-0 items-stretch justify-between gap-1 px-2 lg:px-4"
    >
      <div class="flex min-w-0 items-center gap-x-1 lg:gap-x-3">
        <PlutoNavbarHit
          :label="t('pluto.navbar.openNavigation')"
          class="lg:hidden"
          icon="lucide:menu"
          square
          @click="isSidebarOpen = true"
        />

        <div class="h-full shrink-0">
          <NuxtLink
            :title="t('pluto.navbar.goHome')"
            to="/admin/home"
            class="group flex h-full items-center gap-x-2"
          >
            <PlutoLogo
              aria-hidden="true"
              class="text-highlighted block h-[31px] w-auto grayscale-100 group-hover:grayscale-0"
            />
            <span
              v-if="siteName"
              class="text-highlighted hidden max-w-48 truncate text-sm font-semibold md:inline"
            >
              {{ siteName }}
            </span>
          </NuxtLink>
        </div>

        <div class="h-full min-w-0 overflow-hidden">
          <ul class="flex h-full min-w-0 items-center gap-x-1 text-sm">
            <PlutoNavbarButton
              v-if="isAdmin"
              :label="t('pluto.navbar.viewSite')"
              :title="t('pluto.navbar.visitSite', { domain: siteDomain })"
              :to="siteUrl"
              icon="lucide:external-link"
              target="_blank"
            />

            <ClientOnly>
              <template #fallback>
                <li class="h-full">
                  <div
                    class="text-dimmed flex h-full items-center gap-x-2 rounded-sm px-2"
                  >
                    <Icon name="svg-spinners:ring-resize" />
                  </div>
                </li>
              </template>

              <PlutoNavbarAdminActions />
            </ClientOnly>
          </ul>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1 lg:gap-3">
        <ColorModeButton />

        <!--
          The user is known in the browser only. On a public page the server
          renders the bar from the hint, so the menu loads after the mount.
        -->
        <ClientOnly>
          <PlutoAdminUserMenu v-if="hasDriver" />

          <template #fallback>
            <div class="flex h-full items-center pl-0.5" aria-hidden="true">
              <USkeleton class="size-7 rounded-xl" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
  </PlutoNavbarAdmin>
</template>
