import { Icon } from '../../../components/ui/Icon'
import { requestSteps, type RequestStatus } from '../sampleData'

export function StatusStepper({ status }: { status: RequestStatus }) {
  const current = requestSteps.indexOf(status)

  return (
    <>
      <ol className="grid grid-cols-5" aria-label="Request progress">
        {requestSteps.map((step, i) => {
          const done = i < current || status === 'Completed'
          const active = i === current && status !== 'Completed'
          return (
            <li key={step} className="relative flex flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
              {i > 0 && (
                <span
                  className={`absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2 ${i <= current ? 'bg-forest' : 'bg-stone-200'}`}
                />
              )}
              <span
                className={`relative z-[1] grid size-6 place-items-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-forest text-white'
                    : active
                      ? 'bg-gold text-forest-dark ring-4 ring-gold-soft'
                      : 'border-2 border-stone-200 bg-white text-stone-400'
                }`}
              >
                {done ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`mt-2 hidden text-xs leading-tight sm:block ${active ? 'font-semibold text-stone-800' : 'text-stone-500'}`}
              >
                {step}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-center text-xs font-medium text-stone-600 sm:hidden">
        Step {current + 1} of {requestSteps.length}: {status}
      </p>
    </>
  )
}
