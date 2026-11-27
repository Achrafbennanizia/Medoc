import { productEn } from "./product-copy";
import { fr } from "./i18n-fr";
import { ar } from "./i18n-ar";

export type Lang = "fr" | "ar" | "en";
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "fr", label: "FR", name: "Français" },
  { id: "ar", label: "ع", name: "العربية" },
  { id: "en", label: "EN", name: "English" },
];
/** Number and date formats: Morocco for French and Arabic; English keeps a day-month-year date. */
export const LOCALE: Record<Lang, string> = { fr: "fr-MA", ar: "ar-MA", en: "en-GB" };

export type Status = "healthy" | "caries" | "filling" | "crown" | "missing" | "implant";

const en = {
  meta: {
    title: "Dental practice software in Morocco · MeDoc Dentist",
    description:
      "Patient files, odontogram, appointments, prescriptions and payments for dental practices. Encrypted on your own computers, works offline, in French, Arabic and English.",
  },
  nav: {
    demo: "Book a demo",
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
    language: "Language",
    menu: "Menu",
    skip: "Skip to content",
  },
  hero: {
    kicker: "MeDoc Dentist · first of the MeDoc series",
    title: "Dental software that keeps your patient files in your practice.",
    lead: "Charts, odontogram, appointments, prescriptions and payments in one place. Encrypted on your own computers, so it keeps working when the internet doesn't. Built for Moroccan dental practices, with people who help you leave paper.",
    ctaDemo: "Book a free demo",
    ctaPrices: "See prices",
    facts: [
      { k: "Offline", v: "Works without internet" },
      { k: "Encrypted", v: "Database encrypted (AES-256) on your computers" },
      { k: "FR · AR · EN", v: "French, Arabic and English, Arabic right to left" },
    ],
    chartTitle: "Odontogram",
    chartPatient: "Salma B., 34 years",
    chartHint: "Select a tooth to see its record.",
    upper: "Upper jaw",
    lower: "Lower jaw",
    tooth: "Tooth",
    lastVisit: "Last visit",
    next: "Next step",
  },
  status: {
    healthy: "Healthy",
    caries: "Caries",
    filling: "Filling",
    crown: "Crown",
    missing: "Missing",
    implant: "Implant",
  } as Record<Status, string>,
  notes: {
    healthy: "No finding recorded.",
    caries: "Occlusal caries, to treat.",
    filling: "Composite filling, sound.",
    crown: "Ceramic crown, checked.",
    missing: "Extracted. Implant to discuss.",
    implant: "Implant in place, crown fitted.",
  } as Record<Status, string>,
  nextStep: {
    healthy: "Check-up in 6 months",
    caries: "Filling, 30 min",
    filling: "Check-up in 6 months",
    crown: "Check-up in 12 months",
    missing: "Treatment plan and quote",
    implant: "Check-up in 12 months",
  } as Record<Status, string>,
  setups: {
    title: "Your data stays where you work",
    lead: "No server to rent and no patient data in someone else's cloud. With Essentiel, everything runs on one computer. In Cabinet and Cabinet+, the main computer holds the records and the other screens connect to it; a paired laptop is a replica that keeps its own copy, works offline and catches up on your network.",
    items: [
      { title: "One computer", who: "A single chair · every edition", text: "MeDoc Dentist and the encrypted database live on one computer. Nothing has to be online." },
      { title: "Practice network", who: "Reception and treatment rooms · Cabinet and Cabinet+", text: "One main computer holds the records. The other screens connect over your own encrypted network." },
      { title: "Paired laptop", who: "Two sites or home · Cabinet and Cabinet+", text: "The laptop is a replica. It keeps an encrypted copy, works away from the master, and catches up when they share a network." },
    ],
    main: "Main computer",
    screen: "Screen",
    laptop: "Laptop",
  },
  morocco: {
    title: "Made for practices in Morocco",
    lead: "French and Arabic from day one. The Moroccan paperwork is being added with our pilot practices, and we say clearly what is ready.",
    nowTitle: "Available now",
    now: [
      "French and Arabic interface, right-to-left layout",
      "Prices and documents in dirhams (MAD)",
      "Tooth chart in FDI order",
      "Prescriptions and certificates on your letterhead",
      "Moroccan invoice in French or Arabic: ICE, IF, TP, RC, CNSS, INPE, amount in words, VAT-exemption note (CGI art. 91)",
      "Patient export and erasure, audit trail: tools for your Loi 09-08 duties",
      "Works through internet cuts",
    ],
    soonTitle: "In preparation",
    soon: [
      "Dental care sheets for AMO, CNSS, CNOPS and mutual insurers, with NGAP codes",
      "DGI e-invoicing",
    ],
    soonBadge: "Coming",
  },
  prices: {
    title: "One license. A service plan you choose.",
    lead: "You buy the software once and it stays yours. A monthly service plan, if you want one, covers updates and support.",
    ht: "Prices excl. VAT; 20% VAT is added in Morocco. The licence can be paid in 3 instalments.",
    oneTime: "one-time",
    perMonth: "/ month",
    recommended: "Typical for a practice with reception",
    choose: "Ask for a quote",
    licenses: [
      { id: "essentiel", name: "Essentiel", desc: "For a single-chair practice.", items: ["1 computer", "You plus one guest account: what the guest enters waits in your inbox until you add it", "Remote installation", "2 h of training", "3 months of service included"] },
      { id: "cabinet", name: "Cabinet", desc: "Reception plus treatment rooms.", items: ["Up to 3 computers on your network", "3 accounts, one of them the dentist", "Tasks, chart validation and day close", "On-site installation and data import", "2 h of training on site", "6 months of service included"] },
      { id: "cabinet-plus", name: "Cabinet+", desc: "For several dentists working together.", items: ["Up to 5 computers, 2 of them admin computers", "Up to 20 accounts and up to 4 dentists", "Everything in Cabinet", "On-site installation and data import", "Two training sessions", "12 months of service included"] },
    ],
    plansTitle: "Service plans, after the included period",
    plans: [
      { id: "security", name: "Sécurité", items: ["Security and legal updates", "Help centre"] },
      { id: "comfort", name: "Confort", items: ["Everything in Sécurité", "New features", "Phone and WhatsApp support, office hours", "Monthly backup check"] },
      { id: "premium", name: "Premium", items: ["Everything in Confort", "Reply within 4 business hours", "Yearly visit and staff training", "Help with your CNDP file"] },
    ],
  },
  faq: {
    title: "Questions dentists ask us",
    items: [
      { q: "Where are my patients' files stored?", a: "On your practice computers, in a database encrypted with AES-256. We don't host your patient data. Our support team only sees it if you share your screen for a support session." },
      { q: "What happens if the internet goes down?", a: "The work goes on: the schedule, the records and the till are on your computers and your practice network. Only updates and remote support wait for the internet to come back." },
      { q: "Can I move my data from my current software or from Excel?", a: "Yes. We import patients and appointments from Excel/CSV. From another dental program, we quote after looking at an export. The import is included in the Cabinet and Cabinet+ licences." },
      { q: "Does MeDoc Dentist help with Loi 09-08 and the CNDP?", a: "MeDoc Dentist gives you the tools: encryption, separate roles, an audit trail, and patient export and erasure. The CNDP formalities remain the practice's duty; the Premium plan includes help with your file." },
      { q: "What if I stop the service plan?", a: "The license is yours for good and keeps working. Without a plan you no longer receive updates or support. Security fixes stay free for the first 12 months." },
      { q: "Is MeDoc Dentist a medical device?", a: "No. MeDoc Dentist is administration and documentation software for licensed dental staff. It does not make diagnoses or treatment decisions." },
      { q: "Which computers do I need?", a: "Windows 10 or newer, macOS 12 or newer, or Ubuntu 22.04. 8 GB of memory is recommended." },
    ],
  },
  contact: {
    title: "See MeDoc Dentist on your own cases",
    lead: "A 30-minute demo, at your practice or by video. We use your real day: your appointments, your acts, your prices.",
    name: "Your name",
    practice: "Practice name",
    city: "City",
    phone: "Phone",
    email: "E-mail",
    message: "What would you like to see?",
    send: "Request a demo",
    whatsapp: "Write to us on WhatsApp",
    note: "Your request goes straight to our team by e-mail. The website keeps no copy of it.",
    subject: "MeDoc Dentist demo request",
    required: "Required",
  },
  footer: {
    tagline: "Dental practice software. Your data, in your practice.",
    company: "A Sifra Labs product",
    legal: "Legal notice",
    device: "MeDoc Dentist is administration and documentation software for licensed dental staff. It is not a medical device and does not replace clinical judgement.",
  },
  product: productEn,
};

export type Dict = typeof en;

export const DICTS: Record<Lang, Dict> = { fr, ar, en };
