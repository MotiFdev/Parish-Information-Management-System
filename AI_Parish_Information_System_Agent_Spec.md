# AI-Assisted Parish Information Management System
## System Flow, Navigation, and AI-Agent Implementation Specification

> **Purpose:** This document is the implementation reference for AI coding agents working on the AI-Assisted Parish Information Management System. Follow the defined user roles, routes, workflows, statuses, form fields, security requirements, database relationships, and technology stack. Do not silently replace or remove specified behavior. If an implementation detail is missing or contradictory, preserve existing project conventions and ask for clarification rather than inventing a new workflow.

---

## 1. Product Overview

The system manages parishioners, sacramental records, record requests, appointments and events, chapel and Sona information, announcements, notifications, reports, AI-assisted record search, auditing, backups, and administration.

### Core user roles

1. **System Administrator**
2. **Parish Priest**
3. **Parish Staff**
4. **Parishioner**

### Main operating principles

- Use one shared login page and redirect users to the appropriate portal after the server verifies their role.
- Enforce authorization on the backend, not only by hiding frontend navigation.
- Parishioners can view and manage only their own requests and related information.
- Sacramental registers are restricted to authorized parish staff and the priest.
- A certificate may be released only after staff verification and priest approval.
- Record status changes, document verification, corrections, and releases must be auditable.
- Record-request and appointment forms require recorded privacy consent.
- Keep uploaded documents private and serve them through short-lived signed URLs.
- Use the existing project structure and conventions when implementing this specification.

---

## 2. Authentication and Portal Routing

### Login flow

1. User opens `/login`.
2. User enters username/email and password.
3. The system authenticates the credentials.
4. The server resolves the user's role.
5. The system redirects to the matching dashboard.

| Role | Portal landing route |
|---|---|
| System Administrator | `/admin/dashboard` |
| Parish Priest | `/priest/dashboard` |
| Parish Staff | `/staff/dashboard` |
| Parishioner | `/parishioner/home` |

### Authentication requirements

- The login page includes username/email, password, and a **Forgot Password** link.
- Use Laravel Sanctum for SPA authentication with HttpOnly cookies when the deployment domains permit cookie sharing.
- Do not store authentication state in JavaScript memory or local storage when cookie-based authentication is available.
- Protect routes and API endpoints according to role and permission.
- Unauthorized users must not access another role's portal by manually entering a URL.
- The exact forgot-password workflow is not specified in the source specification; use the project's existing implementation or request clarification before designing a new one.

---

## 3. Record Request Workflow

Record types:
- Baptism
- Confirmation
- Marriage
- Burial

Request types:
- **New Registration:** Create a new sacramental register entry only after verification, and only if the sacrament is not already recorded.
- **Certificate Request:** Find an existing register entry and issue a certificate. Do not create a new register entry.
- **Record Correction:** Flag an existing entry for correction. Staff applies the change, the priest approves it, and the audit log records old and new values.

### Main workflow

```text
Parishioner selects record type
        |
        v
Parishioner selects request type and completes the matching form
        |
        v
Parishioner uploads applicable supporting documents and accepts privacy consent
        |
        v
Request submitted: PENDING
        |
        v
Staff checks register book/page/line and verifies each document
        |
        +---- Additional requirements needed ----> Notify parishioner
        |                                          Parishioner re-uploads documents
        |                                          Staff continues verification
        |
        v
UNDER VERIFICATION
        |
        v
Staff marks the request verified and sends it to the priest
        |
        v
Priest reviews certificate request or correction
        |
        +---- Reject ----> REJECTED (reason required; notify parishioner)
        |
        v
Approved (priest digitally signs when applicable)
        |
        v
Staff releases certificate according to parish procedure
        |
        v
READY FOR COLLECTION
        |
        v
Staff marks request completed
        |
        v
COMPLETED
```

### Statuses

The source specification defines these request statuses:

- `Pending`
- `Under Verification`
- `Approved`
- `Rejected`
- `Ready for Collection`
- `Completed`

Do not invent additional persisted statuses without checking the existing implementation. Document-level verification is separate and uses:

