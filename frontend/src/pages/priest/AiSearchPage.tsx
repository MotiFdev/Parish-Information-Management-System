import { AiSearchView } from '../../features/aiSearch/AiSearchView'
import { PriestLayout } from '../../layouts/PriestLayout'

const PATH = '/priest/ai-search'

// Results open in Sacramental Review, read-only, where any correction waiting can be decided.
export default function AiSearchPage() {
  return (
    <PriestLayout activeHref={PATH}>
      <AiSearchView base="/api/priest/ai-search" path={PATH} entryHref={(e) => `/priest/records/sacramental?register=${e.type.toLowerCase()}&entry=${e.id}`} />
    </PriestLayout>
  )
}
