/**
 * The registered media adapter. Only one is meaningful per app: when more
 * than one layer registers one, the last-registered entry wins, the same
 * "last wins" rule `usePlutoSettings`/`usePlutoPermissions` use to resolve
 * their driver.
 */
export function usePlutoMediaAdapter() {
  const registry = usePlutoRegistry()

  const adapter = computed<PlutoMediaAdapter | undefined>(
    () => registry.mediaAdapters.list.value.at(-1)?.adapter
  )

  return { adapter }
}