- `Pending`
- `Verified`
- `Rejected`
- `Needs Resubmission`

### Staff verification requirements

For each request, staff must be able to:

- View client details and subject details.
- View uploaded documents and their individual verification statuses.
- Look up the sacramental register using book, page, and line.
- Add remarks or request additional requirements.
- Start verification.
- Request additional documents.
- Mark the request verified and send it to the priest.
- Create a register entry for **New Registration only**.
- Mark an approved request ready for collection.
- Mark the request completed after release.

### Priest approval requirements

- The priest sees requests that staff have verified.
- The queue displays record type, request type, staff remarks, and document verification results.
- The priest can digitally sign and approve or reject.
- A rejection requires a reason.
- Record Correction requests must show old and proposed new values side by side.
- Record approval/rejection and certificate release must be written to the audit log.

### Notifications

Send in-app and email notifications for status changes and additional requirements. Notify the parishioner about release notices as well. Notifications should link to the relevant request when applicable.

### Marriage preparation exception

New marriage preparation, including canonical requirements such as a certificate of freedom to marry, is a separate flow under **Appointments → Wedding Pre-interview**. Do not merge this appointment workflow into the sacramental record-request workflow.

---

## 4. Portal Navigation and Routes

Keep route paths exactly as listed unless the project already has an explicitly approved route mapping.

### 4.1 System Administrator Portal

| Navigation item | Route | Required content and actions |
|---|---|---|
| Dashboard | `/admin/dashboard` | System health cards (CPU/RAM and API latency), active sessions, security alert widget, quick actions for manual backup and user creation |
| User Management | `/admin/users` | Accounts table with name, email, role, status; search; role filter; Add New User modal; Edit, Reset Password, Deactivate actions |
| Roles & Permissions | `/admin/roles` | Role cards and Read/Write/Delete permission matrix per module; include Record Requests, Chapels & Officers, and Notifications |
| Audit Logs | `/admin/settings/logs` | Filterable activity log with timestamp, IP, and changed fields; CSV/JSON export; include request status changes, document verification, and certificate release |
| Backup & Recovery | `/admin/settings/backup` | Relational DB and Vector DB backup status; Trigger Immediate Backup; restore-point selector |
| AI Engine Settings | `/admin/settings/ai-config` | Similarity threshold sliders, embedding model selector, Re-index All Records |

### 4.2 Parish Priest Portal

| Navigation item | Route | Required content and actions |
|---|---|---|
| Dashboard & Analytics | `/priest/dashboard` | Total Parishioners, Sacraments Issued, Monthly Mass Bookings, sacramental trend charts, and Requests Awaiting Approval card |
| Sacramental Review | `/priest/records/sacramental` | Baptism, Confirmation, Marriage, and Burial register tabs; read-only detail and scanned register documents |
| Certificate Approvals | `/priest/records/verify` | Staff-verified request queue; record type, request type, remarks, document results; Verify & Sign modal with signature preview; Approve / Reject (reason required); correction old/new comparison |
| Reports & Analytics | `/priest/reports` | Demographic, Sacramental, and Financial report generator; live preview; Print; PDF and CSV export |
| AI Record Search | `/priest/ai-search` | Natural-language search; ranked results, confidence scores, and highlights |

### 4.3 Parish Staff Portal

