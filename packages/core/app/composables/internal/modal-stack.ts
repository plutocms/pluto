const openModals: symbol[] = []

export function pushModal(id: symbol): void {
  if (!openModals.includes(id)) {
    openModals.push(id)
  }
}

export function removeModal(id: symbol): void {
  const index = openModals.indexOf(id)
  if (index !== -1) {
    openModals.splice(index, 1)
  }
}

export function isTopModal(id: symbol): boolean {
  return openModals.at(-1) === id
}
