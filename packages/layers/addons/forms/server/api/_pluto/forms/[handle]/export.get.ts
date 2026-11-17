const PAGE = 200

const MAX_ROWS = 10_000

export default defineEventHandler(async (event) => {
  await requireFormsCapability(event, PLUTO_FORMS_READ_SUBMISSIONS)
  const handle = requireFormHandle(event)
  const store = requireFormStore()

  const rows: Awaited<ReturnType<typeof store.list>>['data'] = []
  let total = Infinity
  while (rows.length < total && rows.length < MAX_ROWS) {
    const page = await store.list(handle, { limit: PAGE, offset: rows.length })
    rows.push(...page.data)
    total = page.data.length > 0 ? page.total : rows.length
  }

  const form = await loadFormDefinition(handle)
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${handle}-submissions.csv"`
  )
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return plutoFormsCsv(form?.fields ?? [], rows)
})
