import { useEffect } from 'react'
import { Link } from './components/Link'
import { PageBanner } from './components/ui/PageBanner'
import { btnPrimary } from './components/ui/styles'
import { InquiryProvider } from './features/parishioner/inquiries/InquiryProvider'
import { useInquiry } from './features/parishioner/inquiries/inquiryContext'
import { ToastProvider } from './components/toast/ToastProvider'
import { PortalProvider } from './features/parishioner/PortalProvider'
import ParishionerChapelsPage from './pages/ChapelsPage'
import { ParishionerLayout } from './layouts/ParishionerLayout'
import { navigate, useLocation } from './lib/router'
import { ProfileSettings } from './features/account/ProfileSettings'
import { AuthProvider } from './features/auth/AuthProvider'
import { CommunityLayout } from './layouts/CommunityLayout'
import { PpcLayout } from './layouts/PpcLayout'
import { PriestLayout } from './layouts/PriestLayout'
import { StaffLayout } from './layouts/StaffLayout'
import { RequireRole } from './features/auth/RequireRole'
import AdminComingSoon from './pages/admin/AdminComingSoon'
import AdminDashboard from './pages/admin/AdminDashboard'
import AiSettingsPage from './pages/admin/AiSettingsPage'
import AuditLogsPage from './pages/admin/AuditLogsPage'
import BackupPage from './pages/admin/BackupPage'
import UsersPage from './pages/admin/UsersPage'
import AiSearchPage from './pages/priest/AiSearchPage'
import ApprovalsPage from './pages/priest/ApprovalsPage'
import PriestComingSoon from './pages/priest/PriestComingSoon'
import PriestEventApprovalsPage from './pages/priest/EventApprovalsPage'
import ReportsPage from './pages/priest/ReportsPage'
import SacramentalReviewPage from './pages/priest/SacramentalReviewPage'
import StaffComingSoon from './pages/staff/StaffComingSoon'
import StaffDashboard from './pages/staff/StaffDashboard'
import RecordRequestsPage from './pages/staff/RecordRequestsPage'
import ParishionersPage from './pages/staff/ParishionersPage'
import SacramentalRecordsPage from './pages/staff/SacramentalRecordsPage'
import DocumentsPage from './pages/staff/DocumentsPage'
import StaffAppointmentsPage from './pages/staff/AppointmentsPage'
import CommunityChapelsPage from './pages/community/ChapelsPage'
import CommunityEventsPage from './pages/community/EventsPage'
import ChapelApprovalsPage from './pages/ppc/ChapelApprovalsPage'
import EventApprovalsPage from './pages/ppc/EventApprovalsPage'
import StaffAnnouncementsPage from './pages/staff/AnnouncementsPage'
import StaffAiSearchPage from './pages/staff/AiSearchPage'
import StaffReportsPage from './pages/staff/ReportsPage'
import StaffOfferingsPage from './pages/staff/OfferingsPage'
import StaffSettingsPage from './pages/staff/SettingsPage'
import PriestDashboard from './pages/priest/PriestDashboard'
import AppointmentsPage from './pages/AppointmentsPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import NewRequestPage from './pages/NewRequestPage'
import ParishionerHome from './pages/ParishionerHome'
import RequestsPage from './pages/RequestsPage'
import TrackPage from './pages/TrackPage'

function adminPage(pathname: string) {
  switch (pathname) {
    case '/admin/dashboard':
      return <AdminDashboard />
    case '/admin/users':
      return <UsersPage />
    case '/admin/settings/logs':
      return <AuditLogsPage />
    case '/admin/settings/backup':
      return <BackupPage />
    case '/admin/settings/ai-config':
      return <AiSettingsPage />
    default:
      return <AdminComingSoon href={pathname} />
  }
}

// Pages from when parishioners had accounts. Request detail links held an internal id, not a reference number.
const retiredParishionerPages = ['/register', '/parishioner/profile', '/parishioner/notifications']

