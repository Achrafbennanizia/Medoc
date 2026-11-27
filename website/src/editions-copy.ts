import type { Lang } from "./i18n";
import type { EditionId } from "./route";
import { fr } from "./editions-copy-fr";
import { ar } from "./editions-copy-ar";
import { ALL, PLUS, TEAM } from "./edition-sets";

/**
 * Copy for "#/editions", "#/editions/<edition>" and the home editions preview.
 * Limits follow config/editions.yaml. Every claim comes from docs/brand/site-facts.md; installation,
 * training and service months mirror prices.licenses in i18n.ts (keep the two in step).
 * A feature that is not in all three editions names its editions (`eds`, or the text itself).
 */
export const EDITION_NAME: Record<EditionId, string> = { essentiel: "Essentiel", cabinet: "Cabinet", "cabinet-plus": "Cabinet+" };

/** Hero photo of each edition article (public/photos). */
export const EDITION_PHOTO: Record<EditionId, string> = { essentiel: "dentist-computer", cabinet: "doctor-reception", "cabinet-plus": "dentists-screen" };


type Three<T> = [T, T, T];
type Item = { t: string; d: string };
type MarkRow = { t: string; d: string; marks: Three<boolean> };
type TextRow = { t: string; cells: Three<string> };

type Edition = {
  /** Who it is for, in one line. */
  forLine: string;
  /** Size in a few words, for the compact cards. */
  card: string;
  photoAlt: string;
  who: string;
  fits: string[];
  /** "Two to four dentists?" and the edition that answers it. */
  other: { q: string; id: EditionId };
  day: (Item & { eds: EditionId[] })[];
  included: string[];
  limits: string[];
  faq: { q: string; a: string }[];
  final: { title: string; text: string };
};

export type EditionsCopy = {
  ui: { every: string; only: string; and: string; yes: string; no: string; oneTime: string; demo: string; compare: string; kicker: string; see: string };
  page: { kicker: string; title: string; lead: string; unsure: string; compareTitle: string; compareLead: string; plans: string; plansLink: string };
  preview: { kicker: string; title: string; lead: string };
  article: {
    whoTitle: string;
    fitsTitle: string;
    dayTitle: string;
    dayMore: string;
    includedTitle: string;
    includedLead: string;
    plansLink: string;
    limitsTitle: string;
    limitsLead: string;
    faqTitle: string;
    othersTitle: string;
  };
  table: {
    caption: string;
    hint: string;
    corner: string;
    size: { t: string; rows: TextRow[] };
    team: { t: string; rows: MarkRow[] };
    doctors: { t: string; rows: MarkRow[] };
    service: { t: string; price: Item; rows: TextRow[] };
    common: { t: string; items: string[] };
    cta: string;
  };
  editions: Record<EditionId, Edition>;
};

