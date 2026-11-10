import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../../../lib/api'
import { answerFor } from './answers'
import { InquiryContext, type InquiryMessage } from './inquiryContext'

/** How much of the conversation goes to the server with each question. */
const HISTORY = 12

// Lives above the routes so the conversation survives moving between pages.
export function InquiryProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<InquiryMessage[]>([])
  const [typing, setTyping] = useState(false)
  const nextId = useRef(1)

  const ask = useCallback(
    (text: string) => {
      const question = text.trim()
      if (!question || typing) return
      const asked: InquiryMessage = { id: nextId.current++, from: 'user', text: question }
      const conversation = [...messages, asked]
      setMessages(conversation)
      setTyping(true)

      api<{ reply: string }>('/api/public/inquiries', {
        method: 'POST',
        body: { messages: conversation.slice(-HISTORY).map(({ from, text }) => ({ from, text })) },
      })
        .then((r) => r.reply)
        // Gemini unreachable, busy, or not set up: the built-in answers still cover the common questions.
        .catch(() => answerFor(question))
        .then((reply) => {
          setMessages((m) => [...m, { id: nextId.current++, from: 'parish', text: reply }])
          setTyping(false)
        })
    },
    [messages, typing],
  )

  const value = useMemo(() => ({ open, setOpen, messages, typing, ask }), [open, messages, typing, ask])

  return <InquiryContext.Provider value={value}>{children}</InquiryContext.Provider>
}
