export interface PlutoContentActivitySeries {
  name: string
  label: string
  labelPlural: string
  icon?: string
  points: PlutoContentActivityPoint[]
}

/**
 * Weekly creation counts for every registered content type, from
 * `GET /api/_pluto/content-activity/<type>`. Types whose adapter cannot count
 * by creation date are left out.
 *
 * The fixed `useAsyncData` key shares one fetch between every caller, so the
 * dashboard tiles ("+N this week") and the activity chart do not fetch twice.
 */
export function usePlutoContentActivity(weeks = 12) {
  const { items: contentTypes } = usePlutoContentTypes()

  return useAsyncData(
    `pluto-content-activity-${weeks}`,
    async () => {
      const series = await Promise.all(
        contentTypes.value.map(async ({ type }): Promise<PlutoContentActivitySeries | null> => {
          const activity = await $fetch<PlutoContentActivity>(`/api/_pluto/content-activity/${type.name}`, {
            query: { weeks },
          })
          return activity.supported
            ? { name: type.name, label: type.label, labelPlural: type.labelPlural, icon: type.icon, points: activity.points }
            : null
        })
      )
      return series.filter((entry): entry is PlutoContentActivitySeries => entry !== null)
    },
    { default: () => [] as PlutoContentActivitySeries[], server: false }
  )
}