| Navigation item | Route | Required content and actions |
|---|---|---|
| Dashboard | `/staff/dashboard` | Parishioners, Sacramental Records, Pending Requests, Upcoming Events, AI Record Search, recent activity; Pending Requests split into Pending and Under Verification |
| Parishioners | `/staff/parishioners` | Searchable/filterable/paginated directory; Add Parishioner form including personal details and family tree; View, Edit, Archive; address includes Sona and Chapel |
| Record Requests | `/staff/requests` | Filter by record type, request type, status, and date; request detail, uploaded documents, register lookup (book/page/line), remarks, and workflow actions |
| Sacramental Records | `/staff/sacraments` | Baptism, Confirmation, Marriage, and Burial sub-tabs; form fields defined in this document; book/page/line index; Generate Certificate preview modal |
| Documents | `/staff/documents` | File manager for scanned registers and uploads; drag-and-drop uploader; record-linking dropdown |
| Appointments & Events | `/staff/appointments` | Month/Week/Day calendar; filters by Sona, Chapel, and Event Type; request queue with venue, chapel, intention, preferred/alternate schedule; Approve, Reject, Reschedule, Assign Priest or Staff; show chapel president contact for chapel events |
| Chapels & Officers | `/staff/chapels` | Sona and chapel directory; patron, fiesta date, president, contact, Facebook account name; chapel officer list by position and ministry; Add/Edit chapel; import officer list from spreadsheet |
| Announcements | `/staff/announcements` | Notice list with status badges; rich-text editor; scheduled publishing |
| AI Record Search | `/staff/ai-search` | Search history, filters, result cards with similarity scores |
| Reports | `/staff/reports` | Daily Log, Sacramental Count Summary, Request Turnaround Report, Appointments by Chapel; PDF/CSV export |
| Settings | `/staff/settings` | Profile, notification preferences, system defaults |

### 4.4 Parishioner Portal (web and responsive mobile drawer)

| Navigation item | Route | Required content and actions |
|---|---|---|
| Home / Overview | `/parishioner/home` | Bulletin feed, Mass schedules, status tracker for ongoing requests and appointments |
| Record Requests | `/parishioner/requests` | Request history and live status; New Request flow; request details, staff remarks, additional requirements, and rejected-document re-upload |
| New Record Request | `/parishioner/requests/new?type=baptism` (also `confirmation`, `marriage`, `burial`) | Open the correct record-type form based on `type` query parameter |
| Request Detail | `/parishioner/requests/:id` | Show request status, staff remarks, additional requirements, and document re-upload when needed |
| Book Appointment | `/parishioner/appointments` | Booking form with interactive date/time slots reflecting parish or chapel availability |
| Notifications | `/parishioner/notifications` | Status updates, additional-requirement notices, release notices |
| Parish Inquiries | `/parishioner/inquire` | Chat-like natural-language interface for schedules, requirements, and FAQs |
| My Profile & Settings | `/parishioner/profile` | Contact details, address with Sona and Chapel, email, password update, notification preferences |

### Parishioner request selection order

1. Open Record Requests.
2. Click New Request.
3. Select record type.
4. Select request type.
5. Complete the matching form.
6. Upload applicable documents.
7. Accept privacy consent.
8. Submit and receive the request reference number/status.

---

## 5. Record Request Forms

### 5.1 Common fields (all record types)

- Record Request Number — generated automatically.
- Request Date — generated automatically.
- Client Full Name — prefilled from the signed-in profile.
- Relationship to Subject — Self, parent, spouse, child, relative, authorized representative.
- Contact Number, Email Address, Complete Address — prefilled and editable.
- Parish — parish where the record is held.
- Record Type — Baptism, Confirmation, Marriage, Burial.
- Request Type — New Registration, Certificate Request, Record Correction.
- Request Purpose — Personal copy, marriage requirement, legal purpose, other.
- Supporting Documents — uploads when applicable.
- Privacy Consent — required checkbox before submission.
- Request Status — set by the system/staff.
- Remarks — staff instructions or notes.

### 5.2 Baptism form

Capture:

- Full name of baptized person.
- Date and place of birth.
- Sex.
- Date and place/church of baptism.
- Father's full name.
- Mother's full name, including maiden name.
- Godfather and godmother names.
- Purpose.
- Supporting documents, such as birth certificate.

For an existing-record request, prioritize the baptized person's name, date of birth, parents' names, approximate baptism date, and church.

### 5.3 Confirmation form

Capture:

- Full name.
- Date and place of birth.
- Father's and mother's names.
- Date and place of confirmation (actual or approximate).
- Bishop or minister, if known.
- Sponsor.
- Baptismal parish and baptism date.
- Supporting documents, such as baptismal certificate.

### 5.4 Marriage form

Capture:

