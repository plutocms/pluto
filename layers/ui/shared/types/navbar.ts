export interface NavbarAdminActionButtonProps {
  label: string
  icon: string | undefined
  to: string | null | undefined
  show?: boolean
  title?: string
  disabled?: boolean
  target?: '_blank' | '_self' | '_parent' | '_top'
}
