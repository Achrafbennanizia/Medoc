import type { Lang } from "./i18n";
import type { EditionId } from "./route";

/**
 * Copy for "#/editions", "#/editions/<edition>" and the home editions preview.
 * Limits follow config/editions.yaml. Every claim comes from docs/brand/site-facts.md; installation,
 * training and service months mirror prices.licenses in i18n.ts (keep the two in step).
 * A feature that is not in all three editions names its editions (`eds`, or the text itself).
 */
export const EDITION_NAME: Record<EditionId, string> = { essentiel: "Essentiel", cabinet: "Cabinet", "cabinet-plus": "Cabinet+" };

/** Hero photo of each edition article (public/photos). */
export const EDITION_PHOTO: Record<EditionId, string> = { essentiel: "dentist-computer", cabinet: "doctor-reception", "cabinet-plus": "dentists-screen" };

const ALL: EditionId[] = ["essentiel", "cabinet", "cabinet-plus"];
const TEAM: EditionId[] = ["cabinet", "cabinet-plus"];
const PLUS: EditionId[] = ["cabinet-plus"];

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

const fr: EditionsCopy = {
  ui: {
    every: "Toutes les éditions",
    only: "{x} uniquement",
    and: " et ",
    yes: "Inclus",
    no: "Non inclus",
    oneTime: "licence payée une fois, HT",
    demo: "Réserver une démo gratuite",
    compare: "Comparer les éditions",
    kicker: "Éditions MeDoc Dentist",
    see: "Voir {x}",
  },
  page: {
    kicker: "Éditions",
    title: "Choisissez l'édition faite pour votre cabinet",
    lead: "Un logiciel, trois tailles. Chaque édition garde vos dossiers patients chiffrés sur vos propres ordinateurs, fonctionne sans internet et imprime des documents marocains. Ce qui change, c'est le nombre de personnes et d'ordinateurs qui travaillent avec.",
    unsure: "Vous hésitez ? Nous vous le dirons pendant la démo.",
    compareTitle: "Toutes les différences, en détail",
    compareLead: "Taille, travail en équipe, plusieurs dentistes, prix et service, côte à côte.",
    plans: "Après les mois inclus, les forfaits de service commencent à {x} par mois.",
    plansLink: "Voir les prix et les forfaits",
  },
  preview: {
    kicker: "Éditions",
    title: "Un logiciel, trois éditions. Choisissez la taille de votre cabinet.",
    lead: "Chaque édition garde vos dossiers chiffrés sur vos propres ordinateurs et fonctionne sans internet. Elles diffèrent par le nombre de personnes et d'ordinateurs qui travaillent avec.",
  },
  article: {
    whoTitle: "Pour qui",
    fitsTitle: "C'est pour vous si",
    dayTitle: "Ce qui change dans votre journée",
    dayMore: "Voir toutes les fonctions",
    includedTitle: "Ce qui est inclus",
    includedLead: "Payé une fois. L'installation et les premiers mois de service sont compris.",
    plansLink: "Les forfaits de service après les mois inclus",
    limitsTitle: "Bon à savoir",
    limitsLead: "Ce que cette édition ne fait pas, pour décider en connaissance de cause.",
    faqTitle: "Questions sur {x}",
    othersTitle: "Les autres éditions",
  },
  table: {
    caption: "Comparatif des éditions MeDoc Dentist : Essentiel, Cabinet et Cabinet+",
    hint: "Faites défiler sur le côté pour voir les trois éditions.",
    corner: "Ce que vous obtenez",
    size: {
      t: "Taille du cabinet",
      rows: [
        { t: "Ordinateurs", cells: ["1", "Jusqu'à 3", "Jusqu'à 5"] },
        { t: "Ordinateurs administrateurs", cells: ["1", "1", "2"] },
        { t: "Comptes de connexion", cells: ["2 : vous et un invité", "3", "Jusqu'à 20"] },
        { t: "Dentistes", cells: ["1", "1", "Jusqu'à 4"] },
      ],
    },
    team: {
      t: "Travailler en équipe",
      rows: [
        { t: "Boîte de réception invité", d: "Ce que saisit l'invité attend votre accord", marks: [true, false, false] },
        { t: "Comptes du personnel et rôles", d: "Par défaut, l'accueil ne voit pas le dossier médical", marks: [false, true, true] },
        { t: "Réseau du cabinet", d: "Les ordinateurs partagent une seule base chiffrée", marks: [false, true, true] },
        { t: "Tâches vers l'accueil", d: "Envoyées depuis le dossier patient, confirmées par le dentiste", marks: [false, true, true] },
        { t: "Validation des dossiers", d: "L'accueil envoie un dossier, le dentiste valide ou refuse", marks: [false, true, true] },
        { t: "Clôture et mouvements de caisse", d: "Compter la caisse, noter dépôts et dépenses", marks: [false, true, true] },
        { t: "Temps de travail", d: "Les heures de votre équipe", marks: [false, true, true] },
      ],
    },
    doctors: {
      t: "Plusieurs dentistes",
      rows: [
        { t: "Dentistes côte à côte", d: "Deux à quatre agendas dans la vue jour", marks: [false, false, true] },
        { t: "Second ordinateur administrateur", d: "Continue à numéroter les factures quand le principal est hors ligne", marks: [false, false, true] },
        { t: "Règles de partage", d: "Chaque dentiste décide de ce qu'il partage", marks: [false, false, true] },
        { t: "Statistiques par dentiste", d: "Tableau comparatif et filtre par dentiste", marks: [false, false, true] },
      ],
    },
    service: {
      t: "Prix et service",
      price: { t: "Licence", d: "Payée une fois, HT" },
      rows: [
        { t: "Installation", cells: ["À distance", "Sur place, avec reprise des données", "Sur place, avec reprise des données"] },
        { t: "Formation", cells: ["2 heures", "2 heures au cabinet", "Deux sessions"] },
        { t: "Service inclus", cells: ["3 mois", "6 mois", "12 mois"] },
      ],
    },
    common: {
      t: "Dans toutes les éditions",
      items: [
        "Dossiers patients et recherche",
        "Schéma dentaire",
        "Agenda avec glisser-déposer",
        "Ordonnances et certificats",
        "Factures marocaines en français ou en arabe",
        "Encaissements, reçus et journal de caisse",
        "Statistiques",
        "Base de données chiffrée (AES-256)",
        "Sauvegardes quotidiennes automatiques",
        "Fonctionne sans internet",
      ],
    },
    cta: "Réserver une démo de {x}",
  },
  editions: {
    essentiel: {
      forLine: "Pour un dentiste qui travaille seul, ou avec une aide de temps en temps.",
      card: "1 ordinateur · vous et un compte invité",
      photoAlt: "Un dentiste en tenue et masque saisit sur un ordinateur dans son cabinet.",
      who: "Essentiel, c'est MeDoc Dentist sur un ordinateur, pour un dentiste. Dossiers patients, agenda, documents et encaissements sont au même endroit, chiffrés sur votre ordinateur. La personne qui vous aide peut se connecter avec le compte invité, et rien de ce qu'elle saisit n'entre dans vos dossiers sans votre accord.",
      fits: ["Vous travaillez seul, ou avec une aide temporaire", "Un ordinateur suffit à votre cabinet", "Vous voulez quitter le papier sans installer de réseau"],
      other: { q: "L'accueil travaille sur son propre ordinateur ?", id: "cabinet" },
      day: [
        {
          t: "Une aide, sans le risque",
          d: "Une aide temporaire se connecte avec le compte invité. Les rendez-vous, données patients et encaissements en espèces qu'elle saisit attendent dans votre boîte de réception jusqu'à ce que vous cliquiez sur Ajouter ou Refuser.",
          eds: ["essentiel"],
        },
        {
          t: "Votre journée sur un écran",
          d: "Agenda par jour, semaine ou mois : glissez un rendez-vous vers un autre horaire. MeDoc Dentist refuse les doubles réservations et les rendez-vous pendant les pauses ou les absences, et vous permet d'annuler.",
          eds: ALL,
        },
        {
          t: "Chaque patient, en une recherche",
          d: "Cherchez par nom, téléphone, e-mail ou numéro d'assurance, avec des suggestions si le nom est mal orthographié. Le dossier s'ouvre sur un en-tête qui montre ce qui manque encore.",
          eds: ALL,
        },
        {
          t: "Des ordonnances qui vérifient les allergies",
          d: "Avant d'enregistrer une ordonnance, sa substance active est comparée aux allergies de l'anamnèse du patient, et vous confirmez avant de l'émettre malgré tout. Elle s'imprime en français ou en arabe sur votre en-tête, avec votre INPE.",
          eds: ALL,
        },
        {
          t: "Des factures marocaines prêtes à remettre",
          d: "Chaque facture porte votre ICE, IF et TP, un numéro sans trou et le total en lettres, en français ou en arabe. MeDoc Dentist refuse d'en émettre une sans ICE ni IF.",
          eds: ALL,
        },
        {
          t: "Des sauvegardes sans y penser",
          d: "Une fois par jour, MeDoc Dentist sauvegarde le cabinet tout seul, chiffré, radios comprises. Envoyez les sauvegardes sur une clé USB ou un disque externe. Sans internet.",
          eds: ALL,
        },
      ],
      included: ["Installation à distance", "2 heures de formation", "3 mois de service inclus", "Une licence qui reste à vous, avec ou sans forfait", "Correctifs de sécurité gratuits pendant les 12 premiers mois"],
      limits: [
        "Un seul ordinateur. Si l'accueil a besoin de son propre ordinateur, choisissez Cabinet ou Cabinet+.",
        "Pas de tâches, de validation des dossiers ni de clôture de caisse : elles viennent avec Cabinet et Cabinet+.",
        "L'invité peut proposer des rendez-vous, des données patients et des encaissements en espèces. Tout le reste est refusé. Pour une modification, vous voyez les nouvelles valeurs, pas un avant-après.",
        "L'invité ne voit pas le dossier clinique, sauf si vous l'activez dans les Réglages.",
        "La sauvegarde quotidienne se fait quand MeDoc Dentist est ouvert.",
        "Encaissements en espèces, par carte ou par virement. Il n'y a pas de paiement par chèque.",
      ],
      faq: [
        {
          q: "Que voit l'invité ?",
          a: "Les rendez-vous et les données patients, pas le dossier clinique, sauf si vous l'autorisez dans Réglages → Sécurité → Invité. Tout ce que l'invité saisit attend dans votre boîte de réception.",
        },
        {
          q: "Essentiel a-t-il besoin d'internet ?",
          a: "Non. Rendez-vous, dossiers, factures et sauvegardes fonctionnent sans connexion, et les données patients ne partent pas dans un cloud. Internet sert seulement à vérifier les mises à jour, si vous le souhaitez.",
        },
        {
          q: "Que se passe-t-il après les 3 mois inclus ?",
          a: "Vous choisissez un forfait de service pour les mises à jour et l'assistance, ou aucun. La licence reste à vous et continue de fonctionner, et les correctifs de sécurité restent gratuits pendant les 12 premiers mois.",
        },
      ],
      final: { title: "Voyez Essentiel sur votre propre journée", text: "Une démo gratuite de 30 minutes, au cabinet ou en visio. Nous partons de vos rendez-vous, de vos actes et de vos tarifs." },
    },
    cabinet: {
      forLine: "Pour un dentiste avec un accueil, sur 3 ordinateurs au plus.",
      card: "Jusqu'à 3 ordinateurs · 3 comptes · 1 dentiste",
      photoAlt: "Un dentiste en tenue remplit un formulaire au comptoir de l'accueil.",
      who: "Cabinet est fait pour un cabinet où l'accueil et la salle de soins ont chacun un ordinateur. Chacun se connecte avec son propre compte, les ordinateurs partagent une base chiffrée sur votre réseau, et le travail passe de l'accueil au fauteuil dans le logiciel, pas sur des post-it.",
      fits: ["Un dentiste, avec une secrétaire ou une assistante", "L'accueil et la salle de soins ont chacun un ordinateur, 3 au plus", "Vous voulez compter la caisse et clôturer la journée chaque soir"],
      other: { q: "Deux à quatre dentistes ?", id: "cabinet-plus" },
      day: [
        {
          t: "Un seul dossier, sur chaque ordinateur",
          d: "L'accueil et la salle de soins partagent une base de données sur votre propre réseau, chiffrée, chaque modification signée. Un ordinateur qui perd la connexion continue de travailler et se met à jour à son retour.",
          eds: TEAM,
        },
        {
          t: "Des tâches plutôt que des interruptions",
          d: "Envoyez une tâche depuis le dossier du patient à l'accueil, ou à une personne précise. Pour la facturation, les impressions ou les données patient, l'accueil la marque faite avec une note ou un paiement lié, et vous la confirmez ou la renvoyez avec un motif.",
          eds: TEAM,
        },
        {
          t: "Des dossiers qui attendent votre accord",
          d: "L'accueil vous envoie le dossier d'un patient à revoir, avec une courte note. Il arrive dans votre liste « Dossiers à valider », avec un compteur dans le menu. Vous validez ou refusez, et chaque étape est journalisée.",
          eds: TEAM,
        },
        {
          t: "L'accueil voit ce qu'il lui faut",
          d: "L'accueil prend les rendez-vous, encaisse et classe. Par défaut, il ne voit ni diagnostics ni constatations cliniques, et c'est le logiciel qui l'impose, pas seulement l'écran.",
          eds: TEAM,
        },
        {
          t: "Une clôture de caisse qui tombe juste",
          d: "Le soir, vous comptez la caisse et saisissez le total du terminal de carte. MeDoc Dentist calcule ce qui devrait s'y trouver et ne clôture pas la journée sur un écart sans que vous en notiez la raison. Dépôts, retraits et dépenses en espèces sont notés avec un motif.",
          eds: TEAM,
        },
      ],
      included: ["Installation et reprise des données sur place", "2 heures de formation au cabinet", "6 mois de service inclus", "Une licence qui reste à vous, avec ou sans forfait", "Correctifs de sécurité gratuits pendant les 12 premiers mois"],
      limits: [
        "Un seul compte dentiste. Pour deux à quatre dentistes, choisissez Cabinet+.",
        "3 ordinateurs et 3 comptes de connexion au plus.",
        "Les nouvelles tâches arrivent toutes les 30 secondes, pas instantanément.",
        "La personne qui vous a envoyé un dossier n'est pas prévenue quand vous le validez ou le refusez.",
        "À la clôture, vous saisissez le comptage de caisse et le total du terminal de carte. Les virements apparaissent en totaux calculés par le logiciel. Il n'y a pas de paiement par chèque.",
      ],
      faq: [
        {
          q: "L'accueil peut-il voir le dossier médical ?",
          a: "Pas par défaut. Diagnostics et constatations cliniques restent au dentiste, et le logiciel l'impose. Vous pouvez donner le droit de les lire à une personne précise, si vous le décidez.",
        },
        {
          q: "Et si le réseau tombe ?",
          a: "Chaque ordinateur continue de travailler et se met à jour quand la connexion revient. Les modifications faites en même temps sur deux ordinateurs vont dans la liste des conflits de l'administrateur au lieu d'être perdues.",
        },
        {
          q: "Un second dentiste peut-il travailler en Cabinet ?",
          a: "Non. Cabinet compte un seul compte dentiste. Pour deux à quatre dentistes, Cabinet+ ajoute une colonne d'agenda et des statistiques par dentiste, et des règles de partage.",
        },
      ],
      final: { title: "Voyez Cabinet avec votre accueil", text: "Une démo gratuite de 30 minutes, au cabinet ou en visio. Nous parcourons une vraie journée, du premier rendez-vous à la clôture de caisse." },
    },
    "cabinet-plus": {
      forLine: "Pour les cabinets de 2 à 4 dentistes qui travaillent ensemble.",
      card: "Jusqu'à 5 ordinateurs · 20 comptes · 4 dentistes",
      photoAlt: "Deux dentistes devant un ordinateur regardent un scan dentaire à l'écran.",
      who: "Cabinet+, c'est tout Cabinet, pour un cabinet où plusieurs dentistes partagent l'accueil, l'agenda et la caisse. Chaque dentiste garde sa colonne et ses chiffres, et décide de ce qu'il partage.",
      fits: ["2 à 4 dentistes travaillent dans le même cabinet", "Il vous faut jusqu'à 5 ordinateurs, dont 2 ordinateurs administrateurs", "Dentistes, accueil et assistantes ont besoin de 20 comptes au plus"],
      other: { q: "Un seul dentiste ?", id: "cabinet" },
      day: [
        {
          t: "Les agendas de chaque dentiste, côte à côte",
          d: "Dans la vue jour, les agendas de deux à quatre dentistes sont côte à côte : l'accueil voit qui est libre avant de réserver.",
          eds: PLUS,
        },
        {
          t: "Des chiffres par dentiste",
          d: "Les statistiques répartissent l'activité par dentiste, avec un tableau comparatif et un filtre par dentiste.",
          eds: PLUS,
        },
        {
          t: "Chaque dentiste décide de ce qu'il partage",
          d: "Les règles de partage fixent ce que chaque dentiste partage avec les autres. Un dossier ne peut être validé que par un dentiste autorisé par son titulaire.",
          eds: PLUS,
        },
        {
          t: "Des documents signés par le bon dentiste",
          d: "Ordonnances et certificats portent le nom du dentiste qui les a émis.",
          eds: PLUS,
        },
        {
          t: "La facturation continue quand l'ordinateur principal est éteint",
          d: "Un second ordinateur administrateur continue à numéroter les factures pendant que le principal est hors ligne.",
          eds: PLUS,
        },
        {
          t: "Tout ce que contient Cabinet",
          d: "Une base sur votre réseau, des tâches entre dentistes et accueil, la validation des dossiers et la clôture de caisse.",
          eds: TEAM,
        },
      ],
      included: ["Installation et reprise des données sur place", "Deux sessions de formation", "12 mois de service inclus", "Une licence qui reste à vous, avec ou sans forfait", "Correctifs de sécurité gratuits pendant les 12 premiers mois"],
      limits: [
        "Glisser un rendez-vous dans la colonne d'un autre dentiste ne change pas le dentiste. Ouvrez le rendez-vous pour le changer.",
        "Les dentistes sont côte à côte dans la vue jour seulement. La vue semaine ne se divise pas par dentiste.",
        "Les tâches, les finances et les commandes ne se filtrent pas encore par dentiste.",
        "La confidentialité par fiche couvre les rendez-vous. Les notes cliniques, les documents et les tâches ne l'ont pas encore.",
        "L'agenda n'a pas de colonnes par fauteuil ou par salle.",
        "Il n'y a pas de paiement par chèque.",
      ],
      faq: [
        {
          q: "Combien de dentistes et d'ordinateurs avec Cabinet+ ?",
          a: "Jusqu'à 4 dentistes et 20 comptes de connexion, sur 5 ordinateurs au plus, dont 2 ordinateurs administrateurs.",
        },
        {
          q: "Et si l'ordinateur principal est éteint ?",
          a: "Les autres ordinateurs continuent de travailler et se mettent à jour à son retour. En attendant, le second ordinateur administrateur continue à numéroter les factures.",
        },
        {
          q: "Puis-je passer un rendez-vous à un autre dentiste en le faisant glisser ?",
          a: "Non. Le glisser change la date et l'heure. Pour changer de dentiste, ouvrez le rendez-vous et choisissez-en un autre.",
        },
      ],
      final: { title: "Voyez Cabinet+ avec toute votre équipe", text: "Une démo gratuite de 30 minutes, au cabinet ou en visio. Nous parcourons une vraie journée, plusieurs dentistes côte à côte." },
    },
  },
};

