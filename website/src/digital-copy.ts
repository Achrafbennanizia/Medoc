import type { Lang } from "./i18n";
import { fr } from "./digital-copy-fr";
import { ar } from "./digital-copy-ar";
import { SRC } from "./digital-sources";

/**
 * Home ways/series/Morocco strip, the pilot invitation, and the Morocco and Europe pages.
 * Every figure and law comes from docs/brand/site-facts.md and carries its source.
 * Bill 52-26 is not law yet and is always labelled so. Morocco is the only market.
 */
type Src = { t: string; u: string };
/** A sourced Morocco fact for the #/morocco page. */
type Fact = { topic: string; status?: string; fig: string; text: string; src: Src };
type Item = { t: string; d: string };
/** Home "10 ways" card: number, title, true claim; optional edition line; Features section id. */
type Way = { k: string; t: string; d: string; ed?: string; to: string };
export type DigitalCopy = {
  sourceLabel: string;
  /** Series framing merged from sifralabs/medoc (level 2 → product home). */
  series: { kicker: string; title: string; lead: string; more: string; items: Item[] };
  /** Morocco figures strip on home; full detail on #/morocco. */
  moroccoStrip: { kicker: string; title: string; lead: string; more: string; items: { fig: string; label: string; src: Src }[] };
  /** Ten product benefits on the home page. Each maps to a Features section; claims from site-facts.md. */
  ways: { kicker: string; title: string; lead: string; more: string; items: Way[] };
  /** Home “why now” band — Bill 52-26 (not law yet) + link to #/morocco. */
  whyNow: { kicker: string; title: string; lead: string; cta: string };
  pilot: { kicker: string; title: string; text: string; points: string[]; cta: string };
  morocco: {
    facts: { kicker: string; title: string; lead: string; items: Fact[]; note: string };
    ready: { kicker: string; title: string; lead: string; items: Item[]; notYetTitle: string; notYet: string[]; cndp: string; cta: string };
  };
  /** Body of the Europe page; its head is in routes-copy (heads.europe). */
  europe: { text: string; cta: string };
};

