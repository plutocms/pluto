<script setup lang="ts">
import { isAdminPath } from '../../../composables/internal/admin-shell'

const route = useRoute()
const isSidebarOpen = usePlutoAdminMenuOpen()
const { t } = usePlutoI18n()
const { hasDriver } = usePlutoAuth()
const site = usePlutoSiteInfo()
const { brand } = usePlutoBrand()
const brandLogo = computed(() => brand.value.logoDark || brand.value.logo || '')
const brandMark = computed(() => brand.value.mark || brandLogo.value)
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
            class="group outline-inverted/40 flex h-full items-center gap-x-2 rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <template v-if="brandLogo">
              <img
                :src="brandMark"
                :alt="brand.name ?? ''"
                class="block h-7 w-auto max-w-10 object-contain sm:hidden"
              />
              <img
                :src="brandLogo"
                :alt="brand.name ?? ''"
                class="hidden h-7 w-auto max-w-40 object-contain sm:block"
              />
            </template>
            <PlutoLogo
              v-else
              aria-hidden="true"
              class="block h-6.75 w-auto grayscale-100 group-hover:grayscale-0"
              mark
            />
            <span
              v-if="siteName"
              class="border-default bg-elevated text-highlighted hidden h-6 max-w-48 items-center truncate rounded-full border px-2.5 text-xs/6 font-semibold sm:inline-block"
            >
              {{ siteName }}
            </span>
          </NuxtLink>
        </div>

        <div class="-mx-1 h-full min-w-0 overflow-hidden px-1">
          <ul class="flex h-full min-w-0 items-center gap-x-0.5 text-sm">
            <ClientOnly>
              <template #fallback>
                <li class="h-full">
                  <div
                    class="text-dimmed flex h-full items-center gap-x-2 rounded-sm px-2"
                  >
                    <Icon
                      name="i-lucide-loader-circle"
                      class="size-4 animate-spin"
                    />
                  </div>
                </li>
              </template>

              <PlutoNavbarAdminActions />
            </ClientOnly>

            <PlutoNavbarButton
              v-if="isAdmin"
              :label="t('pluto.navbar.viewSite')"
              :title="t('pluto.navbar.visitSite', { domain: siteDomain })"
              :to="siteUrl"
              icon="i-lucide-arrow-up-right"
              target="_blank"
            />
          </ul>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1 lg:gap-3">
        <ClientOnly>
          <div v-if="isAdmin" class="h-full shrink-0">
            <PlutoAdminBackendBadge />
          </div>
        </ClientOnly>

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