// Client-side routing. The admin, staff, and priest portals sit behind
// RequireRole; the API's role middleware protects the data itself. The
// public site needs no sign-in.
function Routes() {
  const { pathname } = useLocation()
  const { setOpen: setChatOpen } = useInquiry()

  useEffect(() => {
    // The public home page moved from /parishioner/home to /home.
    if (pathname === '/' || pathname === '/parishioner' || pathname === '/parishioner/home' || retiredParishionerPages.includes(pathname))
      navigate(`/home${window.location.hash}`, { replace: true })
    if (pathname.startsWith('/parishioner/requests/') && pathname !== '/parishioner/requests/new') navigate('/track', { replace: true })
    // Roles & Permissions was removed from the admin portal; old links land on the dashboard.
    if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/roles') navigate('/admin/dashboard', { replace: true })
    if (pathname === '/priest' || pathname === '/priest/') navigate('/priest/dashboard', { replace: true })
    // The staff portal is now the secretary portal; bookmarks and old notice links follow it.
    if (pathname === '/staff' || pathname.startsWith('/staff/'))
      navigate(`/secretary${pathname.slice('/staff'.length)}${window.location.search}${window.location.hash}`, { replace: true })
    if (pathname === '/secretary' || pathname === '/secretary/') navigate('/secretary/dashboard', { replace: true })
    // Chapels & Officers moved to the GKK and PYA-KKK portal.
    if (pathname === '/secretary/chapels') navigate('/secretary/dashboard', { replace: true })
    if (pathname.startsWith('/community') && !['/community/events', '/community/chapels', '/community/profile'].includes(pathname))
      navigate('/community/events', { replace: true })
    if (pathname.startsWith('/ppc') && !['/ppc/events', '/ppc/chapels', '/ppc/profile'].includes(pathname)) navigate('/ppc/events', { replace: true })
    // Parish Inquiries is an overlay now; the old route opens it over Home.
    if (pathname === '/parishioner/inquire') {
      setChatOpen(true)
      navigate('/home', { replace: true })
    }
  }, [pathname, setChatOpen])

  const tracked = pathname.match(/^\/track\/([^/]+)$/)

  // Admin portal: only signed-in System Administrators (the API enforces the same rule).
  if (pathname.startsWith('/admin'))
    return (
      <RequireRole roles={['admin']}>
        <ToastProvider>{adminPage(pathname)}</ToastProvider>
      </RequireRole>
    )
  if (pathname.startsWith('/secretary'))
    return (
      <RequireRole roles={['secretary']}>
        <ToastProvider>
          {pathname === '/secretary/dashboard' ? (
            <StaffDashboard />
          ) : pathname === '/secretary/requests' ? (
            <RecordRequestsPage />
          ) : pathname === '/secretary/parishioners' ? (
            <ParishionersPage />
          ) : pathname === '/secretary/sacraments' ? (
            <SacramentalRecordsPage />
          ) : pathname === '/secretary/documents' ? (
            <DocumentsPage />
          ) : pathname === '/secretary/appointments' ? (
            <StaffAppointmentsPage />
          ) : pathname === '/secretary/announcements' ? (
            <StaffAnnouncementsPage />
          ) : pathname === '/secretary/ai-search' ? (
            <StaffAiSearchPage />
          ) : pathname === '/secretary/offerings' ? (
            <StaffOfferingsPage />
          ) : pathname === '/secretary/reports' ? (
            <StaffReportsPage />
          ) : pathname === '/secretary/settings' ? (
            <StaffSettingsPage />
          ) : pathname === '/secretary/profile' ? (
            <ProfileSettings layout={StaffLayout} path="/secretary/profile" />
          ) : (
            <StaffComingSoon href={pathname} />
          )}
        </ToastProvider>
      </RequireRole>
    )
  // GKK and PYA-KKK Officers share one portal.
  if (pathname.startsWith('/community'))
    return (
      <RequireRole roles={['gkk', 'pya-kkk']}>
        <ToastProvider>
          {pathname === '/community/chapels' ? (
            <CommunityChapelsPage />
          ) : pathname === '/community/profile' ? (
            <ProfileSettings layout={CommunityLayout} path="/community/profile" />
          ) : (
            <CommunityEventsPage />
          )}
        </ToastProvider>
      </RequireRole>
    )
  if (pathname.startsWith('/ppc'))
    return (
      <RequireRole roles={['ppc']}>
        <ToastProvider>
          {pathname === '/ppc/chapels' ? (
            <ChapelApprovalsPage />
          ) : pathname === '/ppc/profile' ? (
            <ProfileSettings layout={PpcLayout} path="/ppc/profile" />
          ) : (
            <EventApprovalsPage />
          )}
        </ToastProvider>
      </RequireRole>
    )
  if (pathname.startsWith('/priest'))
    return (
      <RequireRole roles={['priest']}>
        <ToastProvider>
          {pathname === '/priest/dashboard' ? (
            <PriestDashboard />
          ) : pathname === '/priest/records/verify' ? (
            <ApprovalsPage />
          ) : pathname === '/priest/records/sacramental' ? (
            <SacramentalReviewPage />
          ) : pathname === '/priest/events' ? (
            <PriestEventApprovalsPage />
          ) : pathname === '/priest/reports' ? (
            <ReportsPage />
          ) : pathname === '/priest/ai-search' ? (
            <AiSearchPage />
          ) : pathname === '/priest/profile' ? (
            <ProfileSettings layout={PriestLayout} path="/priest/profile" />
          ) : (
            <PriestComingSoon href={pathname} />
          )}
        </ToastProvider>
      </RequireRole>
    )
  switch (pathname) {
    case '/':
    case '/parishioner':
    case '/home':
    case '/parishioner/home':
    case '/parishioner/inquire':
    case '/parishioner/notifications':
    case '/parishioner/profile':
    case '/register':
      return <ParishionerHome />
    case '/login':
      return <LoginPage />
    case '/reset-password':
      return <ResetPasswordPage />
    case '/forgot-password':
      return <ForgotPasswordPage />
    case '/parishioner/requests':
      return <RequestsPage />
    case '/parishioner/requests/new':
      return <NewRequestPage />
    case '/parishioner/appointments':
      return <AppointmentsPage />
    case '/parishioner/chapels':
      return <ParishionerChapelsPage />
    case '/track':
      return <TrackPage />
  }

  if (tracked) return <TrackPage reference={decodeURIComponent(tracked[1])} />
  if (pathname.startsWith('/parishioner/requests/')) return <TrackPage />

  return (
    <ParishionerLayout activeHref="" hero={<PageBanner title="Page not found" />}>
      <p className="text-stone-600">That page doesn’t exist.</p>
      <Link href="/home" className={`${btnPrimary} mt-6`}>
        Go to Home
      </Link>
    </ParishionerLayout>
  )
}

function App() {
  return (
    <AuthProvider>
      <PortalProvider>
        <InquiryProvider>
          <Routes />
        </InquiryProvider>
      </PortalProvider>
    </AuthProvider>
  )
}

export default App
