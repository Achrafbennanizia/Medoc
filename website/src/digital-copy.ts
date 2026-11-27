import type { Lang } from "./i18n";

/**
 * Home "Paper costs practices everywhere", the Digitalization Pack, the pilot invitation, and the
 * Morocco and Europe pages. Every figure, law and feature comes from docs/brand/site-facts.md and
 * carries its source. Figures from other countries support an advantage; they are not Moroccan
 * measurements. Bill 52-26 is not law yet and is always labelled so. Morocco is the only market.
 */
type Src = { t: string; u: string };
/** A sourced figure, then what MeDoc Dentist does about it (true in all three editions unless named). */
type Cost = { fig: string; market: string; claim: string; src: Src; answer: { t: string; d: string } };
/** A sourced Morocco fact for the #/morocco page. */
type Fact = { topic: string; status?: string; fig: string; text: string; src: Src };
type Item = { t: string; d: string };
export type DigitalCopy = {
  sourceLabel: string;
  advantages: { kicker: string; title: string; lead: string; answerLabel: string; items: Cost[] };
  pilot: { kicker: string; title: string; text: string; points: string[]; cta: string };
  pack: { kicker: string; title: string; lead: string; steps: Item[]; promise: string; cta: string; before: string; after: string; beforeAlt: string; afterAlt: string };
  morocco: {
    facts: { kicker: string; title: string; lead: string; items: Fact[]; note: string };
    ready: { kicker: string; title: string; lead: string; items: Item[]; notYetTitle: string; notYet: string[]; cndp: string; cta: string };
  };
  /** Body of the Europe page; its head is in routes-copy (heads.europe). */
  europe: { text: string; cta: string };
};