- Groom's and bride's full names; bride's name includes maiden name.
- Each person's date and place of birth.
- Each person's parents' names.
- Date and place of marriage.
- Presiding priest.
- Marriage license number.
- Civil marriage details.
- Witnesses or sponsors.
- Each person's baptismal parish.
- Supporting documents, such as valid IDs.

For an existing-record request, prioritize both spouses' names, marriage date, and church.

### 5.5 Burial / Funeral form

Capture:

- Full name of deceased.
- Date of birth, if known.
- Date of death.
- Age at death.
- Sex.
- Place of death.
- Cause of death only if required by the parish; optional otherwise.
- Civil status.
- Spouse's name.
- Parents' names, if known.
- Date of funeral Mass.
- Date and place of burial.
- Church that conducted the funeral.
- Officiating priest.
- Informant's full name, relationship to deceased, contact number, and address.
- Supporting documents, such as death certificate and burial permit.

**Important:** Store the informant's details separately from the deceased's details.

---

## 6. Appointment and Event Booking Flow

### Event types

- Mass Intention
- House Blessing
- Wedding Pre-interview
- General Counseling (the list is extendable)

### Appointment form fields

**Event**
- Event Type.
- Event Title — suggested from event type, but editable.

**Requester**
- Full Name, Contact Number, Email — prefilled from profile.
- Address (Street, Barangay, City) — prefilled; used to suggest Sona and Chapel.

**Venue**
- Venue Type: Parish Church, Chapel, or Client's Home.
- Sona dropdown — shown for Chapel and Home venues.
- Chapel dropdown — filtered by selected Sona; shown for Chapel, or used to tag the nearest chapel for Home.
- House Address — required when venue type is Home.

**Schedule**
- Preferred Date and Time — selected from availability.
- Alternate Date and Time — optional second choice.

**Details**
- Intention Details for Mass Intention: Thanksgiving, Souls of the Departed, Healing, Special Intention, plus the name(s) of the person(s).
- Number of Attendees — optional.
- Notes — free text.

**Wedding Pre-interview only**
- Groom's and Bride's Full Names.
- Contact Numbers.

**Consent**
- Privacy Consent — required.

### Appointment submission and staff workflow

1. Parishioner chooses an event and completes the form.
2. The system checks the availability selector and records preferred/optional alternate schedules.
3. The parishioner accepts privacy consent and submits.
4. Status becomes `Pending`.
5. Staff can Approve, Reject, or Reschedule.
6. The client is notified of the status change.
7. For chapel events, display the chapel president's contact so staff can coordinate.

The source specification notes that the exact appointment changes were not fully specified; the fields above are based on the Sona and chapel/officer lists. Avoid inventing additional appointment rules without confirmation.

---

## 7. Sacramental Records and Database Rules

The source specification describes PostgreSQL with `pgvector`. Use the schema below as a functional reference and check the existing migrations before making changes. Some source table types use `JSONB`, UUIDs, and timestamps.

### 7.1 `parishioners` additions

- `sex VARCHAR(20) NOT NULL` — recorded sex; retain alongside existing `gender` only if parish policy requires both.
- `chapel_id INT NULL` — FK to `chapels.chapel_id`.
- `email VARCHAR(150) NULL` — contact email for parishioners without accounts.

### 7.2 `sacramental_records` additions

- `event_place VARCHAR(200) NOT NULL` — parish/church where the sacrament took place.
- `source_request_id UUID NULL` — FK to `record_requests.request_id`; request that produced the entry, for New Registration.
- `is_corrected BOOLEAN DEFAULT false` — true if a correction was applied.

### 7.3 `appointments_and_events` additions

- `venue_type VARCHAR(30) NOT NULL` — Parish Church, Chapel, Home.
- `sona_id INT NULL` — FK to `sonas.sona_id`.
- `chapel_id INT NULL` — FK to `chapels.chapel_id`.
- `house_address VARCHAR(250) NULL` — required for Home venue.
- `requester_name VARCHAR(200) NOT NULL`.
- `requester_contact VARCHAR(20) NOT NULL`.
- `requester_email VARCHAR(150) NULL`.
- `alt_start TIMESTAMP NULL`.
- `alt_end TIMESTAMP NULL`.
- `intention_category VARCHAR(50) NULL` — Thanksgiving, Souls, Healing, Special.
- `intention_details TEXT NULL`.
- `attendee_count INT NULL`.
- `event_details JSONB NULL` — type-specific details such as bride/groom details.
- `privacy_consent BOOLEAN NOT NULL`.
- `staff_remarks TEXT NULL`.

