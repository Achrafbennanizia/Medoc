import type { LegalSet } from "./types";
import { FR_PRIVACY_POLICY } from "./fr-privacy-policy";
import { FR_TERMS } from "./fr-terms";
import { UPDATED } from "./updated";

/** French version of the Moroccan-law set (ar.ts): loi 09-08 / CNDP, DOC, loi 31-08, loi 2-00. */


export const LEGAL_FR: LegalSet = {
  jurisdictionLabel: "Droit marocain applicable",
  reviewNote: "Ces textes sont des projets : un avocat qualifié en droit marocain doit les relire avant leur publication.",
  docs: {
    "legal-notice": {
      title: "Mentions légales",
      summary: "Informations sur l’éditeur de ce site, son hébergeur et ses conditions d’utilisation.",
      updated: UPDATED,
      sections: [
        {
          id: "publisher",
          title: "Éditeur du site",
          blocks: [
            { kind: "p", text: "Ce site est édité et exploité par :" },
            {
              kind: "facts",
              rows: [
                ["Dénomination", "{company}"],
                ["Forme juridique", "{legalForm}"],
                ["Capital social", "{capital}"],
                ["Siège social", "{address}, {country}"],
                ["Registre du commerce (RC)", "{registry}, n° {registryNumber}"],
                ["Identifiant fiscal (IF)", "{taxId}"],
                ["Identifiant commun de l’entreprise (ICE)", "{ice}"],
                ["Courriel", "{email}"],
                ["Téléphone", "{phone}"],
                ["Représentant légal", "{director}"],
              ],
            },
          ],
        },
        {
          id: "publication-director",
          title: "Directeur de la publication",
          blocks: [
            { kind: "p", text: "Le directeur de la publication de ce site est {director}, en sa qualité de représentant légal de {company}." },
          ],
        },
        {
          id: "host",
          title: "Hébergeur",
          blocks: [
            { kind: "p", text: "Ce site est hébergé par : {hostingProvider}." },
          ],
        },
        {
          id: "professional-offer",
          title: "Offre réservée aux professionnels",
          blocks: [
            {
              kind: "p",
              text: "Ce site présente le logiciel MeDoc Dentist de gestion des cabinets dentaires. L’offre s’adresse exclusivement aux professionnels, c’est-à-dire aux cabinets et centres dentaires et aux praticiens autorisés à exercer. Elle ne concerne pas les consommateurs au sens de la loi n° 31-08 édictant des mesures de protection du consommateur.",
            },
            {
              kind: "p",
              text: "Les prix affichés sur ce site sont exprimés en dirhams marocains (MAD), hors taxe sur la valeur ajoutée. Les ventes sont soumises aux conditions générales de vente et de licence publiées sur ce site.",
            },
          ],
        },
        {
          id: "intellectual-property",
          title: "Propriété intellectuelle",
          blocks: [
            {
              kind: "p",
              text: "Les textes, images, graphismes, logos, la conception du site et le logiciel MeDoc Dentist sont protégés par la loi n° 2-00 relative aux droits d’auteur et droits voisins. Ils sont la propriété de {company}, ou {company} est autorisée à les utiliser.",
            },
            {
              kind: "p",
              text: "Toute reproduction, republication, modification ou exploitation commerciale de tout ou partie du site sans l’autorisation écrite préalable de {company} est interdite, à l’exception de l’usage personnel ou de la courte citation avec mention de la source, dans les limites permises par la loi.",
            },
          ],
        },
        {
          id: "links",
          title: "Liens",
          blocks: [
            {
              kind: "p",
              text: "Le site peut contenir des liens vers des sites ou services de tiers, dont un lien facultatif vers l’application WhatsApp. {company} n’exerce aucun contrôle sur le contenu de ces sites ni sur la manière dont ils traitent les données, et n’assume aucune responsabilité à leur égard.",
            },
            {
              kind: "p",
              text: "Il est permis de créer un lien vers la page d’accueil de ce site sans autorisation, à condition que ce lien ne laisse pas croire à un partenariat ou à une recommandation qui n’existe pas.",
            },
          ],
        },
        {
          id: "liability",
          title: "Responsabilité de l’éditeur quant au contenu",
          blocks: [
            {
              kind: "p",
              text: "{company} veille à ce que les informations publiées soient exactes et à jour. Il s’agit toutefois d’informations générales, qui ne constituent pas une offre contractuelle ferme. Les conditions contractuelles définitives sont fixées dans le devis ou dans le contrat signé.",
            },
          ],
        },
        {
          id: "privacy",
          title: "Protection des données personnelles",
          blocks: [
            {
              kind: "p",
              text: "Ce site n’utilise aucun outil de mesure d’audience ni de suivi. Il ne dépose que des cookies nécessaires, et seulement lorsque vous faites un choix : une langue, un thème, ou la fermeture de l’avis relatif aux cookies. La politique de confidentialité explique comment les données personnelles sont traitées conformément à la loi n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel.",
            },
          ],
        },
        {
          id: "law",
          title: "Droit applicable",
          blocks: [
            {
              kind: "p",
              text: "Les présentes mentions et l’utilisation du site sont soumises au droit marocain. En cas de litige, le tribunal de commerce de {court} est compétent.",
            },
          ],
        },
      ],
    },

    "privacy-notice": {
      title: "Avis de confidentialité",
      summary: "Un résumé court et clair de ce que nous faisons de vos données lorsque vous consultez ce site, nous contactez ou utilisez le logiciel MeDoc Dentist.",
      updated: UPDATED,
      sections: [
        {
          id: "who",
          title: "Qui sommes-nous",
          blocks: [
            {
              kind: "p",
              text: "{company}, {address}, {country}, est responsable du traitement des données liées à ce site et à ses relations commerciales. Pour toute question sur vos données : {dpoContact}.",
            },
          ],
        },
        {
          id: "website",
          title: "Le site : aucun cookie de suivi, aucun traçage",
          blocks: [
            {
              kind: "list",
              items: [
                "Aucun outil de statistiques ni de suivi : seulement des cookies nécessaires, déposés lorsque vous faites un choix.",
                "Votre choix de langue et de thème (clair ou sombre) est conservé par votre seul navigateur et ne nous est pas transmis.",
                "Les polices de caractères sont hébergées sur le serveur du site lui-même : votre navigateur ne contacte aucun service de polices externe.",
                "L’hébergeur {hostingProvider} conserve pendant une courte durée des journaux techniques (adresse IP, heure, page demandée) à des fins de sécurité.",
              ],
            },
          ],
        },
        {
          id: "contact",
          title: "Demande de démonstration et prise de contact",
          blocks: [
            {
              kind: "p",
              text: "Le formulaire de demande de démonstration transmet ce que vous saisissez (nom, cabinet, ville, téléphone, adresse électronique, message) par une connexion chiffrée à notre serveur sifralabs.com, hébergé par Cloudflare, qui le transfère par courrier électronique à {email} ; notre messagerie est hébergée par Zoho. Le site n’en conserve aucune copie. Si notre serveur est injoignable, votre logiciel de messagerie s’ouvre à la place avec un message prérempli. Nous utilisons ce que vous nous envoyez pour vous répondre et préparer une offre. Le lien WhatsApp est facultatif : si vous l’utilisez, la politique de la société Meta s’applique et vos données peuvent être transférées hors du Maroc.",
            },
          ],
        },
        {
          id: "software",
          title: "Le logiciel MeDoc Dentist et les données des patients",
          blocks: [
            {
              kind: "p",
              text: "Les données des patients sont conservées chiffrées sur les seuls ordinateurs du cabinet et, dans les éditions Cabinet et Cabinet+, synchronisées au sein de son réseau local. Nous n’hébergeons pas ces données et ne les transférons pas à l’étranger. Nous n’y avons accès que si le cabinet partage son écran pendant une session d’assistance ou nous remet une sauvegarde pour analyse ; nous agissons alors en qualité de sous-traitant, en vertu d’un contrat écrit. La vérification des mises à jour ne transmet que le numéro de version du logiciel.",
            },
          ],
        },
        {
          id: "retention",
          title: "Durée de conservation et partage",
          blocks: [
            {
              kind: "p",
              text: "Nous ne vendons ni ne louons vos données. Nous les conservons pendant la durée nécessaire à la finalité pour laquelle elles ont été collectées, et les documents comptables pendant dix ans, conformément à l’article 22 du Code de commerce.",
            },
          ],
        },
        {
          id: "rights",
          title: "Vos droits",
          blocks: [
            {
              kind: "p",
              text: "Vous disposez d’un droit à l’information, d’un droit d’accès, d’un droit de rectification et d’un droit d’opposition, conformément aux articles 5, 7, 8 et 9 de la loi n° 09-08. Écrivez-nous à {dpoContact}. Vous pouvez également adresser une plainte à la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP). Le détail figure dans la politique de confidentialité.",
            },
          ],
        },
      ],
    },

    "privacy-policy": FR_PRIVACY_POLICY,

    terms: FR_TERMS,
  },
};
