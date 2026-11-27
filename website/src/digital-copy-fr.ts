import type { DigitalCopy } from "./digital-copy";
import { SRC } from "./digital-sources";

/** French copy for digital-copy.ts. */
export const fr: DigitalCopy = {
  sourceLabel: "Source",
  series: {
    kicker: "Série MeDoc",
    title: "Une famille de logiciels de cabinet",
    lead: "MeDoc Dentist est le premier produit MeDoc en vente. Chaque programme MeDoc partage le même socle sécurisé, garde les données dans le cabinet, et s'accompagne de personnes qui aident à quitter le papier.",
    more: "À propos de la série MeDoc",
    items: [
      { t: "Un socle sécurisé", d: "Chiffrement, rôles, journal d'audit, sync, licences et sauvegardes sont construits une fois et partagés." },
      { t: "Une seule équipe", d: "Ceux qui écrivent MeDoc sont ceux qui l'installent, vous forment et répondent à vos questions." },
      { t: "Fait pour chaque spécialité", d: "Chaque programme suit une spécialité. Les dentistes viennent en premier." },
      { t: "Vendu seulement quand prêt", d: "Nous vendons un programme MeDoc seulement quand il est prêt pour un vrai cabinet. Pas de dates avant." },
    ],
  },
  moroccoStrip: {
    kicker: "Maroc",
    title: "Le Maroc passe au numérique. Les cabinets doivent être prêts.",
    lead: "Chiffres cités sur les cabinets dentaires et Maroc Digital 2030. Sources complètes sur la page Maroc.",
    more: "Comment MeDoc Dentist prépare un cabinet",
    items: [
      { fig: "6 552", label: "Cabinets dentaires privés au Maroc en 2025 (carte sanitaire).", src: SRC.dentists },
      { fig: "88 %", label: "De la population couverte par l'AMO en 2025.", src: SRC.amo },
      { fig: "1,7 Md DH", label: "Investissement public dans le numérique en 2024, contre 11 millions en 2021.", src: SRC.digital2030 },
      { fig: "24 mois", label: "Délai de connexion prévu si le projet de loi 52-26 est adopté tel quel (pas encore la loi).", src: SRC.bill5226 },
    ],
  },
  ways: {
    kicker: "Dans le produit aujourd'hui",
    title: "10 façons dont MeDoc Dentist simplifie la journée",
    lead: "Dix actions possibles dans la version actuelle. Chacune ouvre la fonction complète avec ses écrans. Quand seules certaines éditions l'incluent, nous le disons.",
    more: "Voir les douze fonctionnalités",
    items: [
      {
        k: "01",
        to: "changes",
        t: "Rien n'entre dans le dossier sans votre accord",
        d: "Cabinet et Cabinet+ : l'accueil vous remet un dossier à valider ou refuser. Essentiel : les rendez-vous, patients et paiements en espèces d'un invité attendent dans votre boîte jusqu'à Ajouter ou Écarter.",
        ed: "Toutes les éditions · remises différentes",
      },
      {
        k: "02",
        to: "day-close",
        t: "Clôturez la journée avec deux chiffres",
        d: "Saisissez les espèces comptées et, si vous en avez un, le total du terminal carte. MeDoc totalise les encaissements du jour et demande un motif avant d'accepter un écart.",
        ed: "Cabinet et Cabinet+",
      },
      {
        k: "03",
        to: "calendar",
        t: "Déplacez un rendez-vous à la souris",
        d: "Glissez vers une autre heure ou un autre jour. MeDoc se cale sur les horaires, décale les créneaux suivants de ce médecin, refuse les doubles réservations et vous laisse Annuler.",
      },
      {
        k: "04",
        to: "flags",
        t: "Repérez les erreurs pendant que vous travaillez",
        d: "Doubles réservations et créneaux fermés sont refusés. Une ordonnance est comparée aux allergies enregistrées avant émission. L'en-tête patient montre ce qui manque encore.",
      },
      {
        k: "05",
        to: "statistics",
        t: "Sachez où en est le mois",
        d: "Patients, rendez-vous, soins et recettes tirés de vos dossiers, chacun avec l'évolution par rapport au mois précédent. Aucun objectif inventé.",
      },
      {
        k: "06",
        to: "patients",
        t: "Tout le patient dans un en-tête",
        d: "Statut, facture ouverte, âge, téléphone, assurance, adresse et mini-schéma dentaire d'un coup. Recherche par nom, téléphone, e-mail ou numéro d'assurance ; une faute obtient une suggestion.",
      },
      {
        k: "07",
        to: "tasks",
        t: "Envoyez une tâche au lieu d'interrompre l'accueil",
        d: "Depuis le dossier patient, envoyez le travail à tout l'accueil ou à une personne. Cela arrive dans leur liste et leur cloche pendant que vous restez avec le patient.",
        ed: "Cabinet et Cabinet+",
      },
      {
        k: "08",
        to: "status-rules",
        t: "Chaque dossier suit des étapes claires",
        d: "Rendez-vous, patients, dossiers, paiements et commandes ont des statuts fixes et des étapes suivantes autorisées. MeDoc refuse un retour en arrière.",
      },
      {
        k: "09",
        to: "backups",
        t: "Une sauvegarde par jour, signée et chiffrée",
        d: "Une sauvegarde automatique par jour tant que MeDoc est ouvert, compressée et chiffrée (AES-256-GCM). Une copie altérée est signalée et ne peut pas être restaurée.",
      },
      {
        k: "10",
        to: "tooth-chart",
        t: "Un schéma dentaire lisible d'un coup d'œil",
        d: "Les 32 dents permanentes dans l'ordre FDI, avec des contours distincts et une couleur par statut. Cliquez une dent, choisissez un constat, continuez à soigner.",
      },
    ],
  },
  whyNow: {
    kicker: "Pourquoi maintenant",
    title: "Le projet de loi 52-26 arrive. Votre cabinet est-il prêt ?",
    lead: "Le projet devant le Parlement (pas encore la loi) donnerait à chaque patient un dossier médical partagé, mis à jour après chaque visite. Les rapports citent des amendes jusqu'à 300 000 DH et 24 mois pour que les établissements se connectent une fois les règles techniques publiées. La loi 09-08 exige déjà sécurité et consentement pour les données de santé.",
    cta: "Comment MeDoc Dentist prépare un cabinet",
  },
  pilot: {
    kicker: "Cabinets pilotes",
    title: "Écrivez la première histoire avec nous",
    text: "MeDoc Dentist s'ouvre à ses premiers cabinets. Les cabinets pilotes bénéficient d'une aide à l'installation et d'une ligne directe avec ceux qui construisent le logiciel. En échange, nous leur demandons un retour honnête, que nous publierons ici avec leur accord.",
    points: ["Installation, reprise des données et formation incluses", "Une ligne directe avec l'équipe qui construit MeDoc Dentist", "Vos retours décident de nos prochaines améliorations"],
    cta: "Devenir cabinet pilote",
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