const SRC = {
  burnett: { t: "Burnett et al., BMC Health Services Research (2011)", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3118108/" },
  dentalAudit: { t: "Audit of dental record-keeping, Health SA Gesondheid (2023)", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10784275/" },
  kaushal: { t: "Weill Cornell Medicine, Kaushal et al. (2010)", u: "https://news.weill.cornell.edu/news/2010/02/electronic-prescriptions-reduce-errors-by-seven-fold" },
  pinchin: { t: "Pinchin & Blakey, Future Hospital Journal (2016)", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6465898/" },
  ibm: {
    t: "Chief Healthcare Executive, on IBM Cost of a Data Breach (2026)",
    u: "https://www.chiefhealthcareexecutive.com/view/cost-of-breaches-healthcare-still-leads-all-sectors-and-ai-is-used-in-more-attacks",
  },
  sophos: { t: "Sophos, The State of Ransomware in Healthcare (2024)", u: "https://www.sophos.com/en-us/blog/the-state-of-ransomware-in-healthcare-2024" },
  dentists: {
    t: "Aujourd'hui le Maroc, carte sanitaire (2025)",
    u: "https://aujourdhui.ma/societe/carte-sanitaire-le-maroc-compte-34-173-medecins-dans-le-public-et-le-prive-en-2025",
  },
  digital2030: {
    t: "Maroc.ma (MAP), Digital Morocco 2030 (2026)",
    u: "https://maroc.ma/index%2Ephp/fr/actualites/la-strategie-digital-morocco-2030-fait-du-numerique-un-moteur-de-competitivite-et-dinclusion-sociale",
  },
  amo: { t: "Maroc.ma (MAP), généralisation de l'AMO (2025)", u: "https://maroc.ma/fr/actualites/generalisation-de-lamo-plus-de-32-millions-de-beneficiaires-en-2025" },
  bill5226: { t: "Bladi.net, projet de loi 52-26 (2026)", u: "https://www.bladi.net/medecins-marocains-risquent-jusqu-dirhams,123105.html" },
  law0908: {
    t: "Loi n° 09-08, texte officiel (Adala)",
    u: "https://adala.justice.gov.ma/api/uploads/2024/04/30/Protection%20des%20personnes%20physiques-1714464099884.pdf",
  },
  cnss: { t: "The Record (2025)", u: "https://therecord.media/morocco-investigates-breach-hackers-algeria" },
};

const en: DigitalCopy = {
  sourceLabel: "Source",
  advantages: {
    kicker: "Why go digital",
    title: "Paper costs practices everywhere",
    lead: "Researchers abroad measured what paper records and weak data security cost. The figures come from other countries, each with its source. Under each one: what MeDoc Dentist does about it, in all three editions.",
    answerLabel: "With MeDoc Dentist",
    items: [
      {
        fig: "15%",
        market: "United Kingdom · 2011",
        claim: "of outpatient consultations at three teaching hospitals with paper records lacked key clinical information. One in five of those patients was put at risk of harm.",
        src: SRC.burnett,
        answer: { t: "The whole patient on one screen", d: "Each record opens on one header: status, open invoices, contact details, insurance number and a mini tooth chart, plus what is still missing, such as the medical history or the examination. X-rays and scans stay with the patient." },
      },
      {
        fig: "105 of 362",
        market: "South Africa · 2023",
        claim: "dental files could not be found for an audit at a university dental hospital, because of a poor filing system. That is about 29%.",
        src: SRC.dentalAudit,
        answer: { t: "Every patient found with one search", d: "Search by name, phone, e-mail or insurance number, with “did you mean” suggestions for names. Nothing to file, nothing to misfile." },
      },
      {
        fig: "6.6%",
        market: "United States (New York) · 2010",
        claim: "of prescriptions had errors a year after doctors switched to electronic prescribing, down from 42.5% when they wrote by hand. Illegible prescriptions disappeared.",
        src: SRC.kaushal,
        answer: { t: "Printed prescriptions, checked against allergies", d: "Prescriptions print on your letterhead in French or Arabic, never by hand. Before one is saved, each active substance is checked against the allergies in the medical history, and you confirm before issuing it anyway." },
      },
      {
        fig: "13%",
        market: "United Kingdom · 2016",
        claim: "of junior doctors' on-call time went on searching, mostly for paperwork and equipment: about 30 minutes in every 4 hours.",
        src: SRC.pinchin,
        answer: { t: "Fewer steps to the next task", d: "From the patient list, book an appointment, write a prescription, send an e-mail or call. Ctrl+K (⌘K on a Mac) opens any page, and the calendar has its own shortcut keys." },
      },
      {
        fig: "US$6.64M",
        market: "Worldwide · 2026",
        claim: "is the average cost of a healthcare data breach, the highest of any industry for the 13th year in a row (IBM Cost of a Data Breach report).",
        src: SRC.ibm,
        answer: { t: "Encrypted where it is stored", d: "The whole database is encrypted with SQLCipher (AES-256) on your own computers, and the key stays in the computer's secure keychain. Reception does not see the medical chart by default, and every chart read is logged." },
      },
      {
        fig: "95%",
        market: "14 countries · 2024",
        claim: "of healthcare organisations hit by ransomware said the attackers tried to compromise their backups. Two in three of those attempts succeeded (Sophos survey).",
        src: SRC.sophos,
        answer: { t: "A backup every day, signed and encrypted", d: "MeDoc Dentist backs up the practice once a day by itself, compressed and encrypted with AES-256-GCM, to a USB stick or external drive if you choose. Every backup is signed: an altered or damaged one is flagged and cannot be restored." },
      },
    ],
  },
  pilot: {
    kicker: "Pilot practices",
    title: "Write the first story with us",
    text: "MeDoc Dentist is opening to its first practices. Pilot practices get the Digitalization Pack and a direct line to the people who build the software. In return we ask for honest feedback, which we will publish here, with their permission.",
    points: ["Set-up, data import and training included", "A direct line to the team that builds MeDoc Dentist", "Your feedback decides what we improve next"],
    cta: "Become a pilot practice",
  },
  pack: {
    kicker: "Digitalization Pack",
    title: "From the paper card to the screen, with us at your side",
    lead: "MeDoc Dentist puts the whole practice in one program: patients, charts, appointments, prescriptions, payments and documents. The Digitalization Pack is how we move you there, step by step, while you keep treating patients.",
    steps: [
      { t: "We look at how you work", d: "A call or a visit to understand your day, your documents and the paper files you keep today." },
      { t: "We bring your data in", d: "Patients and appointments imported from Excel or CSV, included with Cabinet and Cabinet+. From another dental program, we quote after looking at an export. Scans of your paper cards can stay with each patient." },
      { t: "We set up and train", d: "Your prices and templates in place. Remote installation and 2 hours of training with Essentiel; on-site installation with Cabinet (2 hours of training on site) and Cabinet+ (two training sessions)." },
      { t: "We stay with you", d: "Service included: 3 months with Essentiel, 6 with Cabinet, 12 with Cabinet+. After that, you choose a service plan, or none." },
    ],
    promise: "Our commitment: every practice that chooses MeDoc Dentist gets this help, whatever its edition.",
    cta: "Ask about the Digitalization Pack",
    before: "Before",
    after: "After",
    beforeAlt: "A real Moroccan paper patient card, personal details blurred.",
    afterAlt: "A dentist working in MeDoc Dentist at the computer.",
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

const fr: DigitalCopy = {
  sourceLabel: "Source",
  advantages: {
    kicker: "Pourquoi passer au numérique",
    title: "Le papier coûte cher aux cabinets, partout",
    lead: "À l'étranger, des chercheurs ont mesuré ce que coûtent le dossier papier et une sécurité des données trop faible. Ces chiffres viennent d'autres pays, chacun avec sa source. Sous chacun : ce que fait MeDoc Dentist, dans les trois éditions.",
    answerLabel: "Avec MeDoc Dentist",
    items: [
      {
        fig: "15 %",
        market: "Royaume-Uni · 2011",
        claim: "des consultations externes, dans trois hôpitaux universitaires au dossier papier, manquaient d'informations cliniques essentielles. Un patient concerné sur cinq a été exposé à un risque pour sa santé.",
        src: SRC.burnett,
        answer: { t: "Tout le patient sur un seul écran", d: "Chaque dossier s'ouvre sur un en-tête : statut, factures ouvertes, coordonnées, numéro d'assurance et mini-schéma dentaire, avec ce qui manque encore, comme l'anamnèse ou l'examen. Radios et scans restent avec le patient." },
      },
      {
        fig: "105 sur 362",
        market: "Afrique du Sud · 2023",
        claim: "dossiers dentaires sont restés introuvables lors d'un audit dans un hôpital dentaire universitaire, à cause d'un mauvais classement. Soit environ 29 %.",
        src: SRC.dentalAudit,
        answer: { t: "Chaque patient retrouvé en une recherche", d: "Recherche par nom, téléphone, e-mail ou numéro d'assurance, avec des suggestions « vouliez-vous dire » pour les noms. Plus rien à classer, plus rien à égarer." },
      },
      {
        fig: "6,6 %",
        market: "États-Unis (New York) · 2010",
        claim: "des ordonnances comportaient une erreur un an après le passage à la prescription électronique, contre 42,5 % quand les médecins écrivaient à la main. Les ordonnances illisibles ont disparu.",
        src: SRC.kaushal,
        answer: { t: "Des ordonnances imprimées et vérifiées", d: "Les ordonnances s'impriment à votre en-tête, en français ou en arabe, jamais à la main. Avant l'enregistrement, chaque substance active est comparée aux allergies de l'anamnèse, et vous confirmez avant de l'émettre malgré tout." },
      },
      {
        fig: "13 %",
        market: "Royaume-Uni · 2016",
        claim: "du temps de garde des jeunes médecins passait à chercher, surtout des papiers et du matériel : environ 30 minutes toutes les 4 heures.",
        src: SRC.pinchin,
        answer: { t: "Moins d'étapes jusqu'à la tâche suivante", d: "Depuis la liste des patients, prenez rendez-vous, rédigez une ordonnance, envoyez un e-mail ou appelez. Ctrl+K (⌘K sur Mac) ouvre n'importe quelle page, et l'agenda a ses propres raccourcis." },
      },
      {
        fig: "6,64 M$",
        market: "Monde · 2026",
        claim: "c'est le coût moyen d'une fuite de données dans la santé, le plus élevé de tous les secteurs pour la 13e année de suite (rapport IBM Cost of a Data Breach).",
        src: SRC.ibm,
        answer: { t: "Chiffré là où il est stocké", d: "Toute la base est chiffrée avec SQLCipher (AES-256) sur vos propres ordinateurs, et la clé reste dans le trousseau sécurisé de l'ordinateur. Par défaut, l'accueil ne voit pas le dossier médical, et chaque lecture est journalisée." },
      },
      {
        fig: "95 %",
        market: "14 pays · 2024",
        claim: "des établissements de santé touchés par un rançongiciel disent que les attaquants ont tenté de compromettre leurs sauvegardes. Deux tentatives sur trois ont réussi (enquête Sophos).",
        src: SRC.sophos,
        answer: { t: "Une sauvegarde par jour, signée et chiffrée", d: "MeDoc Dentist sauvegarde le cabinet une fois par jour, tout seul, en compressant puis en chiffrant en AES-256-GCM, sur une clé USB ou un disque externe si vous le souhaitez. Chaque sauvegarde est signée : une copie modifiée ou abîmée est signalée et ne peut pas être restaurée." },
      },
    ],
  },
  pilot: {
    kicker: "Cabinets pilotes",
    title: "Écrivez la première histoire avec nous",
    text: "MeDoc Dentist s'ouvre à ses premiers cabinets. Les cabinets pilotes bénéficient du Pack Digitalisation et d'une ligne directe avec ceux qui construisent le logiciel. En échange, nous leur demandons un retour honnête, que nous publierons ici avec leur accord.",
    points: ["Installation, reprise des données et formation incluses", "Une ligne directe avec l'équipe qui construit MeDoc Dentist", "Vos retours décident de nos prochaines améliorations"],
    cta: "Devenir cabinet pilote",
  },
  pack: {
    kicker: "Pack Digitalisation",
    title: "De la fiche papier à l'écran, avec nous à vos côtés",
    lead: "MeDoc Dentist réunit tout le cabinet dans un seul logiciel : patients, schémas, rendez-vous, ordonnances, encaissements et documents. Le Pack Digitalisation, c'est notre façon de vous y amener, étape par étape, pendant que vous continuez à soigner.",
    steps: [
      { t: "Nous regardons comment vous travaillez", d: "Un appel ou une visite pour comprendre votre journée, vos documents et les fiches papier que vous tenez aujourd'hui." },
      { t: "Nous reprenons vos données", d: "Patients et rendez-vous importés depuis Excel ou CSV, inclus avec Cabinet et Cabinet+. Depuis un autre logiciel dentaire, nous chiffrons la reprise après examen d'un export. Les scans de vos fiches papier peuvent rester avec chaque patient." },
      { t: "Nous installons et formons", d: "Vos tarifs et modèles en place. Installation à distance et 2 h de formation avec Essentiel ; installation sur place avec Cabinet (2 h de formation sur place) et Cabinet+ (deux sessions de formation)." },
      { t: "Nous restons avec vous", d: "Service inclus : 3 mois avec Essentiel, 6 avec Cabinet, 12 avec Cabinet+. Ensuite, vous choisissez un forfait de service, ou aucun." },
    ],
    promise: "Notre engagement : chaque cabinet qui choisit MeDoc Dentist reçoit cette aide, quelle que soit son édition.",
    cta: "Demander le Pack Digitalisation",
    before: "Avant",
    after: "Après",
    beforeAlt: "Une vraie fiche patient papier marocaine, données personnelles floutées.",
    afterAlt: "Un dentiste travaille dans MeDoc Dentist sur son ordinateur.",
  },
  morocco: {
    facts: {
      kicker: "Ce qui change",
      title: "Les faits, avec leurs sources",
      lead: "Lois, projets de loi et chiffres tels qu'ils sont publiés. Le projet de loi 52-26 n'est pas encore adopté, et nous le disons partout où il apparaît.",
      items: [
        { topic: "Cabinets dentaires", fig: "6 552", text: "cabinets dentaires privés au Maroc en 2025, et 458 dentistes dans le secteur public, selon la carte sanitaire du ministère de la Santé et de la Protection sociale.", src: SRC.dentists },
        { topic: "Maroc Digital 2030", fig: "1,7 Md DH", text: "d'investissement public dans le numérique en 2024, contre 11 millions de DH en 2021. La stratégie nationale fait du numérique un moteur de compétitivité et d'inclusion sociale.", src: SRC.digital2030 },
        { topic: "Assurance maladie (AMO)", fig: "32 millions", text: "de bénéficiaires de l'assurance maladie obligatoire en 2025, soit 88 % de la population, contre 42 % avant la généralisation. Plus de patients assurés, c'est plus de numéros d'assurance à enregistrer.", src: SRC.amo },
        { topic: "Projet de loi 52-26", status: "Pas encore adopté", fig: "Jusqu'à 300 000 DH", text: "d'amende rapportés pour un professionnel qui ne met pas à jour le dossier médical partagé d'un patient, ou un établissement qui ne connecte pas son système. Déposé au Parlement le 31 juillet 2026, le projet prévoit un dossier partagé par patient, mis à jour après chaque consultation ou acte. Les établissements auraient 24 mois pour se connecter après publication des règles techniques.", src: SRC.bill5226 },
        { topic: "Loi 09-08 et CNDP", status: "En vigueur", fig: "Jusqu'à 200 000 DH", text: "d'amende, ou 3 mois à 1 an de prison, ou les deux, pour un traitement de données personnelles sans les mesures de sécurité exigées par la loi (art. 58). Les données de santé sont des données sensibles ; les traiter sans le consentement exprès du patient expose à une amende de 50 000 à 300 000 DH (art. 57).", src: SRC.law0908 },
        { topic: "Fuite de la CNSS, avril 2025", fig: "Près de 2 millions", text: "de personnes ont vu leurs informations exposées après le vol présumé de plus de 54 000 fichiers à la Caisse nationale de sécurité sociale, selon les médias marocains. Les données de santé et sociales sont aussi une cible au Maroc.", src: SRC.cnss },
      ],
      note: "Chiffres tels que publiés par les sources citées. Le projet de loi 52-26 peut encore changer avant son adoption.",
    },
    ready: {
      kicker: "MeDoc Dentist",
      title: "Comment MeDoc Dentist prépare votre cabinet",
      lead: "Ce que contient le logiciel aujourd'hui. Chaque point vaut pour les trois éditions, sauf si une édition est nommée.",
      items: [
        { t: "Chiffré sur vos propres ordinateurs", d: "Toute la base est chiffrée avec SQLCipher (AES-256), et la clé reste dans le trousseau sécurisé de l'ordinateur. Les données patients ne partent pas dans un cloud." },
        { t: "Chacun voit ce dont son métier a besoin", d: "L'accueil (Cabinet et Cabinet+) et le compte invité (Essentiel) ne voient pas les diagnostics ni les constats cliniques, sauf si vous l'autorisez. Le logiciel l'impose, pas seulement l'écran." },
        { t: "Un journal qui révèle les retouches", d: "Créations et modifications de dossiers, validations, exports et chaque lecture d'un dossier médical sont journalisés. Chaque entrée est chaînée à la précédente par un HMAC : une entrée modifiée ou supprimée est détectée." },
        { t: "Des documents marocains", d: "Factures avec votre ICE, IF et TP (et RC, CNSS et INPE), une numérotation sans trou, la mention d'exonération de TVA des actes médicaux et le total en lettres, en français ou en arabe. Pas de facture sans ICE ni IF. Ordonnances et certificats à votre en-tête, avec votre INPE." },
        { t: "Une sauvegarde chaque jour", d: "Une fois par jour, toute seule : compressée et chiffrée en AES-256-GCM, sur une clé USB ou un disque externe si vous le souhaitez, radios et scans compris. Chaque sauvegarde est signée : une copie modifiée ne peut pas être restaurée." },
        { t: "Des dossiers structurés", d: "Patients, numéros d'assurance, schéma dentaire, soins, ordonnances et factures sont des données structurées, pas du papier scanné. L'en-tête du dossier signale ce qui manque, comme le numéro d'assurance." },
      ],
      notYetTitle: "Pas dans MeDoc Dentist aujourd'hui",
      notYet: [
        "La connexion au dossier médical partagé du projet de loi 52-26 : ses règles techniques ne sont pas publiées",
        "Les feuilles de soins AMO, CNSS et CNOPS",
        "Une nomenclature NGAP intégrée : vous saisissez vos propres codes d'actes",
        "L'ordonnance électronique",
      ],
      cndp: "La déclaration à la CNDP reste à la charge du cabinet. Le forfait Premium inclut une aide pour votre dossier CNDP.",
      cta: "Réserver une démo gratuite",
    },
  },
  europe: {
    text: "Aujourd'hui, MeDoc Dentist est vendu aux cabinets dentaires du Maroc uniquement, avec des documents marocains et des prix en dirhams. Vous exercez en Europe ? Écrivez-nous au sujet de votre cabinet.",
    cta: "Nous écrire",
  },
};

const ar: DigitalCopy = {
  sourceLabel: "المصدر",
  advantages: {
    kicker: "لماذا الانتقال إلى الرقمي",
    title: "الورق يكلّف العيادات في كل مكان",
    lead: "قاس باحثون في بلدان أخرى ما يكلّفه الملف الورقي وضعف حماية البيانات. هذه الأرقام من خارج المغرب، ولكل منها مصدره. وتحت كل رقم: ما يفعله MeDoc Dentist، في الإصدارات الثلاثة.",
    answerLabel: "مع MeDoc Dentist",
    items: [
      {
        fig: "15%",
        market: "المملكة المتحدة · 2011",
        claim: "من الاستشارات الخارجية في ثلاثة مستشفيات جامعية تعمل بالملف الورقي كانت تنقصها معلومات سريرية أساسية. وتعرّض مريض من كل خمسة منهم لخطر على صحته.",
        src: SRC.burnett,
        answer: { t: "المريض كله في شاشة واحدة", d: "يُفتح كل ملف على ترويسة واحدة: الحالة، والفواتير غير المسدّدة، ووسائل الاتصال، ورقم التأمين، ومخطط أسنان مصغّر، مع ما لا يزال ناقصًا مثل السوابق المرضية أو الفحص. وتبقى الصور الشعاعية والوثائق الممسوحة مع المريض." },
      },
      {
        fig: "105 من 362",
        market: "جنوب أفريقيا · 2023",
        claim: "ملفًا لطب الأسنان تعذّر العثور عليها أثناء تدقيق في مستشفى جامعي لطب الأسنان، بسبب سوء نظام الحفظ. أي نحو 29%.",
        src: SRC.dentalAudit,
        answer: { t: "كل مريض في بحث واحد", d: "ابحث بالاسم أو الهاتف أو البريد الإلكتروني أو رقم التأمين، مع اقتراحات «هل تقصد» للأسماء. لا شيء يُرتَّب، ولا شيء يضيع." },
      },
      {
        fig: "6.6%",
        market: "الولايات المتحدة (نيويورك) · 2010",
        claim: "من الوصفات كانت فيها أخطاء بعد سنة من الانتقال إلى الوصفة الإلكترونية، مقابل 42.5% حين كان الأطباء يكتبونها باليد. واختفت الوصفات غير المقروءة.",
        src: SRC.kaushal,
        answer: { t: "وصفات مطبوعة ومراجَعة", d: "تُطبع الوصفات بترويسة عيادتك، بالفرنسية أو العربية، لا بخط اليد. وقبل حفظ الوصفة، تُقارَن كل مادة فعّالة بالحساسية المسجّلة في السوابق المرضية، وتؤكّد قبل إصدارها رغم ذلك." },
      },
      {
        fig: "13%",
        market: "المملكة المتحدة · 2016",
        claim: "من وقت مناوبة الأطباء الشباب ضاع في البحث، وأغلبه عن الأوراق والمعدّات: نحو 30 دقيقة في كل 4 ساعات.",
        src: SRC.pinchin,
        answer: { t: "خطوات أقل إلى المهمة التالية", d: "من قائمة المرضى، احجز موعدًا أو اكتب وصفة أو أرسل بريدًا أو اتصل. ويفتح Ctrl+K (أو ⌘K على Mac) أي صفحة، ولجدول المواعيد اختصاراته الخاصة." },
      },
      {
        fig: "6.64 مليون دولار",
        market: "العالم · 2026",
        claim: "هو متوسط كلفة تسريب البيانات في قطاع الصحة، وهو الأعلى بين كل القطاعات للسنة الثالثة عشرة على التوالي (تقرير IBM عن كلفة تسريب البيانات).",
        src: SRC.ibm,
        answer: { t: "مشفّر حيث يُحفظ", d: "قاعدة البيانات كلها مشفّرة بـ SQLCipher (AES-256) على حواسيبك الخاصة، ويبقى المفتاح في سلسلة المفاتيح الآمنة للحاسوب. ولا يرى الاستقبال الملف الطبي افتراضيًا، وتُسجَّل كل قراءة له." },
      },
      {
        fig: "95%",
        market: "14 دولة · 2024",
        claim: "من المؤسسات الصحية التي أصابها برنامج فدية قالت إن المهاجمين حاولوا اختراق نسخها الاحتياطية، ونجحت محاولتان من كل ثلاث (استطلاع Sophos).",
        src: SRC.sophos,
        answer: { t: "نسخة احتياطية كل يوم، موقّعة ومشفّرة", d: "ينسخ MeDoc Dentist بيانات العيادة مرة في اليوم من تلقاء نفسه، فيضغطها ثم يشفّرها بـ AES-256-GCM، على مفتاح USB أو قرص خارجي إن أردت. وكل نسخة موقّعة: النسخة المعدَّلة أو التالفة يُنبَّه إليها ولا يمكن استرجاعها." },
      },
    ],
  },
  pilot: {
    kicker: "العيادات الرائدة",
    title: "اكتب القصة الأولى معنا",
    text: "يفتح MeDoc Dentist أبوابه لعياداته الأولى. تحصل العيادات الرائدة على باقة الرقمنة وعلى خط مباشر مع من يبنون البرنامج. وفي المقابل نطلب منها رأيًا صادقًا، سننشره هنا بموافقتها.",
    points: ["التثبيت ونقل البيانات والتدريب مشمولة", "خط مباشر مع الفريق الذي يبني MeDoc Dentist", "رأيك يحدد ما نحسّنه بعد ذلك"],
    cta: "انضمّ كعيادة رائدة",
  },
  pack: {
    kicker: "باقة الرقمنة",
    title: "من البطاقة الورقية إلى الشاشة، ونحن إلى جانبك",
    lead: "يجمع MeDoc Dentist العيادة كلها في برنامج واحد: المرضى، والمخططات، والمواعيد، والوصفات، والمدفوعات، والوثائق. وباقة الرقمنة هي طريقتنا لنوصلك إلى ذلك خطوة بخطوة، بينما تواصل علاج مرضاك.",
    steps: [
      { t: "ندرس طريقة عملك", d: "مكالمة أو زيارة لفهم يومك ووثائقك والبطاقات الورقية التي تحتفظ بها اليوم." },
      { t: "ننقل بياناتك", d: "استيراد المرضى والمواعيد من Excel أو CSV، مشمول مع Cabinet وCabinet+. ومن برنامج أسنان آخر، نقدّم عرض سعر بعد فحص ملف التصدير. ويمكن أن تبقى صور بطاقاتك الورقية الممسوحة مع ملف كل مريض." },
      { t: "نثبّت وندرّب", d: "أسعارك ونماذجك جاهزة. تثبيت عن بُعد وساعتان من التدريب مع Essentiel، وتثبيت في العيادة مع Cabinet (ساعتان من التدريب في العيادة) ومع Cabinet+ (جلستا تدريب)." },
      { t: "نبقى معك", d: "الخدمة مشمولة: 3 أشهر مع Essentiel، و6 مع Cabinet، و12 مع Cabinet+. وبعدها تختار باقة خدمة، أو لا شيء." },
    ],
    promise: "التزامنا: كل عيادة تختار MeDoc Dentist تحصل على هذه المساعدة، مهما كان إصدارها.",
    cta: "اطلب باقة الرقمنة",
    before: "قبل",
    after: "بعد",
    beforeAlt: "بطاقة مريض ورقية مغربية حقيقية، مع إخفاء المعطيات الشخصية.",
    afterAlt: "طبيب أسنان يعمل على MeDoc Dentist أمام الحاسوب.",
  },
  morocco: {
    facts: {
      kicker: "ما الذي يتغيّر",
      title: "الوقائع، مع مصادرها",
      lead: "قوانين ومشاريع قوانين وأرقام كما نُشرت. مشروع القانون 52-26 ليس قانونًا بعد، ونذكر ذلك أينما ورد.",
      items: [
        { topic: "عيادات الأسنان", fig: "6.552", text: "عيادة خاصة لطب الأسنان في المغرب سنة 2025، و458 طبيب أسنان في القطاع العام، حسب الخريطة الصحية لوزارة الصحة والحماية الاجتماعية.", src: SRC.dentists },
        { topic: "المغرب الرقمي 2030", fig: "1,7 مليار درهم", text: "استثمار عمومي في الرقمي سنة 2024، مقابل 11 مليون درهم سنة 2021. وتجعل الاستراتيجية الوطنية من الرقمي محرّكًا للتنافسية والإدماج الاجتماعي.", src: SRC.digital2030 },
        { topic: "التأمين الإجباري عن المرض (AMO)", fig: "32 مليون", text: "مستفيد من التأمين الإجباري عن المرض سنة 2025، أي 88% من السكان، مقابل 42% قبل التعميم. ومزيد من المرضى المؤمَّنين يعني مزيدًا من أرقام التأمين التي يجب تسجيلها.", src: SRC.amo },
        { topic: "مشروع القانون 52-26", status: "ليس قانونًا بعد", fig: "حتى 300.000 درهم", text: "غرامة أوردتها التقارير بحق المهني الذي لا يحدّث الملف الطبي المشترك للمريض، أو المؤسسة التي لا تربط نظامها. أُودع المشروع لدى البرلمان في 31 يوليوز 2026، ويقترح ملفًا مشتركًا لكل مريض يُحدَّث بعد كل استشارة أو إجراء. وستكون أمام المؤسسات 24 شهرًا للربط بعد نشر القواعد التقنية.", src: SRC.bill5226 },
        { topic: "القانون 09-08 واللجنة الوطنية", status: "ساري المفعول", fig: "حتى 200.000 درهم", text: "غرامة، أو حبس من 3 أشهر إلى سنة، أو هما معًا، لمعالجة معطيات شخصية دون تدابير الأمان التي يفرضها القانون (المادة 58). والمعطيات الصحية معطيات حساسة، ومعالجتها دون الموافقة الصريحة للمريض تعرّض لغرامة من 50.000 إلى 300.000 درهم (المادة 57).", src: SRC.law0908 },
        { topic: "تسريب بيانات CNSS، أبريل 2025", fig: "قرابة 2 مليون", text: "شخص كُشفت معلوماتهم بعد سرقة مزعومة لأكثر من 54.000 ملف من الصندوق الوطني للضمان الاجتماعي، حسب وسائل الإعلام المغربية. المعطيات الصحية والاجتماعية مستهدفة في المغرب أيضًا.", src: SRC.cnss },
      ],
      note: "الأرقام كما نشرتها المصادر المذكورة. وقد يتغيّر مشروع القانون 52-26 قبل أن يصبح قانونًا.",
    },
    ready: {
      kicker: "MeDoc Dentist",
      title: "كيف يُعدّ MeDoc Dentist عيادتك",
      lead: "ما يتضمّنه البرنامج اليوم. كل نقطة تخص الإصدارات الثلاثة، ما لم يُذكر إصدار بعينه.",
      items: [
        { t: "مشفّر على حواسيبك الخاصة", d: "قاعدة البيانات كلها مشفّرة بـ SQLCipher (AES-256)، ويبقى المفتاح في سلسلة المفاتيح الآمنة للحاسوب. ولا تُرسَل بيانات المرضى إلى أي سحابة." },
        { t: "كل شخص يرى ما يحتاجه عمله", d: "لا يرى الاستقبال (Cabinet وCabinet+) ولا حساب الضيف (Essentiel) التشخيصات والملاحظات السريرية، إلا إذا سمحت بذلك. والبرنامج نفسه يفرض ذلك، لا الشاشة فقط." },
        { t: "سجل يكشف أي تلاعب", d: "إنشاء الملفات وتعديلها، والمصادقات، والتصديرات، وكل قراءة لملف طبي، كلها تُسجَّل. وكل مدخل مربوط بالذي قبله بـ HMAC، فيُكتشف أي مدخل عُدّل أو حُذف." },
        { t: "وثائق مغربية", d: "فواتير بأرقام ICE وIF وTP (وRC وCNSS وINPE)، وترقيم متسلسل دون فجوات، وإشارة إعفاء الأعمال الطبية من الضريبة على القيمة المضافة، والمبلغ بالحروف، بالفرنسية أو العربية. لا فاتورة دون ICE وIF. ووصفات وشهادات بترويسة عيادتك مع رقم INPE الخاص بك." },
        { t: "نسخة احتياطية كل يوم", d: "مرة في اليوم من تلقاء نفسها: مضغوطة ومشفّرة بـ AES-256-GCM، على مفتاح USB أو قرص خارجي إن أردت، مع الصور الشعاعية والوثائق الممسوحة. وكل نسخة موقّعة، فلا يمكن استرجاع نسخة معدَّلة." },
        { t: "ملفات منظّمة", d: "المرضى، وأرقام التأمين، ومخطط الأسنان، والعلاجات، والوصفات، والفواتير بيانات منظّمة، لا أوراق ممسوحة. وتُنبّه ترويسة الملف إلى ما ينقص، مثل رقم التأمين." },
      ],
      notYetTitle: "غير متوفر في MeDoc Dentist اليوم",
      notYet: [
        "الربط بالملف الطبي المشترك لمشروع القانون 52-26: قواعده التقنية لم تُنشر بعد",
        "أوراق العلاج للتأمين AMO وCNSS وCNOPS",
        "لائحة أعمال NGAP مدمجة: تُدخل رموز أعمالك بنفسك",
        "الوصفة الإلكترونية",
      ],
      cndp: "يبقى التصريح لدى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي من مسؤولية العيادة. وتشمل باقة Premium المساعدة في ملفك لدى اللجنة.",
      cta: "احجز عرضًا مجانيًا",
    },
  },
  europe: {
    text: "يُباع MeDoc Dentist اليوم لعيادات طب الأسنان في المغرب فقط، بوثائق مغربية وأسعار بالدرهم. هل تمارس في أوروبا؟ راسلنا عن عيادتك.",
    cta: "راسلنا",
  },
};

export const DIGITAL_COPY: Record<Lang, DigitalCopy> = { en, fr, ar };