### 7.4 `record_requests` (replaces `certificate_requests`)

| Column | Type / constraint | Meaning |
|---|---|---|
| `request_id` | UUID, PK | Unique request ID |
| `request_number` | VARCHAR(30), UNIQUE, NOT NULL | Auto-generated reference number |
| `requested_by_user_id` | UUID, FK to `users.user_id` | Submitting client |
| `record_type_id` | INT, FK to `sacrament_types.sacrament_type_id` | Baptism, Confirmation, Marriage, Burial |
| `request_type` | VARCHAR(30), NOT NULL | New Registration, Certificate Request, Record Correction |
| `relationship_to_subject` | VARCHAR(50), NOT NULL | Relationship of client to subject |
| `client_full_name` | VARCHAR(200), NOT NULL | Submitting person |
| `client_contact_number` | VARCHAR(20), NOT NULL | Follow-up number |
| `client_email` | VARCHAR(150), NOT NULL | Notification email |
| `client_address` | VARCHAR(300), NOT NULL | Current address |
| `parish` | VARCHAR(150), NOT NULL | Parish holding the record |
| `purpose` | TEXT, NOT NULL | Request purpose |
| `subject_details` | JSONB, NOT NULL | Record-type-specific subject/couple/informant data |
| `record_id` | UUID, nullable FK to `sacramental_records.record_id` | Linked entry once found or created |
| `privacy_consent` | BOOLEAN, NOT NULL | Must be true |
| `status` | VARCHAR(30), default `Pending` | Request workflow status |
| `verified_by_staff_id` | UUID, nullable FK to `users.user_id` | Staff who verified |
| `approved_by_priest_id` | UUID, nullable FK to `users.user_id` | Priest who signed/rejected |
| `remarks` | TEXT, nullable | Staff notes or rejection reason |
| `requested_at` | TIMESTAMP, default current timestamp | Submission time |
| `updated_at` | TIMESTAMP, default current timestamp | Last update |

### 7.5 `request_documents`

- `request_document_id UUID PK`
- `request_id UUID FK → record_requests.request_id`
- `document_id UUID FK → documents.document_id`
- `document_label VARCHAR(100) NOT NULL` — Valid ID, Birth Certificate, Baptismal Certificate, Death Certificate, Burial Permit, Other.
- `verification_status VARCHAR(30) DEFAULT 'Pending'` — Pending, Verified, Rejected, Needs Resubmission.
- `verified_by_user_id UUID NULL FK → users.user_id`
- `verified_at TIMESTAMP NULL`

### 7.6 `sacramental_record_details`

One row per sacramental register entry, keyed by `record_id` as PK and FK to `sacramental_records.record_id`. It contains type-specific fields:

- `baptism_date DATE NULL`
- `baptismal_parish VARCHAR(200) NULL`
- `spouse_baptismal_parish VARCHAR(200) NULL` — Marriage only
- `license_number VARCHAR(50) NULL` — Marriage only
- `civil_marriage_date DATE NULL` — Marriage only
- `civil_marriage_place VARCHAR(200) NULL` — Marriage only
- `date_of_death DATE NULL` — Burial only
- `age_at_death INT NULL` — Burial only
- `place_of_death VARCHAR(200) NULL` — Burial only
- `cause_of_death VARCHAR(200) NULL` — optional, Burial only
- `civil_status VARCHAR(30) NULL` — Burial only
- `spouse_name VARCHAR(200) NULL` — Burial only
- `funeral_mass_date DATE NULL` — Burial only
- `burial_place VARCHAR(200) NULL` — Burial only
- `informant_name VARCHAR(200) NULL` — Burial only
- `informant_relationship VARCHAR(50) NULL` — Burial only
- `informant_contact VARCHAR(20) NULL` — Burial only
- `informant_address VARCHAR(300) NULL` — Burial only

