export default defineNitroPlugin(() => {
  const git = useRuntimeConfig().public.plutoGithub as
    | { enabled?: boolean }
    | undefined
  if (git?.enabled !== true) {
    return
  }

  registerContentType({
    ...plutoFormsGitType,
    hooks: {
      toPublic: createFormsToPublic({
        parse: parsePlutoBlocks,
        custom: () => plutoFormCustomTypes(getFormsAppConfig().fieldTypes).blocks,
      }),
    },
  })
})
