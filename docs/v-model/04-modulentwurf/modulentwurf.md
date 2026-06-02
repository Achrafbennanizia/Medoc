# Phase 4: Modulentwurf

> **Stand der Implementierung:** Das **gebaute und in CI geprüfte Produkt** liegt unter `app/` (**Tauri + React/Vite**, IPC zu Rust/SQLite). Dieses Dokument beschreibt historisch den **Komponentenaufbau der Next.js-Referenzapp** im Verzeichnis `src/` (App Router, NextAuth, Prisma/PostgreSQL). Für UI-/Routing-Reviews des Desktop-Produkts siehe `app/src/App.tsx`, `app/src/views/` und die Controller unter `app/src/controllers/`.

## 1. Komponentenhierarchie

### 1.1 Layout-Modul

```
RootLayout
└── AuthProvider (NextAuth SessionProvider)
    ├── (auth)/login/page.tsx          → LoginForm
    └── (dashboard)/layout.tsx         → DashboardLayout
        ├── Sidebar
        │   ├── UserAvatar
        │   ├── NavItem[] (Terminübersicht, PatientenAkten, ...)
        │   └── LogoutButton
        ├── Header
        │   ├── Breadcrumbs
        │   ├── SearchBar
        │   └── NotificationBell
        └── {children}                 → Page Content
```

### 1.2 Termin-Modul

```
TerminePage
├── CalendarNavigation (Sekundäres Sidemenu)
│   ├── YearSelector
│   ├── MonthSelector
│   └── TodayButton
├── CalendarView
│   ├── DayView / WeekView / MonthView
│   ├── TerminCard (farbkodiert nach Art)
│   │   ├── PatientName
│   │   ├── Uhrzeit
│   │   ├── StatusBadge
│   │   └── ActionMenu (bearbeiten, löschen, Status ändern)
│   └── BlockedSlot (grau, nicht buchbar)
├── TerminFormDialog
│   ├── PatientSearch (Autocomplete)
│   ├── DatumPicker
│   ├── UhrzeitPicker
│   ├── ArtSelect (Untersuchung | Behandlung | Notfall)
│   ├── BeschwerdenInput (optional)
│   └── Actions: Speichern / Abbrechen
├── NotfallTerminDialog (vereinfacht, 3 Klicks)
├── ConfirmDeleteDialog
└── SuccessToast / ErrorToast
```

### 1.3 Patienten-Modul

```
PatientenPage
├── PatientenTable
│   ├── SearchInput (Fuzzy-Search)
│   ├── FilterBar (Status, Datum, Versicherung)
│   ├── SortableHeaders
│   ├── PatientRow[]
│   │   ├── Name + Geburtsdatum (Unterscheidung)
│   │   ├── Versicherungsnummer
│   │   ├── Status Badge
│   │   └── ActionMenu
│   └── Pagination
├── NeuPatientPage
│   ├── StammdatenForm (Pflichtfelder markiert)
│   │   ├── NameInput
│   │   ├── GeburtsdatumPicker
│   │   ├── GeschlechtSelect
│   │   ├── VersicherungInput
│   │   └── KontaktdatenGroup (Tel, Email, Adresse)
│   └── AnamnesebogenForm
│       ├── StandardFragen[]
│       ├── GesundheitsFragen[]
│       └── UnterschriftCheckbox

PatientenAktePage (/{id})
├── AkteHeader (Name, Status, Validierungs-Button)
├── TabNavigation
│   ├── Tab: Übersicht
│   ├── Tab: Untersuchungen
│   ├── Tab: Behandlungen
│   ├── Tab: Zahnschema
│   ├── Tab: Dokumente (Röntgen, PDFs)
│   ├── Tab: Zahlungen
│   └── Tab: Rezepte/Atteste
├── UntersuchungList + UntersuchungForm
├── BehandlungList + BehandlungForm
├── DentalChart (interaktives SVG)
├── DokumentUpload + DokumentList
├── ZahlungList + ZahlungForm
└── RezeptAttest + CreateDialog
```

### 1.4 Zahnschema-Modul

