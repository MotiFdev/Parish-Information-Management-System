import type { ReactNode } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary } from '../../../components/ui/styles'
import { navigate } from '../../../lib/router'
import { bornLabel, chapelName, fullName, sonaName, summary, type DirectorySona, type Parishioner } from './parishionerData'

const longDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' })

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stone-100 px-5 py-5 first:border-t-0">
      <h3 className="mb-3 font-semibold text-stone-900">{title}</h3>
      {children}
    </section>
  )
}

function Person({ p, role, onOpen, self }: { p?: Parishioner; role: string; onOpen: (p: Parishioner) => void; self?: boolean }) {
  if (!p)
    return (
      <div className="flex min-h-16 flex-col justify-center rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm">
        <span className="text-xs text-stone-600">{role}</span>
        <span className="text-stone-600">Not recorded</span>
      </div>
    )
  const body = (
    <>
      <span className="text-xs text-stone-600">{role}</span>
      <span className={`block font-semibold ${self ? 'text-forest' : 'text-stone-900'}`}>{fullName(p)}</span>
      <span className="block text-xs text-stone-600">
        {bornLabel(p).replace(/^b/, 'B')}
        {p.archived && ' · archived'}
      </span>
    </>
  )
  return self ? (
    <div className="rounded-xl border-2 border-forest bg-forest-soft px-3 py-2 text-sm" aria-current="true">
      {body}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => onOpen(p)}
      className="block min-h-16 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-forest/50 hover:bg-ivory/60"
    >
      {body}
    </button>
  )
}

interface Props {
  person: Parishioner
  all: Parishioner[]
  byId: Map<string, Parishioner>
  sonas: DirectorySona[]
  onOpen: (p: Parishioner) => void
  onEdit: () => void
  onArchive: () => void
  onClose: () => void
}

export function ParishionerDetail({ person: p, all, byId, sonas, onOpen, onEdit, onArchive, onClose }: Props) {
  const father = p.fatherId ? byId.get(p.fatherId) : undefined
  const mother = p.motherId ? byId.get(p.motherId) : undefined
  const children = all
    .filter((x) => x.fatherId === p.id || x.motherId === p.id)
    .sort((a, b) => (a.dateOfBirth || '9999').localeCompare(b.dateOfBirth || '9999'))
  const siblings = all.filter((x) => x.id !== p.id && ((p.fatherId && x.fatherId === p.fatherId) || (p.motherId && x.motherId === p.motherId)))

  return (
    <article aria-labelledby="pp-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          {p.archived && (
            <p className="text-sm">
              <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-700">Archived</span>
            </p>
          )}
          <h2 id="pp-title" className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {fullName(p)}
          </h2>
          <p className="text-stone-700">{summary(p)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <Section title="Personal details">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {(
              [
                ['Full name', [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')],
                ['Sex', p.sex || 'Not recorded'],
                ['Date of birth', p.dateOfBirth ? longDate.format(new Date(`${p.dateOfBirth}T00:00:00`)) : 'Not recorded'],
                ['Place of birth', p.placeOfBirth || 'Not recorded'],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Contact and address">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {(
              [
                ['Contact number', p.contact || 'None'],
                ['Email', p.email || 'None'],
                ['Address', [p.street, p.barangay, p.city].filter(Boolean).join(', ') || 'Not recorded'],
                ['Sona', sonaName(sonas, p.sonaId) || 'Not recorded'],
                ['Chapel', chapelName(sonas, p.sonaId, p.chapelId) || 'Not recorded'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={k === 'Address' ? 'sm:col-span-2' : ''}>
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium break-words text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Sacramental records">
          {p.sacraments?.length ? (
            <ul className="space-y-2">
              {p.sacraments.map((s) => (
                <li key={s.recordId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/secretary/sacraments?${new URLSearchParams({ register: s.type.toLowerCase(), entry: s.recordId })}`)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-forest/50 hover:bg-ivory/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-stone-900">
                        {s.type}
                        {s.role === 'Recipient' ? '' : ` (${s.role.toLowerCase()})`}
                      </span>
                      <span className="block text-stone-600">
                        {s.date ? longDate.format(new Date(`${s.date}T00:00:00`)) : 'Date not recorded'} · Book {s.register.book}, page {s.register.page}, line{' '}
                        {s.register.line}
                      </span>
                    </span>
                    <Icon name="chevronRight" className="size-4.5 shrink-0 text-stone-400" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">No register entries name this parishioner yet.</p>
          )}
        </Section>

        {/* Parents above, this person in the middle, children below: the lineage the schema stores (father and mother links). */}
        <Section title="Family tree">
          <div className="space-y-3">
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-stone-600">Parents</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                <Person p={father} role="Father" onOpen={onOpen} />
                <Person p={mother} role="Mother" onOpen={onOpen} />
              </div>
            </div>
            <div className="ml-4 border-l-2 border-stone-200 pl-4">
              <Person p={p} role="This parishioner" onOpen={onOpen} self />
              {siblings.length > 0 && (
                <>
                  <h4 className="mt-3 mb-1.5 text-xs font-semibold text-stone-600">Siblings</h4>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {siblings.map((s) => (
                      <li key={s.id}>
                        <Person p={s} role={s.sex === 'Female' ? 'Sister' : 'Brother'} onOpen={onOpen} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="ml-8 border-l-2 border-stone-200 pl-4">
              <h4 className="mb-1.5 text-xs font-semibold text-stone-600">Children</h4>
              {children.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {children.map((c) => (
                    <li key={c.id}>
                      <Person p={c} role={c.sex === 'Female' ? 'Daughter' : 'Son'} onOpen={onOpen} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-600">No children linked to this record.</p>
              )}
            </div>
          </div>
        </Section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
        <button
          type="button"
          onClick={onArchive}
          className={
            p.archived
              ? btnSecondary
              : 'inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 font-semibold text-stone-700 hover:bg-stone-100'
          }
        >
          {p.archived ? 'Restore' : 'Archive'}
        </button>
        <button type="button" onClick={onEdit} className={btnPrimary}>
          <Icon name="pencil" className="size-4.5" />
          Edit
        </button>
      </div>
    </article>
  )
}