### 7.7 `notifications`

- `notification_id UUID PK`
- `user_id UUID FK → users.user_id` — recipient
- `request_id UUID NULL FK → record_requests.request_id`
- `appointment_id UUID NULL FK → appointments_and_events.appointment_id`
- `message TEXT NOT NULL`
- `channel VARCHAR(20) DEFAULT 'in_app'` — `in_app` or `email`
- `is_read BOOLEAN DEFAULT false`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### 7.8 `sonas`

- `sona_id INT PK AUTO_INCREMENT`
- `name VARCHAR(100) NOT NULL UNIQUE`

Example Sona names in the source specification include Birhen sa Fatima, Birhen sa Carmen, San Isidro Labrador, San Ignacio de Loyola, San Antonio de Padua, and Inahan sa Kanunay'ng Panabang. Treat these as examples, not as an exhaustive hard-coded list.

### 7.9 `chapels`

- `chapel_id INT PK AUTO_INCREMENT`
- `sona_id INT FK → sonas.sona_id`
- `name VARCHAR(100) NOT NULL`
- `patron VARCHAR(100) NULL`
- `fiesta_date VARCHAR(50) NULL` — free text because dates can be recurring descriptions.
- `contact_number VARCHAR(20) NULL`
- `fb_account_name VARCHAR(100) NULL`
- `is_active BOOLEAN DEFAULT true`

### 7.10 `chapel_officers`

- `officer_id UUID PK`
- `chapel_id INT FK → chapels.chapel_id`
- `parishioner_id UUID NULL FK → parishioners.parishioner_id`
- `name VARCHAR(150) NOT NULL`
- `position VARCHAR(100) NOT NULL` — examples: President, V-President, Secretary, Treasurer, Auditor, Coordinator, Member.
- `ministry VARCHAR(100) NULL` — examples: Worship, Evangelization, Social Services, Temporalities, Organizing, Youth/Vocation.
- `age INT NULL`
- `fb_account VARCHAR(100) NULL`
- `contact_number VARCHAR(20) NULL`
- `term_year INT NOT NULL`

### Database implementation cautions

- The specification says PostgreSQL with `pgvector`, while some sample descriptions use `AUTO_INCREMENT`, a convention associated with other database engines. For PostgreSQL migrations, use the project's existing PostgreSQL-compatible identity/sequence conventions instead of copying `AUTO_INCREMENT` literally.
- Check existing migrations and relationships before altering tables. The source says existing columns are retained where it says “all existing columns kept, plus”.
- The source refers to existing tables such as `users`, `roles`, `sacrament_types`, `sacramental_records`, `documents`, `record_embeddings`, `sacramental_sponsors`, `audit_logs`, and `appointments_and_events`; do not assume every existing column is fully specified here.

---

## 8. Entity Relationships

Preserve these relationships from the source specification:

- `roles.role_id` → `users.role_id`: one role to many users.
- `users.user_id` → `parishioners.user_id`: optional one-to-one.
- `parishioners.parishioner_id` → `parishioners.father_parishioner_id` / `mother_parishioner_id`: self-referential family lineage.
- `sacrament_types.sacrament_type_id` → `sacramental_records.sacrament_type_id`: one type to many records.
- `parishioners.parishioner_id` → `sacramental_records.primary_parishioner_id` and `secondary_parishioner_id`: one parishioner can be linked to many records as primary or secondary person.
- `sacramental_records.record_id` → `sacramental_sponsors.record_id`: one record to many sponsors.
- `sacramental_records.record_id` → `sacramental_record_details.record_id`: one-to-one.
- Records/parishioners → `documents`: one-to-many, using the applicable record/parishioner reference.
- Records/parishioners → `record_embeddings`: one-to-many, using the applicable record/parishioner reference.
- `users.user_id` → `record_requests.requested_by_user_id`: one user to many requests.
- `record_requests.request_id` → `request_documents.request_id`: one request to many document links.
- `sacramental_records.record_id` → `record_requests.record_id`: one sacramental record may be linked to multiple requests.
- `users.user_id` → `notifications.user_id`: one user to many notifications.
- `users.user_id` → `appointments_and_events.requested_by_user_id`: one user to many appointments.
- `sonas.sona_id` → `chapels.sona_id`: one Sona to many chapels.
- `chapels.chapel_id` → `appointments_and_events.chapel_id`: one chapel to many appointments.
- `chapels.chapel_id` → `parishioners.chapel_id`: one chapel to many parishioners.
- `chapels.chapel_id` → `chapel_officers.chapel_id`: one chapel to many officers.
- `users.user_id` → `audit_logs.user_id`: one user to many audit logs.

