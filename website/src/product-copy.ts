import { shot } from "./product-shot";
// Copy for the Features page (#/features): the hero title and lead (read by FeaturesHero), the section
// nav, the twelve features and the bands between them. Every claim comes from docs/brand/site-facts.md;
// the bullet points under each feature live in product-points.ts.

/** The twelve features, in page order. Each id is also the section's anchor (#/features/<id>). */
export const FEATURE_IDS = [
  "changes",
  "day-close",
  "calendar",
  "flags",
  "statistics",
  "patients",
  "tasks",
  "orders",
  "shortcuts",
  "status-rules",
  "backups",
  "tooth-chart",
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

/** Editions that include a feature or a point: all three, Cabinet and Cabinet+, Cabinet+ only, Essentiel only. */
export type Ed = "all" | "cabinet" | "plus" | "essentiel";

export type Shot = { file: string; alt: string; caption: string };
export type Feature = { chip: string; ed: Ed; title: string; text: string; shots: Shot[] };

export type ProductCopy = {
  title: string;
  lead: string;
  nav: string;
  docsChip: string;
  ed: Record<Ed, string>;
  features: Record<FeatureId, Feature>;
  /** Shortcuts card: keys separated by spaces, each drawn as one key. */
  keys: { k: string; d: string }[];
  /** Backups card: what the retention keeps. */
  keep: { title: string; days: string; week: string; half: string; note: string };
  demo: { title: string; text: string; cta: string };
  editions: { title: string; text: string; price: (from: string) => string; cta: string };
  security: { title: string; text: string; cta: string };
};


export const productEn: ProductCopy = {
  title: "Twelve ways MeDoc Dentist makes your day easier.",
  lead: "Real screens with fictitious patients. Each feature says which editions include it: Essentiel, Cabinet or Cabinet+.",
  nav: "On this page",
  docsChip: "Moroccan documents",
  ed: { all: "All editions", cabinet: "Cabinet and Cabinet+", plus: "Cabinet+", essentiel: "Essentiel" },
  features: {
    changes: {
      chip: "Validation and log",
      ed: "all",
      title: "Keep an eye on what your team enters.",
      text: "Charts wait for your validation, a helper's entries wait for your OK, and a log you can check shows who did what, and when.",
      shots: [
        shot("charts-to-validate", "List of charts to validate, in draft or in review, each with Validate and Decline", "Cabinet and Cabinet+: charts waiting for you, each with Validate and Decline."),
        shot("settings-security", "Security settings with the audit log and device sessions", "The activity log opens from Settings, Security."),
      ],
    },
    "day-close": {
      chip: "Daily close",
      ed: "cabinet",
      title: "Close the day with two numbers.",
      text: "Type the cash you counted and your card terminal's total. MeDoc works out what should be there from the day's bookings and shows any difference.",
      shots: [shot("cash-entries", "New payment form with the amount in MAD and the payment method", "Each payment is booked with its method as it comes in. The day close adds them up for you.")],
    },
    calendar: {
      chip: "Drag-and-drop calendar",
      ed: "all",
      title: "Move an appointment with the mouse. MeDoc makes room.",
      text: "Drag an appointment to another time or day in the day or week view. MeDoc snaps it to your opening hours, pushes that doctor's next appointments back, and gives you Undo.",
      shots: [
        shot("calendar-drag", "Week view while an appointment is dragged to a new time", "In the week view, the old place fades and the new time shows in the margin."),
        shot("calendar-day", "Day view with each appointment's status", "The day view, with each appointment's status and a summary of the day."),
      ],
    },
    flags: {
      chip: "Conflicts flagged",
      ed: "all",
      title: "Catch mistakes while you work, not after.",
      text: "MeDoc checks each entry as you make it. It refuses a double booking, warns you about a drug the patient is allergic to, and shows what is still missing.",
      shots: [shot("appointment-new", "New appointment form with unavailable times greyed out", "Opening hours and conflicts are checked while you pick a time.")],
    },
    statistics: {
      chip: "Statistics",
      ed: "all",
      title: "Know how the month is going, in real figures.",
      text: "Patients, new patients, appointments, treatments and income per month, over 6 or 12 months. Each key figure shows its change against last month.",
      shots: [shot("analytics", "Statistics overview with each figure's change against last month", "Each key figure with its change against last month.")],
    },
    patients: {
      chip: "Patient overview",
      ed: "all",
      title: "The whole patient on one header.",
      text: "Open a record and see status, open invoice, age, phone, insurance and address at once, with a small tooth chart and the basics still missing.",
      shots: [shot("patient-record", "Patient record with status, open invoice, contact details and a small tooth chart", "Status, open invoice, contact, insurance and a small tooth chart on one header.")],
    },
    tasks: {
      chip: "Tasks for reception",
      ed: "cabinet",
      title: "Send a task instead of interrupting reception.",
      text: "From the patient's file, send a task to the whole front desk or to one person. It lands in their task list and notification bell, and you go back to your patient.",
      shots: [shot("practice-tasks", "Practice task list with patient, type and status", "Every task with its patient, type and status, in one list.")],
    },
    orders: {
      chip: "Orders and spending",
      ed: "all",
      title: "Supplies and spending at a glance.",
      text: "Order from your suppliers with saved templates and follow each order from open to in transit to delivered. The dashboard puts open and late orders in front of you.",
      shots: [
        shot("orders", "Supplier orders with status, expected date and price", "Open, in transit, late or delivered, with the expected date and price."),
        shot("overview", "Dashboard with items waiting for validation and orders to check", "The dashboard shows late orders to check."),
      ],
    },
    shortcuts: {
      chip: "Keyboard shortcuts",
      ed: "all",
      title: "Keep your hands on the keyboard.",
      text: "Press ⌘K to jump to any page or start something new. The most common actions have their own keys. On Windows, use Ctrl instead of ⌘.",
      shots: [],
    },
    "status-rules": {
      chip: "Status rules",
      ed: "all",
      title: "Every record follows clear steps. Nothing slips backwards.",
      text: "Appointments, patients, charts, payments and orders each have a fixed set of statuses and allowed next steps. MeDoc refuses changes out of order.",
      shots: [shot("appointment-detail", "Appointment panel with its steps: planned, confirmed, in progress, completed", "The appointment shows where it stands and offers the next allowed step.")],
    },
    backups: {
      chip: "Backups",
      ed: "all",
      title: "A backup every day, without anyone having to remember.",
      text: "MeDoc Dentist backs up the practice once a day by itself, compressed and encrypted with AES-256-GCM. Send it to a USB stick or an external drive, X-rays and scans included.",
      shots: [],
    },
    "tooth-chart": {
      chip: "Tooth chart",
      ed: "all",
      title: "A tooth chart you can read at a glance.",
      text: "All 32 permanent teeth in FDI order along a curved arch, with distinct outlines for incisors, canines, premolars and molars. Each status has its own colour and mark.",
      shots: [shot("examinations", "Examination with the tooth chart and its colour legend", "Caries in red, planned work dashed: each status has its own colour and mark.")],
    },
  },
  keys: [
    { k: "⌘ K", d: "Go to any page or new form" },
    { k: "⌘ N", d: "New appointment" },
    { k: "⇧ ⌘ N", d: "New patient" },
    { k: "G", d: "Then a letter: go straight to a section" },
    { k: "D W M", d: "Calendar: day, week or month view" },
    { k: "T", d: "Calendar: jump to today" },
    { k: "N", d: "Calendar: book an appointment" },
    { k: "← →", d: "Calendar: page through time" },
    { k: "⌘ /", d: "Every shortcut, in Help" },
  ],
  keep: {
    title: "What MeDoc keeps",
    days: "The last 3 days",
    week: "One from last week",
    half: "One from the last half-year",
    note: "Older backups are deleted automatically, so the disk never fills up.",
  },
  demo: {
    title: "See it working before you decide.",
    text: "In a free demo we walk you through the calendar, the checks and the day close, and answer your questions.",
    cta: "Book a free demo",
  },
  editions: {
    title: "Which edition fits your practice?",
    text: "Essentiel for one dentist on one computer. Cabinet for a dentist with reception, on up to 3 computers. Cabinet+ for up to 4 dentists and 5 computers.",
    price: (from) => `Licence from ${from} excl. VAT, bought once.`,
    cta: "Compare editions",
  },
  security: {
    title: "How MeDoc Dentist protects patient data",
    text: "Encryption on disk, separate roles and the audit chain are explained on the Security page.",
    cta: "Read the Security page",
  },
};

