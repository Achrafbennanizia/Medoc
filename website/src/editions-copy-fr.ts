import type { EditionsCopy } from "./editions-copy";
import { ALL, PLUS, TEAM } from "./edition-sets";

/** French copy for editions-copy.ts. */
export const fr: EditionsCopy = {
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
