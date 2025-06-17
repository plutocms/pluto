export function useObjectURL(file: File) {
  const blob = shallowRef(file ? URL.createObjectURL(file) : undefined)

  watch(toRef(file), (value) => {
    blob.value = value ? URL.createObjectURL(value) : undefined
  })

  return { blob }
}