const en: EditionsCopy = {
  ui: {
    every: "Every edition",
    only: "{x} only",
    and: " and ",
    yes: "Included",
    no: "Not included",
    oneTime: "one-time licence, excl. VAT",
    demo: "Book a free demo",
    compare: "Compare the editions",
    kicker: "MeDoc Dentist editions",
    see: "See {x}",
  },
  page: {
    kicker: "Editions",
    title: "Pick the edition that fits your practice",
    lead: "One program, three sizes. Every edition keeps your patient files encrypted on your own computers, works without internet and prints Moroccan documents. What changes is how many people and computers work with it.",
    unsure: "Not sure which one? We'll tell you in the demo.",
    compareTitle: "Compare every detail",
    compareLead: "Size, teamwork, several dentists, price and service, side by side.",
    plans: "After the included months, service plans start at {x} a month.",
    plansLink: "See prices and service plans",
  },
  preview: {
    kicker: "Editions",
    title: "Three editions of one program. Pick the size of your practice.",
    lead: "Every edition keeps your files encrypted on your own computers and works without internet. They differ in how many people and computers work with it.",
  },
  article: {
    whoTitle: "Who it is for",
    fitsTitle: "It fits if",
    dayTitle: "What changes in your day",
    dayMore: "See all features",
    includedTitle: "What's included",
    includedLead: "Paid once. The set-up and the first months of service come with it.",
    plansLink: "Service plans after the included months",
    limitsTitle: "Good to know",
    limitsLead: "What this edition does not do, so you decide with all the facts.",
    faqTitle: "Questions about {x}",
    othersTitle: "The other editions",
  },
  table: {
    caption: "MeDoc Dentist editions compared: Essentiel, Cabinet and Cabinet+",
    hint: "Scroll sideways to see all three editions.",
    corner: "What you get",
    size: {
      t: "Size of your practice",
      rows: [
        { t: "Computers", cells: ["1", "Up to 3", "Up to 5"] },
        { t: "Admin computers", cells: ["1", "1", "2"] },
        { t: "Sign-in accounts", cells: ["2: you and a guest", "3", "Up to 20"] },
        { t: "Dentists", cells: ["1", "1", "Up to 4"] },
      ],
    },
    team: {
      t: "Working with a team",
      rows: [
        { t: "Guest inbox", d: "What the guest enters waits for your OK", marks: [true, false, false] },
        { t: "Staff accounts and roles", d: "Reception does not see the medical chart by default", marks: [false, true, true] },
        { t: "Practice network", d: "The computers share one encrypted database", marks: [false, true, true] },
        { t: "Tasks to reception", d: "Sent from the patient's file, confirmed by the dentist", marks: [false, true, true] },
        { t: "Chart validation", d: "Reception sends a chart, the dentist validates or declines", marks: [false, true, true] },
        { t: "Day close and cash movements", d: "Count the drawer, record deposits and expenses", marks: [false, true, true] },
        { t: "Work time", d: "Your team's working hours", marks: [false, true, true] },
      ],
    },
    doctors: {
      t: "Several dentists",
      rows: [
        { t: "Dentists side by side", d: "Two to four agendas in the day view", marks: [false, false, true] },
        { t: "Second admin computer", d: "Keeps issuing invoice numbers while the main one is offline", marks: [false, false, true] },
        { t: "Sharing rules", d: "Each dentist decides what they share", marks: [false, false, true] },
        { t: "Statistics per dentist", d: "Comparison table and dentist filter", marks: [false, false, true] },
      ],
    },
    service: {
      t: "Price and service",
      price: { t: "Licence", d: "Paid once, excl. VAT" },
      rows: [
        { t: "Installation", cells: ["Remote", "On site, with data import", "On site, with data import"] },
        { t: "Training", cells: ["2 hours", "2 hours at your practice", "Two sessions"] },
        { t: "Service included", cells: ["3 months", "6 months", "12 months"] },
      ],
    },
    common: {
      t: "In every edition",
      items: [
        "Patient files and search",
        "Tooth chart",
        "Calendar with drag and drop",
        "Prescriptions and certificates",
        "Moroccan invoices in French or Arabic",
        "Payments, receipts and cash journal",
        "Statistics",
        "Encrypted database (AES-256)",
        "Automatic daily backups",
        "Works without internet",
      ],
    },
    cta: "Book a demo of {x}",
  },
  editions: {
    essentiel: {
      forLine: "For one dentist working alone, or with a helper who comes in now and then.",
      card: "1 computer · you and one guest account",
      photoAlt: "A dentist in scrubs and a face mask typing at a computer in his practice.",
      who: "Essentiel is MeDoc Dentist on one computer, for one dentist. Patient files, calendar, documents and payments sit in one encrypted place on your computer. Someone who helps you can sign in with the guest account, and nothing they enter reaches your records without your OK.",
      fits: ["You work alone, or with a temporary helper", "One computer is enough for your practice", "You want to leave paper without setting up a network"],
      other: { q: "Reception works on its own computer?", id: "cabinet" },
      day: [
        {
          t: "A helper, without the risk",
          d: "A temporary helper signs in as a guest. The appointments, patient details and cash payments they enter wait in your Inbox until you click Add or Dismiss.",
          eds: ["essentiel"],
        },
        {
          t: "Your day on one screen",
          d: "See the agenda by day, week or month and drag an appointment to a new time. MeDoc Dentist refuses double bookings and bookings in breaks or absences, and gives you Undo.",
          eds: ALL,
        },
        {
          t: "Any patient, with one search",
          d: "Search by name, phone, email or insurance number, with suggestions for a misspelled name. The record opens on one header that shows what is still missing.",
          eds: ALL,
        },
        {
          t: "Prescriptions that check allergies",
          d: "Before a prescription is saved, its active substance is checked against the allergies in the patient's medical history, and you confirm before it is issued anyway. It prints in French or Arabic on your letterhead, with your INPE.",
          eds: ALL,
        },
        {
          t: "Moroccan invoices, ready to hand over",
          d: "Each invoice carries your ICE, IF and TP, a gap-free number and the total in words, in French or Arabic. MeDoc Dentist will not issue one without your ICE and IF.",
          eds: ALL,
        },
        {
          t: "Backups you never have to remember",
          d: "Once a day MeDoc Dentist backs up the practice by itself, encrypted, X-rays included. Send the backups to a USB stick or an external drive. No internet needed.",
          eds: ALL,
        },
      ],
      included: ["Remote installation", "2 hours of training", "3 months of service included", "A licence that stays yours, with or without a service plan", "Security fixes free for the first 12 months"],
      limits: [
        "One computer. If reception needs its own computer, choose Cabinet or Cabinet+.",
        "No tasks, chart validation or day close: these come with Cabinet and Cabinet+.",
        "The guest can propose appointments, patient details and cash payments. Anything else is refused. For a change, you see the new values, not a before-and-after view.",
        "The guest does not see the clinical record unless you switch it on in Settings.",
        "The daily backup runs while MeDoc Dentist is open.",
        "Payments are cash, card or bank transfer. There is no cheque method.",
      ],
      faq: [
        {
          q: "What does the guest see?",
          a: "Appointments and patient details, not the clinical record, unless you allow it with a switch in Settings → Security → Guest. Whatever the guest enters waits in your Inbox.",
        },
        {
          q: "Does Essentiel need internet?",
          a: "No. Appointments, charts, invoices and backups work without a connection, and patient data is not sent to a cloud. Internet is only used for optional update checks.",
        },
        {
          q: "What happens after the 3 included months?",
          a: "You choose a service plan for updates and support, or none. The licence stays yours and keeps working, and security fixes stay free for the first 12 months.",
        },
      ],
      final: { title: "See Essentiel on your own day", text: "A free 30-minute demo, at your practice or by video. We use your appointments, your acts and your prices." },
    },
    cabinet: {
      forLine: "For one dentist with a reception desk, on up to 3 computers.",
      card: "Up to 3 computers · 3 accounts · 1 dentist",
      photoAlt: "A dentist in scrubs filling in a form at the reception desk.",
      who: "Cabinet is for a practice where reception and the treatment room each have a computer. Everyone signs in with their own account, the computers share one encrypted database over your network, and work passes between the desk and the chair inside the program, not on sticky notes.",
      fits: ["One dentist, with a receptionist or an assistant", "Reception and the treatment room each have a computer, up to 3 in all", "You want the cash drawer counted and the day closed every evening"],
      other: { q: "Two to four dentists?", id: "cabinet-plus" },
      day: [
        {
          t: "One record, on every computer",
          d: "Reception and the treatment room share one practice database over your own network, encrypted and with every change signed. A computer that loses the connection keeps working and catches up when it is back.",
          eds: TEAM,
        },
        {
          t: "Tasks instead of interruptions",
          d: "Send a task from the patient's file to reception, or to one named person. For billing, printing or patient data, reception marks it done with a note or a linked payment, and you confirm it or send it back with a reason.",
          eds: TEAM,
        },
        {
          t: "Charts that wait for your OK",
          d: "Reception sends you a patient's chart for review with a short note. It lands in your \"Records to validate\" list, with a count in the sidebar. You validate or decline it, and each step is logged.",
          eds: TEAM,
        },
        {
          t: "Reception sees what it needs",
          d: "Reception books, takes payments and files. By default it does not see diagnoses or clinical findings, and the program enforces this, not only the screen.",
          eds: TEAM,
        },
        {
          t: "A day close that adds up",
          d: "In the evening you count the drawer and enter the card terminal total. MeDoc Dentist works out what should be there and will not close the day on a difference unless you write down why. Deposits, withdrawals and cash expenses are recorded with a reason.",
          eds: TEAM,
        },
      ],
      included: ["On-site installation and data import", "2 hours of training at your practice", "6 months of service included", "A licence that stays yours, with or without a service plan", "Security fixes free for the first 12 months"],
      limits: [
        "One dentist account. For two to four dentists, choose Cabinet+.",
        "Up to 3 computers and 3 sign-in accounts in all.",
        "New tasks are picked up every 30 seconds, not instantly.",
        "The person who sent a chart for review is not notified when you validate or decline it.",
        "At day close you type the cash count and the card terminal total. Bank transfers appear as totals the program works out. There is no cheque payment method.",
      ],
      faq: [
        {
          q: "Can reception see the medical chart?",
          a: "Not by default. Diagnoses and clinical findings stay with the dentist, and the program enforces it. You can give one named person the right to read them if you choose.",
        },
        {
          q: "What if the network goes down?",
          a: "Each computer keeps working and catches up when the connection is back. Edits made on two computers at the same time go to the admin's conflict list instead of being lost.",
        },
        {
          q: "Can a second dentist work in Cabinet?",
          a: "No. Cabinet holds one dentist account. For two to four dentists, Cabinet+ adds a calendar column and statistics per dentist, and sharing rules.",
        },
      ],
      final: { title: "See Cabinet with your reception desk", text: "A free 30-minute demo, at your practice or by video. We walk through a real day, from the first appointment to the day close." },
    },
    "cabinet-plus": {
      forLine: "For practices with 2 to 4 dentists working together.",
      card: "Up to 5 computers · 20 accounts · 4 dentists",
      photoAlt: "Two dentists at a computer, looking at a dental scan on the screen.",
      who: "Cabinet+ is everything in Cabinet, for a practice where several dentists share the reception, the calendar and the cash desk. Each dentist keeps their own column and their own figures, and decides what they share.",
      fits: ["2 to 4 dentists work in the same practice", "You need up to 5 computers, 2 of them admin computers", "Dentists, reception and assistants need up to 20 sign-in accounts"],
      other: { q: "Only one dentist?", id: "cabinet" },
      day: [
        {
          t: "Every dentist's agenda, side by side",
          d: "In the day view, the agendas of two to four dentists sit next to each other, so reception sees who is free before booking.",
          eds: PLUS,
        },
        {
          t: "Figures per dentist",
          d: "Statistics break your activity down by dentist, with a comparison table and a dentist filter.",
          eds: PLUS,
        },
        {
          t: "Each dentist decides what they share",
          d: "Sharing rules set what each dentist shares with the others. A chart can be validated only by a dentist its owner allows.",
          eds: PLUS,
        },
        {
          t: "Documents signed by the right dentist",
          d: "Prescriptions and certificates carry the name of the dentist who issued them.",
          eds: PLUS,
        },
        {
          t: "Invoicing goes on when the main computer is off",
          d: "A second admin computer keeps issuing invoice numbers while the main one is offline.",
          eds: PLUS,
        },
        {
          t: "Everything in Cabinet",
          d: "One database on your network, tasks between dentists and reception, chart validation and the day close.",
          eds: TEAM,
        },
      ],
      included: ["On-site installation and data import", "Two training sessions", "12 months of service included", "A licence that stays yours, with or without a service plan", "Security fixes free for the first 12 months"],
      limits: [
        "Dragging an appointment into another dentist's column does not change the dentist. Open the appointment to change it.",
        "Dentists sit side by side in the day view only. The week view does not split by dentist.",
        "Tasks, finance and orders cannot be filtered by dentist yet.",
        "Per-record privacy covers appointments. Clinical entries, documents and tasks do not have it yet.",
        "The calendar has no chair or room columns.",
        "There is no cheque payment method.",
      ],
      faq: [
        {
          q: "How many dentists and computers does Cabinet+ hold?",
          a: "Up to 4 dentists and 20 sign-in accounts, on up to 5 computers, 2 of them admin computers.",
        },
        {
          q: "What if the main computer is off?",
          a: "The other computers keep working and catch up when it is back. Meanwhile, the second admin computer keeps issuing invoice numbers.",
        },
        {
          q: "Can I move an appointment to another dentist by dragging it?",
          a: "No. Dragging changes the date and time. To change the dentist, open the appointment and pick another one.",
        },
      ],
      final: { title: "See Cabinet+ with your whole team", text: "A free 30-minute demo, at your practice or by video. We walk through a real day with several dentists side by side." },
    },
  },
};

export const EDITIONS_COPY: Record<Lang, EditionsCopy> = { en, fr, ar };
