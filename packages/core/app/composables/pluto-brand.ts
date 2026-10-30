import type { PlutoBrand } from '../../shared/types/brand'

/**
 * The brand of the admin (white label), from `appConfig.pluto.brand`. The
 * developer sets it in code. `css` holds the rule for the primary scale, the
 * radius and the fonts (empty with no such field). `PlutoRoot` adds it to the
 * head, so the admin layouts and the admin chrome on public pages get it.
 */
export function usePlutoBrand() {
  const appConfig = useAppConfig()
  const brand = computed<PlutoBrand>(() => appConfig.pluto?.brand ?? {})

  return {
    brand,
    /** Show the links to Pluto. Default true. */
    plutoLinks: computed(() => brand.value.plutoLinks !== false),
    css: computed(() => plutoBrandCss(brand.value)),
  }
}
