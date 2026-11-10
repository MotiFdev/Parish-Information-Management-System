import type { AwaitingRequest } from '../sampleData'

/** "Baptism certificate", "Baptism record correction". */
export const requestTitle = (r: AwaitingRequest) =>
  `${r.recordType} ${r.requestType === 'Record Correction' ? 'record correction' : r.requestType === 'New Registration' ? 'new registration' : 'certificate'}`

export const registerRef = (r: AwaitingRequest) =>
  r.register ? `Book ${r.register.book}, page ${r.register.page}, line ${r.register.line}` : 'Not in the register yet (new registration)'

export const dateTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})