---

## 9. AI-Assisted Record Search

### Staff and priest search interfaces

- Priest route: `/priest/ai-search`.
- Staff route: `/staff/ai-search`.
- Administrator configuration route: `/admin/settings/ai-config`.

### Required behavior

- Support natural-language search over sacramental records.
- Return ranked results with similarity scores or confidence scores and relevant highlights.
- Staff search includes history and filters.
- Priest search shows ranked results, confidence scores, and highlights.
- Administrator can adjust the similarity threshold, select the embedding model, and trigger re-indexing.
- The database stack includes PostgreSQL with `pgvector`.
- AI/NLP uses an external API, for example OpenAI, for embeddings and generation.

### Privacy constraints

- Search must follow the same role permissions as direct record access.
- AI search must not reveal records to parishioners or other users who are not authorized to access them.
- Avoid exposing private sacramental data in logs or client-side debug output.
- Do not invent an AI model, threshold default, or ranking formula if it is not already defined in the project.

---

## 10. Security, Privacy, and Auditability

These are functional requirements, not optional visual enhancements.

1. **Role-based access:** only authorized staff and the priest can access sacramental register entries; parishioners see only their own requests.
2. **Private file storage:** store uploaded documents privately in AWS S3 and serve them using short-lived signed URLs.
3. **Approval gate:** release certificates only after staff verification and priest approval.
4. **Consent:** record privacy consent for each record request and appointment.
5. **Audit trail:** write every request status change, document verification, correction, and certificate release to `audit_logs`.
6. **Correction history:** retain old and new values in the audit trail for record corrections.
7. **Audit review:** provide activity, timestamp, IP, changed fields, filters, and CSV/JSON export to authorized administrators.
8. **Notifications:** status and additional-requirement notifications must be delivered through the configured in-app/email channels.
9. **Data privacy:** comply with Philippine data privacy requirements and applicable diocesan policies.
10. **Backend enforcement:** validate permissions, ownership, status transitions, and required consent on the server/API; frontend controls are not security boundaries.

---

## 11. Technology Stack

Use this stack as specified unless the existing repository contains a confirmed, approved change:

- **Backend:** Laravel REST API.
- **Frontend:** React + TypeScript (`.tsx`) + Tailwind CSS.
- **Database:** PostgreSQL with `pgvector`.
- **AI/NLP:** external API for embeddings and generation (e.g., OpenAI).
- **File storage:** AWS S3, private objects with short-lived signed URLs.
- **Authentication:** Laravel Sanctum SPA authentication with HttpOnly cookies when domain configuration permits cookie sharing.

Do not switch frameworks, database engines, authentication patterns, or storage providers as part of an unrelated feature.

---

## 12. Implementation Rules for AI Coding Agents

Before making changes:

1. Inspect the repository structure, package manifests, routes, controllers, models, migrations, middleware, and existing UI components.
2. Identify which requirements are already implemented and which are missing.
3. Reuse existing patterns and components rather than creating duplicate implementations.
4. Preserve existing behavior unless the requested task explicitly changes it.
5. Treat this file as the intended system flow and route reference.
6. Implement both frontend and backend behavior when a feature requires data persistence, authorization, validation, or status changes.
7. Add or update migrations, validation, authorization policies, API responses, notifications, and audit entries where required.
8. Keep role-specific navigation separate, but use a shared authentication entry point.
9. Do not rely on frontend-only authorization.
10. Do not create mock data as a substitute for a requested API/database integration unless explicitly asked for a prototype.
11. Keep responsive layouts for the Parishioner portal, including its mobile navigation drawer.
12. Preserve the defined route paths and status labels.
13. Avoid deleting database columns or changing relationships without checking existing migrations and dependent code.
14. Do not silently invent missing business rules. Flag unresolved decisions clearly.
15. After implementation, run available tests, type checks, linting, and build commands. Report what was run and any failures honestly.

