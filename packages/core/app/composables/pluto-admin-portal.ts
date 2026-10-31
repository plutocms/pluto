/**
 * A portal target for the dropdown menus of the admin bar. The default portal
 * is the end of `<body>`, outside the admin scope. This target carries
 * `data-pluto-admin-scope`, so a menu gets the admin theme and the admin
 * radius on a public page too. The target is at the end of `<body>`, not in the
 * navbar: the navbar is fixed with a z-index, so it makes a stacking context,
 * and a menu inside it cannot show above a site header with the same z-index.
 * The composable makes the element itself. A target that Vue renders can
 * appear after the portal looks for it. Pass `portalTarget ?? true` to the
 * `portal` prop of `UDropdownMenu`.
 *
 * The menus look like the bar: the target also carries `data-pluto-admin-dark`
 * (the dark tokens in both color modes), and a menu sets the bar color
 * (`bg-(--pluto-admin-navbar)`, also on its arrow) and `sideOffset: 2`.
 */
export function usePlutoAdminPortal() {
  const portalTarget = shallowRef<HTMLElement>()
  onMounted(() => {
    const el = document.createElement('div')
    el.setAttribute('data-pluto-admin-scope', '')
    el.setAttribute('data-pluto-admin-dark', '')
    document.body.append(el)
    portalTarget.value = el
  })
  onUnmounted(() => portalTarget.value?.remove())
  return portalTarget
}
