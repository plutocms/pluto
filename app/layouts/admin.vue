<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// `to` is typed per-app via Nuxt's typed pages, so it differs across every
// app that extends this layout as a layer. This menu only ever uses `href`,
// so drop `to` here to avoid a cross-app type mismatch on that field.
type SidebarMenuItem = Omit<NavigationMenuItem, 'to'>

const { actions: sidebarActions } = useSidebarAdminActions()
const route = useRoute()
const isSidebarOpen = useState<boolean>('pluto-admin-sidebar-open', () => false)

function closeSidebar() {
  isSidebarOpen.value = false
}

const menu = shallowRef<SidebarMenuItem[]>([
  {
    label: 'Home',
    href: '/admin/home',
    icon: 'lucide:house',
  },
  ...(sidebarActions.value as unknown as SidebarMenuItem[]),
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: 'lucide:settings',
  },
])

watch(
  () => route.fullPath,
  closeSidebar
)
</script>

<template>
  <div
    class="dark:bg-admin-content light:bg-white font-outfit flex h-dvh min-h-0 grow flex-col overflow-hidden"
  >
    <NavbarAdmin />

    <div class="relative flex min-h-0 flex-1 items-stretch">
      <Transition name="sidebar-fade">
        <button
          v-if="isSidebarOpen"
          type="button"
          aria-label="Close navigation"
          class="fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          @click="closeSidebar"
        />
      </Transition>

      <aside
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
        class="dark:bg-admin-sidebar light:bg-zinc-100 border-default fixed inset-y-14 left-0 z-50 flex w-[min(18rem,85vw)] shrink-0 flex-col border-r px-3 py-4 shadow-2xl transition-transform duration-200 lg:static lg:inset-auto lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none"
      >
        <div class="mb-3 flex items-center justify-between px-2 lg:hidden">
          <span class="text-muted text-sm font-semibold">Navigation</span>
          <UButton
            icon="lucide:x"
            color="neutral"
            variant="ghost"
            aria-label="Close navigation"
            square
            @click="closeSidebar"
          />
        </div>

        <UNavigationMenu
          :items="menu"
          :ui="{
            link: 'text-base gap-x-3 font-normal',
          }"
          orientation="vertical"
          class="data-[orientation=vertical]:w-full"
          highlight
        />
      </aside>

      <div class="min-w-0 grow overflow-x-hidden overflow-y-auto">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-fade-enter-active,
.sidebar-fade-leave-active {
  transition: opacity 200ms ease;
}

.sidebar-fade-enter-from,
.sidebar-fade-leave-to {
  opacity: 0;
}
</style>