const en: DigitalCopy = {
  sourceLabel: "Source",
  series: {
    kicker: "MeDoc series",
    title: "One family of practice programs",
    lead: "MeDoc Dentist is the first MeDoc product for sale. Every MeDoc program shares the same secure core, keeps data in the practice, and comes with people who help you leave paper.",
    more: "About the MeDoc series",
    items: [
      { t: "One secure core", d: "Encryption, roles, the audit log, sync, licences and backups are built once and shared." },
      { t: "One team", d: "The people who write MeDoc are the people who install it, train you and answer your questions." },
      { t: "Built for each specialty", d: "Each program follows one specialty. Dentists come first." },
      { t: "Sold only when ready", d: "We sell a MeDoc program only when it is ready for a real practice. No dates before then." },
    ],
  },
  moroccoStrip: {
    kicker: "Morocco",
    title: "Morocco is going digital. Practices need to be ready.",
    lead: "Cited figures about dental practices and Digital Morocco 2030. Full sources on the Morocco page.",
    more: "How MeDoc Dentist gets a practice ready",
    items: [
      { fig: "6,552", label: "Private dental practices in Morocco in 2025 (carte sanitaire).", src: SRC.dentists },
      { fig: "88%", label: "Of the population covered by compulsory health insurance (AMO) in 2025.", src: SRC.amo },
      { fig: "1.7 bn DH", label: "Public digital investment in 2024, up from 11 million DH in 2021.", src: SRC.digital2030 },
      { fig: "24 months", label: "Time facilities would have to connect if Bill 52-26 becomes law as filed (not law yet).", src: SRC.bill5226 },
    ],
  },
  ways: {
    kicker: "In the product today",
    title: "10 ways MeDoc Dentist makes the day easier",
    lead: "Ten things you can do in the current release. Each one opens the full feature with screens. Where only some editions include it, we say so.",
    more: "See all twelve features",
    items: [
      {
        k: "01",
        to: "changes",
        t: "Nothing enters the record without your OK",
        d: "Cabinet and Cabinet+: reception hands you a chart to validate or decline. Essentiel: guest appointments, patients and cash payments wait in your Inbox until you Add or Dismiss.",
        ed: "All editions · different hand-off",
      },
      {
        k: "02",
        to: "day-close",
        t: "Close the day with two numbers",
        d: "Enter the cash you counted and, if you use one, the card terminal total. MeDoc totals the day's bookings and asks for a reason before it accepts a mismatch.",
        ed: "Cabinet and Cabinet+",
      },
      {
        k: "03",
        to: "calendar",
        t: "Move an appointment with the mouse",
        d: "Drag to another time or day. MeDoc snaps to opening hours, shifts that doctor's next slots, refuses double bookings, and gives you Undo.",
      },
      {
        k: "04",
        to: "flags",
        t: "Catch mistakes while you work",
        d: "Double bookings and closed times are refused. A prescription is checked against recorded allergies before it goes out. The patient header shows what is still missing.",
      },
      {
        k: "05",
        to: "statistics",
        t: "Know how the month is going",
        d: "Patients, appointments, treatments and income from your own records, each with the change against last month. No invented targets.",
      },
      {
        k: "06",
        to: "patients",
        t: "The whole patient on one header",
        d: "Status, open invoice, age, phone, insurance, address and a mini tooth chart at once. Search by name, phone, e-mail or insurance number; misspellings get a suggestion.",
      },
      {
        k: "07",
        to: "tasks",
        t: "Send a task instead of interrupting reception",
        d: "From the patient's file, send work to the front desk or one person. It lands in their list and bell while you stay with the patient.",
        ed: "Cabinet and Cabinet+",
      },
      {
        k: "08",
        to: "status-rules",
        t: "Every record follows clear steps",
        d: "Appointments, patients, charts, payments and orders have fixed statuses and allowed next steps. MeDoc refuses a change that goes backwards.",
      },
      {
        k: "09",
        to: "backups",
        t: "A backup every day, signed and encrypted",
        d: "One automatic backup a day while MeDoc is open, compressed and encrypted (AES-256-GCM). Altered copies are flagged and cannot be restored.",
      },
      {
        k: "10",
        to: "tooth-chart",
        t: "A tooth chart you can read at a glance",
        d: "All 32 permanent teeth in FDI order, with distinct outlines and a colour for each status. Click a tooth, pick a finding, keep treating.",
      },
    ],
  },
  whyNow: {
    kicker: "Why now",
    title: "Bill 52-26 is coming. Is your practice ready?",
    lead: "The bill before Parliament (not law yet) would give every patient a shared medical record updated after each visit. Reports cite fines of up to 300,000 DH and 24 months for facilities to connect once the technical rules are published. Law 09-08 already asks for security and consent for health data.",
    cta: "How MeDoc Dentist gets a practice ready",
  },
  pilot: {
    kicker: "Pilot practices",
    title: "Write the first story with us",
    text: "MeDoc Dentist is opening to its first practices. Pilot practices get set-up help and a direct line to the people who build the software. In return we ask for honest feedback, which we will publish here, with their permission.",
    points: ["Set-up, data import and training included", "A direct line to the team that builds MeDoc Dentist", "Your feedback decides what we improve next"],
    cta: "Become a pilot practice",
  },
  morocco: {
    facts: {
      kicker: "What is changing",
      title: "The facts, with their sources",
      lead: "Laws, bills and figures as published. Bill 52-26 is not law yet, and we say so wherever it appears.",
      items: [
        { topic: "Dental practices", fig: "6,552", text: "private dental practices in Morocco in 2025, plus 458 dentists in the public sector, according to the Ministry of Health and Social Protection's carte sanitaire.", src: SRC.dentists },
        { topic: "Digital Morocco 2030", fig: "1.7 bn DH", text: "of public investment in digital in 2024, up from 11 million DH in 2021. The national strategy makes digital a driver of competitiveness and social inclusion.", src: SRC.digital2030 },
        { topic: "Health insurance (AMO)", fig: "32 million", text: "beneficiaries of compulsory health insurance in 2025, or 88% of the population, up from 42% before it was extended to all. More insured patients means more insurance numbers to record.", src: SRC.amo },
        { topic: "Bill 52-26", status: "Not law yet", fig: "Up to 300,000 DH", text: "fine reported for a professional who does not update a patient's shared medical record, or a facility that does not connect its system. Filed with Parliament on 31 July 2026, the bill plans one shared record per patient, updated after each consultation or act. Facilities would have 24 months to connect once the technical rules are published.", src: SRC.bill5226 },
        { topic: "Law 09-08 and the CNDP", status: "In force", fig: "Up to 200,000 DH", text: "fine, or 3 months to 1 year in prison, or both, for processing personal data without the security measures the law requires (art. 58). Health data is sensitive data; processing it without the patient's express consent carries a fine of 50,000 to 300,000 DH (art. 57).", src: SRC.law0908 },
        { topic: "CNSS breach, April 2025", fig: "Nearly 2 million", text: "people had their information exposed when more than 54,000 files were allegedly stolen from the National Social Security Fund, according to Moroccan media. Health and social data is a target in Morocco too.", src: SRC.cnss },
      ],
      note: "Figures as published by the linked sources. Bill 52-26 may still change before it becomes law.",
    },
    ready: {
      kicker: "MeDoc Dentist",
      title: "How MeDoc Dentist gets your practice ready",
      lead: "What is in the program today. Every point is in all three editions unless an edition is named.",
      items: [
        { t: "Encrypted on your own computers", d: "The whole database is encrypted with SQLCipher (AES-256), and the key stays in the computer's secure keychain. Patient data is not sent to a cloud." },
        { t: "Each person sees what their job needs", d: "Reception (Cabinet and Cabinet+) and the guest account (Essentiel) do not see diagnoses or clinical findings unless you allow it. The program enforces this, not only the screen." },
        { t: "A log that shows tampering", d: "Records created and changed, charts validated, exports and every chart read are logged. Each entry is chained to the one before with an HMAC, so an altered or deleted entry is detected." },
        { t: "Moroccan documents", d: "Invoices with your ICE, IF and TP (plus RC, CNSS and INPE), a gap-free number, the medical-act VAT exemption notice and the total in words, in French or Arabic. No invoice without ICE and IF. Prescriptions and certificates on your letterhead, with your INPE." },
        { t: "A backup every day", d: "Once a day, by itself: compressed and encrypted with AES-256-GCM, to a USB stick or external drive if you choose, X-rays and scans included. Every backup is signed, so an altered one cannot be restored." },
        { t: "Structured records", d: "Patients, insurance numbers, tooth chart, treatments, prescriptions and invoices are kept as structured data, not scanned paper. The record header flags what is missing, such as the insurance number." },
      ],
      notYetTitle: "Not in MeDoc Dentist today",
      notYet: [
        "Connection to the shared medical record of Bill 52-26: its technical rules are not published",
        "AMO, CNSS and CNOPS care sheets",
        "A built-in NGAP act list: you enter your own act codes",
        "Electronic prescriptions",
      ],
      cndp: "The declaration to the CNDP stays the practice's duty. The Premium service plan includes help with your CNDP file.",
      cta: "Book a free demo",
    },
  },
  europe: {
    text: "Today MeDoc Dentist is sold to dental practices in Morocco only, with Moroccan documents and prices in dirhams. Do you practise in Europe? Write to us about your practice.",
    cta: "Write to us",
  },
};

export const DIGITAL_COPY: Record<Lang, DigitalCopy> = { en, fr, ar };