const ar: EditionsCopy = {
  ui: {
    every: "كل الإصدارات",
    only: "{x} فقط",
    and: " و",
    yes: "مشمول",
    no: "غير مشمول",
    oneTime: "ترخيص يُدفع مرة واحدة، دون احتساب الضريبة",
    demo: "احجز عرضًا مجانيًا",
    compare: "قارن الإصدارات",
    kicker: "إصدارات MeDoc Dentist",
    see: "اكتشف {x}",
  },
  page: {
    kicker: "الإصدارات",
    title: "اختر الإصدار الذي يناسب عيادتك",
    lead: "برنامج واحد بثلاثة أحجام. كل إصدار يحفظ ملفات مرضاك مشفّرة على حواسيبك، ويعمل دون إنترنت، ويطبع الوثائق المغربية. ما يتغيّر هو عدد الأشخاص والحواسيب التي تعمل به.",
    unsure: "لست متأكدًا أيّها يناسبك؟ سنخبرك خلال العرض.",
    compareTitle: "كل الفروق بالتفصيل",
    compareLead: "الحجم، والعمل ضمن فريق، وتعدّد الأطباء، والسعر والخدمة، جنبًا إلى جنب.",
    plans: "بعد الأشهر المشمولة، تبدأ باقات الخدمة من {x} شهريًا.",
    plansLink: "اطّلع على الأسعار وباقات الخدمة",
  },
  preview: {
    kicker: "الإصدارات",
    title: "برنامج واحد بثلاثة إصدارات. اختر حجم عيادتك.",
    lead: "كل إصدار يحفظ ملفاتك مشفّرة على حواسيبك ويعمل دون إنترنت. وتختلف الإصدارات في عدد الأشخاص والحواسيب التي تعمل به.",
  },
  article: {
    whoTitle: "لمن هذا الإصدار",
    fitsTitle: "يناسبك إذا",
    dayTitle: "ما الذي يتغيّر في يومك",
    dayMore: "اطّلع على كل الميزات",
    includedTitle: "ما يشمله الترخيص",
    includedLead: "يُدفع مرة واحدة، ويشمل التثبيت والأشهر الأولى من الخدمة.",
    plansLink: "باقات الخدمة بعد الأشهر المشمولة",
    limitsTitle: "من الجيد أن تعرف",
    limitsLead: "ما لا يقوم به هذا الإصدار، لتقرّر وأنت على علم بكل شيء.",
    faqTitle: "أسئلة حول {x}",
    othersTitle: "الإصدارات الأخرى",
  },
  table: {
    caption: "مقارنة إصدارات MeDoc Dentist: Essentiel وCabinet وCabinet+",
    hint: "مرّر جانبيًا لرؤية الإصدارات الثلاثة.",
    corner: "ما تحصل عليه",
    size: {
      t: "حجم عيادتك",
      rows: [
        { t: "الحواسيب", cells: ["1", "حتى 3", "حتى 5"] },
        { t: "حواسيب الإدارة", cells: ["1", "1", "2"] },
        { t: "حسابات الدخول", cells: ["2: أنت وضيف", "3", "حتى 20"] },
        { t: "أطباء الأسنان", cells: ["1", "1", "حتى 4"] },
      ],
    },
    team: {
      t: "العمل ضمن فريق",
      rows: [
        { t: "صندوق وارد الضيف", d: "ما يُدخله الضيف ينتظر موافقتك", marks: [true, false, false] },
        { t: "حسابات الموظفين والأدوار", d: "افتراضيًا لا يرى الاستقبال الملف الطبي", marks: [false, true, true] },
        { t: "شبكة العيادة", d: "تتشارك الحواسيب قاعدة بيانات مشفّرة واحدة", marks: [false, true, true] },
        { t: "مهام إلى الاستقبال", d: "تُرسل من ملف المريض ويؤكّدها الطبيب", marks: [false, true, true] },
        { t: "المصادقة على الملفات", d: "يرسل الاستقبال الملف، فيصادق عليه الطبيب أو يرفضه", marks: [false, true, true] },
        { t: "إغلاق اليوم وحركات الصندوق", d: "عدّ الصندوق وتسجيل الإيداعات والمصاريف", marks: [false, true, true] },
        { t: "وقت العمل", d: "ساعات عمل فريقك", marks: [false, true, true] },
      ],
    },
    doctors: {
      t: "عدة أطباء أسنان",
      rows: [
        { t: "الأطباء جنبًا إلى جنب", d: "من جدولين إلى أربعة جداول في عرض اليوم", marks: [false, false, true] },
        { t: "حاسوب إدارة ثانٍ", d: "يواصل ترقيم الفواتير حين يكون الحاسوب الرئيسي غير متصل", marks: [false, false, true] },
        { t: "قواعد المشاركة", d: "كل طبيب يقرّر ما يشاركه", marks: [false, false, true] },
        { t: "إحصاءات لكل طبيب", d: "جدول مقارنة وتصفية حسب الطبيب", marks: [false, false, true] },
      ],
    },
    service: {
      t: "السعر والخدمة",
      price: { t: "الترخيص", d: "يُدفع مرة واحدة، دون احتساب الضريبة" },
      rows: [
        { t: "التثبيت", cells: ["عن بُعد", "في العيادة، مع نقل البيانات", "في العيادة، مع نقل البيانات"] },
        { t: "التدريب", cells: ["ساعتان", "ساعتان في العيادة", "جلستان"] },
        { t: "الخدمة المشمولة", cells: ["3 أشهر", "6 أشهر", "12 شهرًا"] },
      ],
    },
    common: {
      t: "في كل الإصدارات",
      items: [
        "ملفات المرضى والبحث",
        "مخطط الأسنان",
        "جدول المواعيد مع السحب والإفلات",
        "الوصفات والشهادات",
        "فواتير مغربية بالفرنسية أو العربية",
        "المدفوعات والإيصالات ويومية الصندوق",
        "الإحصاءات",
        "قاعدة بيانات مشفّرة (AES-256)",
        "نسخ احتياطية يومية تلقائية",
        "يعمل دون إنترنت",
      ],
    },
    cta: "احجز عرضًا لإصدار {x}",
  },
  editions: {
    essentiel: {
      forLine: "لطبيب أسنان يعمل وحده، أو مع مساعد يأتي من حين لآخر.",
      card: "حاسوب واحد · أنت وحساب ضيف",
      photoAlt: "طبيب أسنان بزيّ العمل وكمامة يكتب على حاسوب في عيادته.",
      who: "Essentiel هو MeDoc Dentist على حاسوب واحد، لطبيب أسنان واحد. ملفات المرضى والمواعيد والوثائق والمدفوعات في مكان واحد، مشفّرة على حاسوبك. يمكن لمن يساعدك أن يدخل بحساب الضيف، ولا يصل شيء مما يُدخله إلى ملفاتك دون موافقتك.",
      fits: ["تعمل وحدك، أو مع مساعد مؤقت", "حاسوب واحد يكفي عيادتك", "تريد التخلّص من الورق دون إعداد شبكة"],
      other: { q: "للاستقبال حاسوبه الخاص؟", id: "cabinet" },
      day: [
        {
          t: "مساعد، دون مخاطرة",
          d: "يدخل المساعد المؤقت بحساب الضيف. المواعيد وبيانات المرضى والمدفوعات النقدية التي يُدخلها تنتظر في صندوق الوارد حتى تضغط على «إضافة» أو «رفض».",
          eds: ["essentiel"],
        },
        {
          t: "يومك على شاشة واحدة",
          d: "اعرض المواعيد باليوم أو الأسبوع أو الشهر، واسحب موعدًا إلى وقت آخر. يرفض MeDoc Dentist الحجز المزدوج والحجز أثناء الاستراحات أو الغياب، ويتيح لك التراجع.",
          eds: ALL,
        },
        {
          t: "كل مريض ببحث واحد",
          d: "ابحث بالاسم أو الهاتف أو البريد الإلكتروني أو رقم التأمين، مع اقتراحات إذا كُتب الاسم بشكل خاطئ. يُفتح الملف على ترويسة تُظهر ما لا يزال ناقصًا.",
          eds: ALL,
        },
        {
          t: "وصفات تتحقق من الحساسية",
          d: "قبل حفظ الوصفة، تُقارَن مادتها الفعالة بالحساسيات المسجّلة في السوابق الطبية للمريض، وتؤكّد بنفسك قبل إصدارها رغم ذلك. وتُطبع بالفرنسية أو العربية على ترويسة عيادتك مع رقم INPE.",
          eds: ALL,
        },
        {
          t: "فواتير مغربية جاهزة للتسليم",
          d: "تحمل كل فاتورة ICE وIF وTP الخاصة بك، ورقمًا متسلسلًا دون فراغات، والمبلغ بالحروف، بالفرنسية أو العربية. ولا يُصدر MeDoc Dentist أي فاتورة دون ICE وIF.",
          eds: ALL,
        },
        {
          t: "نسخ احتياطية لا تحتاج إلى تذكّرها",
          d: "مرة في اليوم، ينسخ MeDoc Dentist بيانات العيادة تلقائيًا، مشفّرة، مع الصور الشعاعية. ويمكنك حفظ النسخ على مفتاح USB أو قرص خارجي. دون إنترنت.",
          eds: ALL,
        },
      ],
      included: ["تثبيت عن بُعد", "ساعتان من التدريب", "3 أشهر من الخدمة مشمولة", "ترخيص يبقى ملكك، مع باقة خدمة أو دونها", "إصلاحات الأمان مجانية خلال أول 12 شهرًا"],
      limits: [
        "حاسوب واحد. إذا احتاج الاستقبال حاسوبه الخاص، فاختر Cabinet أو Cabinet+.",
        "لا مهام ولا مصادقة على الملفات ولا إغلاق لليوم: هذه تأتي مع Cabinet وCabinet+.",
        "يستطيع الضيف اقتراح مواعيد وبيانات مرضى ومدفوعات نقدية، وكل ما عدا ذلك يُرفض. وعند التعديل ترى القيم الجديدة، لا مقارنة بين ما قبل وما بعد.",
        "لا يرى الضيف الملف السريري إلا إذا فعّلت ذلك في الإعدادات.",
        "تتم النسخة الاحتياطية اليومية حين يكون MeDoc Dentist مفتوحًا.",
        "المدفوعات نقدًا أو بالبطاقة أو بالتحويل البنكي. لا توجد وسيلة أداء بالشيك.",
      ],
      faq: [
        {
          q: "ماذا يرى الضيف؟",
          a: "المواعيد وبيانات المرضى، لا الملف السريري، إلا إذا سمحت بذلك في الإعدادات ← الأمان ← الضيف. وكل ما يُدخله الضيف ينتظر في صندوق الوارد.",
        },
        {
          q: "هل يحتاج Essentiel إلى الإنترنت؟",
          a: "لا. المواعيد والملفات والفواتير والنسخ الاحتياطية تعمل دون اتصال، ولا تُرسل بيانات المرضى إلى أي سحابة. يُستعمل الإنترنت فقط للتحقق الاختياري من التحديثات.",
        },
        {
          q: "ماذا بعد الأشهر الثلاثة المشمولة؟",
          a: "تختار باقة خدمة للتحديثات والدعم، أو لا تختار أي باقة. يبقى الترخيص ملكك ويستمر في العمل، وتبقى إصلاحات الأمان مجانية خلال أول 12 شهرًا.",
        },
      ],
      final: { title: "شاهد Essentiel على يومك الحقيقي", text: "عرض مجاني لمدة 30 دقيقة، في عيادتك أو عبر الفيديو. ننطلق من مواعيدك وإجراءاتك وأسعارك." },
    },
    cabinet: {
      forLine: "لطبيب أسنان واحد مع الاستقبال، على 3 حواسيب كحد أقصى.",
      card: "حتى 3 حواسيب · 3 حسابات · طبيب واحد",
      photoAlt: "طبيب أسنان بزيّ العمل يملأ استمارة عند مكتب الاستقبال.",
      who: "Cabinet مصمَّم لعيادة يكون فيها للاستقبال ولقاعة العلاج حاسوب لكل منهما. يدخل كل شخص بحسابه الخاص، وتتشارك الحواسيب قاعدة بيانات مشفّرة واحدة عبر شبكتك، وينتقل العمل بين المكتب والكرسي داخل البرنامج، لا على أوراق لاصقة.",
      fits: ["طبيب أسنان واحد مع سكرتيرة أو مساعدة", "للاستقبال ولقاعة العلاج حاسوب لكل منهما، 3 حواسيب كحد أقصى", "تريد عدّ الصندوق وإغلاق اليوم كل مساء"],
      other: { q: "من طبيبين إلى أربعة أطباء؟", id: "cabinet-plus" },
      day: [
        {
          t: "ملف واحد على كل حاسوب",
          d: "يتشارك الاستقبال وقاعة العلاج قاعدة بيانات واحدة عبر شبكتك الخاصة، مشفّرة، وكل تغيير فيها موقَّع. والحاسوب الذي يفقد الاتصال يواصل العمل ويلحق بالتغييرات حين يعود.",
          eds: TEAM,
        },
        {
          t: "مهام بدل المقاطعات",
          d: "أرسل مهمة من ملف المريض إلى الاستقبال، أو إلى شخص محدد. في الفوترة والطباعة وبيانات المرضى، يعلّم الاستقبال المهمة منجزة مع ملاحظة أو أداء مرتبط، فتؤكّدها أو تعيدها مع ذكر السبب.",
          eds: TEAM,
        },
        {
          t: "ملفات تنتظر موافقتك",
          d: "يرسل إليك الاستقبال ملف مريض للمراجعة مع ملاحظة قصيرة. يصل إلى قائمتك «سجلات للتحقق» مع عدّاد في القائمة الجانبية. تصادق عليه أو ترفضه، وتُسجَّل كل خطوة.",
          eds: TEAM,
        },
        {
          t: "الاستقبال يرى ما يحتاجه فقط",
          d: "يحجز الاستقبال المواعيد ويحصّل ويرتّب الملفات. افتراضيًا لا يرى التشخيصات ولا الملاحظات السريرية، والبرنامج نفسه يفرض ذلك، لا الشاشة فقط.",
          eds: TEAM,
        },
        {
          t: "إغلاق يوم مضبوط",
          d: "في المساء تعدّ الصندوق وتُدخل مجموع جهاز الأداء بالبطاقة. يحسب MeDoc Dentist ما يجب أن يكون في الصندوق، ولا يُغلق اليوم على فارق دون أن تكتب السبب. وتُسجَّل الإيداعات والسحوبات والمصاريف النقدية مع سببها.",
          eds: TEAM,
        },
      ],
      included: ["تثبيت ونقل البيانات في العيادة", "ساعتان من التدريب في العيادة", "6 أشهر من الخدمة مشمولة", "ترخيص يبقى ملكك، مع باقة خدمة أو دونها", "إصلاحات الأمان مجانية خلال أول 12 شهرًا"],
      limits: [
        "حساب طبيب أسنان واحد. لطبيبين إلى أربعة أطباء، اختر Cabinet+.",
        "3 حواسيب و3 حسابات دخول كحد أقصى.",
        "تصل المهام الجديدة كل 30 ثانية، لا فورًا.",
        "لا يُخطَر من أرسل إليك الملف حين تصادق عليه أو ترفضه.",
        "عند إغلاق اليوم تُدخل عدّ الصندوق ومجموع جهاز البطاقة، أما التحويلات البنكية فتظهر كمجاميع يحسبها البرنامج. ولا توجد وسيلة أداء بالشيك.",
      ],
      faq: [
        {
          q: "هل يرى الاستقبال الملف الطبي؟",
          a: "ليس افتراضيًا. تبقى التشخيصات والملاحظات السريرية عند الطبيب، والبرنامج يفرض ذلك. ويمكنك أن تمنح شخصًا محددًا حق قراءتها إن أردت.",
        },
        {
          q: "ماذا لو انقطعت الشبكة؟",
          a: "يواصل كل حاسوب العمل ويلحق بالتغييرات حين يعود الاتصال. والتعديلات التي تتم في الوقت نفسه على حاسوبين تذهب إلى قائمة التعارضات لدى المسؤول بدل أن تضيع.",
        },
        {
          q: "هل يمكن لطبيب ثانٍ العمل في Cabinet؟",
          a: "لا. يضم Cabinet حساب طبيب أسنان واحدًا. ولطبيبين إلى أربعة أطباء، يضيف Cabinet+ عمودًا في جدول المواعيد وإحصاءات لكل طبيب، وقواعد للمشاركة.",
        },
      ],
      final: { title: "شاهد Cabinet مع استقبال عيادتك", text: "عرض مجاني لمدة 30 دقيقة، في عيادتك أو عبر الفيديو. نمرّ على يوم حقيقي، من أول موعد إلى إغلاق اليوم." },
    },
    "cabinet-plus": {
      forLine: "للعيادات التي يعمل فيها من طبيبين إلى أربعة أطباء أسنان معًا.",
      card: "حتى 5 حواسيب · 20 حسابًا · 4 أطباء",
      photoAlt: "طبيبتا أسنان أمام حاسوب تنظران إلى صورة مسح للأسنان على الشاشة.",
      who: "Cabinet+ هو كل ما في Cabinet، لعيادة يتشارك فيها عدة أطباء الاستقبالَ وجدولَ المواعيد والصندوق. يحتفظ كل طبيب بعموده وأرقامه، ويقرّر ما يشاركه.",
      fits: ["من طبيبين إلى أربعة أطباء في العيادة نفسها", "تحتاج حتى 5 حواسيب، منها حاسوبان للإدارة", "يحتاج الأطباء والاستقبال والمساعدون حتى 20 حساب دخول"],
      other: { q: "طبيب واحد فقط؟", id: "cabinet" },
      day: [
        {
          t: "جداول كل الأطباء جنبًا إلى جنب",
          d: "في عرض اليوم، تظهر جداول طبيبين إلى أربعة أطباء متجاورة، فيرى الاستقبال من المتاح قبل الحجز.",
          eds: PLUS,
        },
        {
          t: "أرقام لكل طبيب",
          d: "تعرض الإحصاءات النشاط حسب كل طبيب، مع جدول مقارنة وتصفية حسب الطبيب.",
          eds: PLUS,
        },
        {
          t: "كل طبيب يقرّر ما يشاركه",
          d: "تحدّد قواعد المشاركة ما يشاركه كل طبيب مع الآخرين. ولا يصادق على ملف إلا طبيب يسمح له صاحب الملف بذلك.",
          eds: PLUS,
        },
        {
          t: "وثائق باسم الطبيب الصحيح",
          d: "تحمل الوصفات والشهادات اسم الطبيب الذي أصدرها.",
          eds: PLUS,
        },
        {
          t: "الفوترة تستمر حين يتوقف الحاسوب الرئيسي",
          d: "يواصل حاسوب إدارة ثانٍ ترقيم الفواتير ما دام الحاسوب الرئيسي غير متصل.",
          eds: PLUS,
        },
        {
          t: "كل ما في Cabinet",
          d: "قاعدة بيانات واحدة على شبكتك، ومهام بين الأطباء والاستقبال، والمصادقة على الملفات، وإغلاق اليوم.",
          eds: TEAM,
        },
      ],
      included: ["تثبيت ونقل البيانات في العيادة", "جلستا تدريب", "12 شهرًا من الخدمة مشمولة", "ترخيص يبقى ملكك، مع باقة خدمة أو دونها", "إصلاحات الأمان مجانية خلال أول 12 شهرًا"],
      limits: [
        "سحب موعد إلى عمود طبيب آخر لا يغيّر الطبيب. افتح الموعد لتغييره.",
        "يظهر الأطباء جنبًا إلى جنب في عرض اليوم فقط، ولا ينقسم عرض الأسبوع حسب الطبيب.",
        "لا يمكن بعدُ تصفية المهام والمالية والطلبيات حسب الطبيب.",
        "خصوصية كل سجل تشمل المواعيد. أما الملاحظات السريرية والوثائق والمهام فلا تشملها بعد.",
        "لا يضم جدول المواعيد أعمدة للكراسي أو القاعات.",
        "لا توجد وسيلة أداء بالشيك.",
      ],
      faq: [
        {
          q: "كم طبيبًا وحاسوبًا يتسع Cabinet+؟",
          a: "حتى 4 أطباء أسنان و20 حساب دخول، على 5 حواسيب كحد أقصى، منها حاسوبان للإدارة.",
        },
        {
          q: "ماذا لو توقف الحاسوب الرئيسي؟",
          a: "تواصل الحواسيب الأخرى العمل وتلحق بالتغييرات حين يعود. وفي الأثناء يواصل حاسوب الإدارة الثاني ترقيم الفواتير.",
        },
        {
          q: "هل أستطيع نقل موعد إلى طبيب آخر بسحبه؟",
          a: "لا. السحب يغيّر التاريخ والوقت فقط. لتغيير الطبيب، افتح الموعد واختر طبيبًا آخر.",
        },
      ],
      final: { title: "شاهد Cabinet+ مع فريقك كاملًا", text: "عرض مجاني لمدة 30 دقيقة، في عيادتك أو عبر الفيديو. نمرّ على يوم حقيقي مع عدة أطباء جنبًا إلى جنب." },
    },
  },
};

export const EDITIONS_COPY: Record<Lang, EditionsCopy> = { en, fr, ar };
