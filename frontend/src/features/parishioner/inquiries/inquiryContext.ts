import { createContext, useContext } from 'react'

export interface InquiryMessage {
  id: number
  from: 'user' | 'parish'
  text: string
}

export interface InquiryContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  messages: InquiryMessage[]
  typing: boolean
  ask: (text: string) => void
}

export const InquiryContext = createContext<InquiryContextValue | null>(null)

export function useInquiry() {
  const ctx = useContext(InquiryContext)
  if (!ctx) throw new Error('useInquiry must be used inside <InquiryProvider>')
  return ctx
}
