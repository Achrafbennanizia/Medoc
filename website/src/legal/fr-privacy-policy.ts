import type { LegalDocument } from "./types";
import { UPDATED } from "./updated";

/** Privacy policy (fr), part of LEGAL_FR in fr.ts. */
export const FR_PRIVACY_POLICY: LegalDocument = {
  title: "Politique de confidentialité",
  summary: "Le texte complet sur la manière dont {company} traite les données personnelles des visiteurs du site, des prospects et des clients, et sur son rôle à l’égard du logiciel MeDoc Dentist, conformément à la loi n° 09-08.",
  updated: UPDATED,
  sections: [
    {
      id: "controller",
      title: "Responsable du traitement et contact",
      blocks: [
        {
          kind: "facts",
          rows: [
            ["Responsable du traitement", "{company}, {legalForm}"],
            ["Adresse", "{address}, {country}"],
            ["Représentant légal", "{director}"],
            ["Contact pour la protection des données", "{dpoContact}"],
            ["Déclaration auprès de la CNDP", "« [Numéro du récépissé de déclaration auprès de la CNDP] », communiqué sur demande"],
          ],
        },
        {
          kind: "p",
          text: "La présente politique applique la loi n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel et ses textes d’application.",
        },
      ],
    },
    {
      id: "website",
      title: "Consultation du site",
      blocks: [
        {
          kind: "p",
          text: "Le site est statique et ne comporte pas de comptes utilisateurs. Il n’utilise aucun outil de mesure d’audience, de publicité ou de suivi, et ne dépose que les cookies nécessaires décrits ci-dessous.",
        },
        {
          kind: "list",
          items: [
            "Préférences d’affichage : la langue et le thème clair ou sombre sont enregistrés dans des cookies propres au site (medoc_lang et medoc_theme, pour 12 mois), uniquement lorsque vous les choisissez, et ne nous sont pas transmis. Le cookie medoc_cookie_notice retient que vous avez fermé l’avis relatif aux cookies. Vous pouvez supprimer ces cookies depuis les réglages de votre navigateur.",
            "Polices de caractères : elles sont hébergées sur le serveur du site ; votre adresse IP n’est donc transmise à aucun fournisseur de polices externe.",
            "Journaux du serveur : l’hébergeur {hostingProvider} enregistre l’adresse IP, l’heure de la requête et la page demandée, afin d’assurer la sécurité et le bon fonctionnement du site, sur le fondement de l’intérêt légitime (article 4 de la loi n° 09-08). Ces journaux sont conservés pendant une courte durée, qui n’excède pas ce qu’exige cette finalité.",
          ],
        },
      ],
    },
    {
      id: "demo-whatsapp",
      title: "Demande de démonstration et lien WhatsApp",
      blocks: [
        {
          kind: "p",
          text: "Le formulaire de demande de démonstration transmet vos données par une connexion chiffrée à notre serveur sifralabs.com (Cloudflare), qui les livre par courrier électronique à {email} via Cloudflare Email Sending. Le serveur n’en conserve aucune copie. S’il est injoignable, votre logiciel de messagerie s’ouvre à la place avec un message prérempli.",
        },
        {
          kind: "p",
          text: "Le lien WhatsApp est facultatif. Si vous l’utilisez, la société Meta traite vos données selon sa propre politique, ce qui peut entraîner un transfert de données hors du Maroc. Cela ne se produit que si vous choisissez d’utiliser ce lien.",
        },
      ],
    },
    {
      id: "prospects-customers",
      title: "Prospects et clients : finalités et fondements juridiques",
      blocks: [
        {
          kind: "p",
          text: "Nous traitons les données des personnes qui nous contactent ou qui représentent un cabinet client : nom, fonction, nom du cabinet, adresse électronique, téléphone, adresse, données de facturation (ICE, IF) et contenu des échanges.",
        },
        {
          kind: "list",
          items: [
            "Répondre aux demandes et établir les offres : exécution de mesures précontractuelles prises à votre demande (article 4 de la loi n° 09-08).",
            "Exécuter le contrat : livraison, installation, assistance, mises à jour et gestion du compte client (exécution du contrat).",
            "Facturation et comptabilité : respect des obligations légales, notamment de l’article 145 du Code général des impôts et du Code de commerce (obligation légale).",
            "Suivi de la relation commerciale, amélioration du service et défense de nos droits en cas de litige (intérêt légitime).",
            "Envoi par courrier électronique d’informations commerciales sur nos produits à des personnes qui ne sont pas clientes : uniquement avec votre consentement, que vous pouvez retirer à tout moment.",
          ],
        },
      ],
    },
    {
      id: "software",
      title: "Le logiciel MeDoc Dentist : qui fait quoi",
      blocks: [
        {
          kind: "p",
          text: "MeDoc Dentist est un logiciel de gestion et de documentation installé sur les ordinateurs du cabinet. Les données des patients (dossier, schéma dentaire, rendez-vous, ordonnances, certificats, factures) sont conservées chiffrées (SQLCipher / AES-256) sur ces ordinateurs. Dans les éditions Cabinet et Cabinet+, elles ne sont synchronisées qu’entre les appareils du cabinet, au sein de son réseau local.",
        },
        {
          kind: "list",
          items: [
            "Le cabinet est responsable du traitement des données de ses patients. Il lui appartient d’accomplir auprès de la CNDP les formalités préalables relatives aux données de santé, conformément aux articles 12 et 21 de la loi n° 09-08.",
            "{company} n’héberge pas les données des patients, ne les transfère pas à l’étranger et n’y accède pas lors de l’utilisation normale du logiciel.",
            "Nous n’accédons aux données des patients que dans deux cas : lorsque le cabinet partage son écran pendant une session d’assistance, ou lorsqu’il nous remet une sauvegarde pour analyse. Dans ces deux cas, nous agissons en qualité de sous-traitant au sens de l’article 24 de la loi n° 09-08, sur instruction du cabinet et en vertu d’un contrat écrit.",
            "Vérification des mises à jour : le logiciel contacte le serveur de mises à jour et ne transmet que le numéro de version, sans aucune donnée relative aux patients.",
          ],
        },
      ],
    },
    {
      id: "security",
      title: "Sécurité des données et secret professionnel",
      blocks: [
        {
          kind: "p",
          text: "Conformément à l’article 23 de la loi n° 09-08, nous prenons les mesures techniques et organisationnelles appropriées pour protéger les données contre la destruction, la perte ou l’accès non autorisé.",
        },
        {
          kind: "list",
          items: [
            "Chiffrement de la base de données du logiciel sur les ordinateurs (SQLCipher / AES-256).",
            "Synchronisation limitée au réseau local du cabinet (éditions Cabinet et Cabinet+).",
            "Accès de l’équipe d’assistance limité au strict nécessaire, et suppression des sauvegardes remises pour analyse à la fin de la mission.",
            "Engagement de confidentialité de notre personnel et respect du secret professionnel prévu à l’article 446 du Code pénal pour les données médicales.",
          ],
        },
      ],
    },
    {
      id: "recipients",
      title: "Destinataires et sous-traitants",
      blocks: [
        {
          kind: "p",
          text: "Seul le personnel habilité de {company} a accès à vos données, dans la limite de ses fonctions. Nous faisons appel à des sous-traitants qui traitent les données pour notre compte et selon nos instructions, notamment :",
        },
        {
          kind: "list",
          items: [
            "l’hébergeur du site : {hostingProvider} ;",
            "notre fournisseur de messagerie électronique ;",
            "le comptable ou l’expert-comptable, ainsi que les établissements bancaires pour le traitement des paiements.",
          ],
        },
        {
          kind: "p",
          text: "Nous pouvons communiquer les données aux autorités administratives ou judiciaires lorsque la loi nous y oblige. Nous ne vendons ni ne louons les données.",
        },
      ],
    },
    {
      id: "transfers",
      title: "Transferts à l’étranger",
      blocks: [
        {
          kind: "p",
          text: "En principe, nous ne transférons aucune donnée personnelle hors du Maroc. Si cela devenait nécessaire, le transfert ne serait effectué que dans le respect des articles 43 et 44 de la loi n° 09-08, c’est-à-dire vers un État assurant un niveau de protection suffisant, avec l’autorisation de la CNDP ou dans l’un des cas dérogatoires prévus par la loi. Nous mettrions à jour la présente politique au préalable.",
        },
        {
          kind: "p",
          text: "Fait exception votre utilisation facultative du lien WhatsApp, pour laquelle la société Meta est responsable de son propre traitement.",
        },
      ],
    },
    {
      id: "retention",
      title: "Durées de conservation",
      blocks: [
        {
          kind: "list",
          items: [
            "Journaux du serveur : courte durée, à des fins de sécurité.",
            "Échanges avec les prospects qui n’ont pas contracté : trois ans au plus après le dernier contact.",
            "Données des clients : pendant toute la durée de la relation contractuelle, puis pendant le délai de prescription applicable, à des fins de preuve.",
            "Factures et documents comptables : dix ans, conformément à l’article 22 du Code de commerce.",
            "Sauvegardes remises pour analyse : supprimées dès la fin de l’analyse.",
          ],
        },
      ],
    },
    {
      id: "rights",
      title: "Vos droits et leur exercice",
      blocks: [
        {
          kind: "list",
          items: [
            "Droit à l’information (article 5) : connaître l’identité du responsable du traitement, les finalités du traitement, ses destinataires et vos droits. C’est l’objet de la présente politique.",
            "Droit d’accès (article 7) : obtenir la confirmation que des données vous concernant sont traitées et en recevoir une copie.",
            "Droit de rectification (article 8) : faire rectifier, compléter, mettre à jour ou effacer les données inexactes ou incomplètes.",
            "Droit d’opposition (article 9) : vous opposer, pour des motifs légitimes, au traitement de vos données, et vous opposer, sans avoir à vous justifier, à leur utilisation à des fins de prospection commerciale.",
          ],
        },
        {
          kind: "p",
          text: "Pour exercer vos droits, écrivez-nous à {dpoContact} ou par courrier à l’adresse {address}. Nous pouvons vous demander de justifier de votre identité en cas de doute raisonnable. Nous répondons dans les meilleurs délais et dans la limite des délais prévus par la loi.",
        },
        {
          kind: "p",
          text: "Si votre demande porte sur les données d’un patient enregistrées dans le logiciel MeDoc Dentist, le cabinet est responsable du traitement : adressez-vous directement à lui. Nous l’aiderons à répondre s’il le demande.",
        },
      ],
    },
    {
      id: "complaint",
      title: "Plainte auprès de la CNDP",
      blocks: [
        {
          kind: "p",
          text: "Si vous estimez que vos droits n’ont pas été respectés, vous pouvez adresser une plainte à la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP). Vous pouvez aussi nous contacter d’abord pour tenter de trouver une solution.",
        },
      ],
    },
    {
      id: "changes",
      title: "Modification de la présente politique",
      blocks: [
        {
          kind: "p",
          text: "Nous pouvons modifier cette politique pour suivre l’évolution du site, du logiciel ou de la loi. La date de la dernière révision figure en haut de la page. Nous informons nos clients à l’avance de toute modification substantielle.",
        },
      ],
    },
  ],
};