```
DentalChart
├── JawSVG (Oberkiefer + Unterkiefer)
│   └── ToothElement[] (32 Zähne, FDI-Nummerierung)
│       ├── onClick → ZahnDetailPanel
│       ├── fillColor (basiert auf Status)
│       └── Tooltip (Kurzinfo)
├── ZahnDetailPanel
│   ├── ZahnNummer
│   ├── BefundSelect (gesund, kariös, fehlend, ...)
│   ├── DiagnoseInput
│   ├── BehandlungSelect
│   └── NotizenTextarea
└── Legende (Farbkodierung)
```

### 1.5 Finanz-Modul

```
FinanzenLayout
├── FinanzNavigation (Zahlungen | Bilanz | Statistiken)

ZahlungenPage
├── ZahlungTable (DataTable)
├── ZahlungFormDialog
│   ├── PatientSearch
│   ├── BetragInput
│   ├── ZahlungsartSelect (Bar | Karte | Überweisung)
│   ├── StatusSelect
│   └── LeistungZuordnung
└── Tagesabschluss-Button

BilanzPage
├── ZeitraumFilter
├── BalkenDiagramm (Einnahmen vs. Ausgaben)
├── EinnahmenTable
└── AusgabenTable

StatistikenPage
├── ZeitraumFilter
├── KreisdiagrammLeistungen
├── LiniendiagrammVerlauf
└── ExportPDFButton
```

### 1.6 Shared Components

```
ConfirmDialog
├── Title
├── Description
├── Actions: "Abbrechen" (grau) | "Ja, löschen" (rot)

SuccessMessage
├── Icon (Checkmark)
├── Title ("Erfolgreich gespeichert")
└── AutoDismiss (3s)

ErrorMessage
├── Icon (Warning)
├── Title + Description
└── RetryAction (optional)

DataTable<T>
├── SearchInput
├── FilterBar
├── SortableColumnHeaders
├── Rows<T>
├── Pagination
└── EmptyState

FormField
├── Label (* für Pflicht)
├── Input / Select / DatePicker / Textarea
├── ValidationError
└── HelpText (optional)
```

---

## 2. Zustandsverwaltung

| Bereich | Methode | Grund |
|---------|---------|-------|
| Server-Daten | Server Components + Server Actions | Direkte DB-Abfragen, kein Client-State nötig |
| Formulare | React Hook Form + Zod | Validierung, Dirty-State, Submission |
| UI-State (Dialoge, Tabs) | React useState / useReducer | Lokaler UI-State |
| Auth/Session | NextAuth useSession() | Session-Daten global verfügbar |
| URL-State (Filter, Suche) | Next.js searchParams | Bookmarkbar, shareable |

---

## 3. Validierungs-Schemas (Zod)

### Patient

```typescript
const patientSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  geburtsdatum: z.date({ required_error: "Geburtsdatum erforderlich" }),
  geschlecht: z.enum(["MAENNLICH", "WEIBLICH", "DIVERS"]),
  versicherungsnummer: z.string().min(1, "Versicherungsnummer erforderlich"),
  telefon: z.string().optional(),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  adresse: z.string().optional(),
});
```

### Termin

```typescript
const terminSchema = z.object({
  datum: z.date({ required_error: "Datum erforderlich" }),
  uhrzeit: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  art: z.enum(["UNTERSUCHUNG", "BEHANDLUNG", "NOTFALL"]),
  patientId: z.string().uuid("Patient auswählen"),
  arztId: z.string().uuid("Arzt auswählen"),
  beschwerden: z.string().optional(),
});
```

---

## 4. Modultestkriterien (→ Phase 9)

| Test-ID | Modul | Testfall | Erwartung |
|---------|-------|----------|-----------|
| UT-01 | Patient Schema | Leerer Name | Validierungsfehler |
| UT-02 | Patient Schema | Gültiger Patient | Schema akzeptiert |
| UT-03 | Termin Schema | Doppelbuchung | Fehler bei Konfliktprüfung |
| UT-04 | RBAC | REZ versucht med. Schreiben | Zugriff verweigert |
| UT-05 | RBAC | ARZT hat vollen Zugriff | Zugriff gewährt |
| UT-06 | DentalChart | Klick auf Zahn 11 | Detail-Panel öffnet sich |
| UT-07 | DataTable | Suche "Müller" | Gefilterte Ergebnisse |
| UT-08 | ConfirmDialog | Bestätigung klicken | Callback ausgelöst |
| UT-09 | ZahlungForm | Negativer Betrag | Validierungsfehler |
| UT-10 | AuditLog | Action ausführen | Log-Eintrag erstellt |