### Suggested feature implementation sequence

```text
Repository inspection
    |
    v
Authentication and role-based route protection
    |
    v
Core parishioner and sacramental record models
    |
    v
Record request forms and private document uploads
    |
    v
Staff verification workflow
    |
    v
Priest approval and certificate release workflow
    |
    v
Notifications and audit logs
    |
    v
Appointments, Sonas, chapels, and officers
    |
    v
Reports, announcements, and portal dashboards
    |
    v
AI search, embeddings, backup/recovery, and admin settings
    |
    v
Automated tests, authorization review, and end-to-end verification
```

This sequence is a suggested implementation order, not a requirement to rewrite existing working modules.

---

## 13. Unspecified or Ambiguous Details

Do not present these as settled requirements without inspecting the existing code or asking for a decision:

- Exact forgot-password/reset-password workflow.
- Exact appointment availability rules, slot duration, conflict handling, and approval policies.
- Exact default AI similarity threshold, embedding model, and ranking algorithm.
- Exact database columns not listed in the specification.
- Exact signature provider and certificate-signing mechanism.
- Exact backup schedule, retention policy, and restore procedure.
- Whether a `Rejected` request can be resubmitted as the same request or requires a new request.
- Whether all certificate requests require priest approval; the workflow describes priest approval for certificate requests and corrections, and release after approval.
- The source specifies PostgreSQL/`pgvector` but includes `AUTO_INCREMENT` in sample schema notes. Use PostgreSQL-compatible migration syntax.
- Appointment form changes were marked as based on the chapel/officer lists because the exact changes were not fully specified.

When a task depends on one of these points, first search the repository for an existing decision. If none exists, ask a concise clarification rather than adding an irreversible assumption.

---

## 14. Acceptance Checklist

A feature is not complete merely because its screen looks correct. Verify relevant items below:

- [ ] Login authenticates and redirects to the correct role dashboard.
- [ ] Backend rejects unauthorized role access and cross-user request access.
- [ ] Parishioner can create a request using the selected record type and request type.
- [ ] Privacy consent is required and persisted.
- [ ] Supporting documents are private and individually verifiable.
- [ ] Staff can locate a register entry by book/page/line and request additional requirements.
- [ ] Only New Registration can create a new sacramental entry through the request workflow.
- [ ] Priest approval/rejection is restricted to authorized priest accounts.
- [ ] Rejection reason is captured.
- [ ] Certificate release is blocked until the required verification and approval are complete.
- [ ] Status changes and sensitive actions generate audit entries.
- [ ] Parishioner receives relevant in-app/email notifications.
- [ ] Record Correction records old and new values in the audit log.
- [ ] Appointment forms conditionally show Sona, Chapel, Home address, and Wedding Pre-interview fields as specified.
- [ ] Chapel dropdown is filtered by selected Sona.
- [ ] Reports and exports are restricted by role.
- [ ] AI search respects record-level authorization.
- [ ] PostgreSQL migrations match the project's actual database engine.
- [ ] Existing tests, build, and type checks pass, or failures are reported clearly.

---

## 15. Source Reference

This Markdown file is derived from the provided **AI-Assisted Parish Information Management System - System Flow & Navigation Specification** PDF (9 pages). If the repository's implemented behavior differs from this document, inspect the code and migration history, then identify the discrepancy explicitly rather than silently assuming either is correct.


# color pallete to use

Color	         Hex code 	Website usage
Forest Green	#31583A	Sidebar, navigation, primary buttons
Liturgical Gold	#D4A638	Highlights, icons, important statistics
Church Brown	#8B5E34	Secondary accents
Warm Ivory	#F4EDE0	Main page background
White	        #FFFFFF	Cards, tables, forms, modals