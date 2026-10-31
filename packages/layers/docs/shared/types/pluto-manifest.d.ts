// The build manifest of the hybrid mode: type name → content id → version. The module makes it
// as a Nitro virtual module. See modules/pluto-docs/manifest.ts.
declare module '#pluto-docs/manifest' {
  const manifest: Record<string, Record<string, string>>
  export default manifest
}
