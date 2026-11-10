import { AiSearchView } from '../../features/aiSearch/AiSearchView'
import { StaffLayout } from '../../layouts/StaffLayout'

const PATH = '/secretary/ai-search'

export default function StaffAiSearchPage() {
  return (
    <StaffLayout activeHref={PATH}>
      <AiSearchView base="/api/secretary/ai-search" path={PATH} entryHref={(e) => `/secretary/sacraments?register=${e.type.toLowerCase()}&entry=${e.id}`} />
    </StaffLayout>
  )
}
