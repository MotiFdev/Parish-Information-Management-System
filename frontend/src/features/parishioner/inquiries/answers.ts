import { massSchedule } from '../sampleData'
import { officeHours } from '../officeHours'

// Fallback replies for when the Gemini assistant on the server
// (POST /api/public/inquiries) can't answer.
const rules: Array<{ match: RegExp; reply: () => string }> = [
  {
    match: /\b(mass|masses|schedule|sunday|anticipated)\b/,
    reply: () =>
      `Here is the regular Mass schedule at the parish church:\n${massSchedule
        .map((m) => `• ${m.day}: ${m.times.join(', ')}${m.note ? ` (${m.note})` : ''}`)
        .join('\n')}\n\nChapel Mass times vary by Sona; check the announcements for your chapel.`,
  },
  {
    match: /\b(baptism|baptismal|binyag)\b/,
    reply: () =>
      'For a baptismal certificate, open Record Requests → New Request → Baptism → Certificate Request.\n\nYou’ll need:\n• The baptized person’s full name and date of birth\n• Parents’ names\n• Approximate date and church of baptism\n• A PSA birth certificate (upload a clear photo or scan)',
  },
  {
    match: /\b(confirmation|kumpil)\b/,
    reply: () =>
      'For a confirmation certificate, go to Record Requests → New Request → Confirmation. Have your approximate confirmation date, sponsor’s name, and a baptismal certificate ready.',
  },
  {
    match: /\b(wedding|marry|marriage|kasal)\b/,
    reply: () =>
      'Planning a church wedding? Book a Wedding Pre-interview under Book Appointment first. Canonical requirements such as the certificate of freedom to marry are discussed there.\n\nIf you need a copy of an existing marriage record, use Record Requests → Marriage.',
  },
  {
    match: /\b(house blessing|blessing|bless)\b/,
    reply: () =>
      'To request a house blessing, open Book Appointment, choose House Blessing, confirm your home address, and pick an open date and time. The secretary will confirm or suggest another schedule.',
  },
  {
    match: /\b(office|hours|open|close|collect|claim|release)\b/,
    reply: () => `The parish office is open ${officeHours()}. Bring a valid ID when you collect a certificate that is marked Ready for Collection.`,
  },
  {
    match: /\b(burial|funeral|death|deceased)\b/,
    reply: () =>
      'For burial records, go to Record Requests → New Request → Burial. You’ll need the death certificate and burial permit, plus the informant’s contact details.',
  },
  {
    match: /\b(status|track|follow up|pending|request)\b/,
    reply: () =>
      'Open Track Request and enter the reference number you got when you sent the request (it starts with RR or AP). Record requests move through Pending → Under Verification → Approved → Ready for Collection → Completed.',
  },
]

export function answerFor(question: string) {
  const q = question.toLowerCase()
  const rule = rules.find((r) => r.match.test(q))
  return rule
    ? rule.reply()
    : `I’m not sure about that one yet. Try asking about Mass schedules, certificate requirements, or appointments, or visit the parish office (${officeHours()}).`
}

export const suggestedQuestions = [
  'What time are the Sunday Masses?',
  'What do I need for a baptismal certificate?',
  'How do I book a house blessing?',
  'When is the parish office open?',
]
