import type { LegalSet } from "./types";

/** French version of the Moroccan-law set (ar.ts): loi 09-08 / CNDP, DOC, loi 31-08, loi 2-00. */

const UPDATED = "2026-11-22";

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

    "privacy-policy": {
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
              text: "Le formulaire de demande de démonstration transmet vos données par une connexion chiffrée à notre serveur sifralabs.com (Cloudflare), qui les transfère par courrier électronique à {email} (messagerie hébergée par Zoho). Le serveur n’en conserve aucune copie. S’il est injoignable, votre logiciel de messagerie s’ouvre à la place avec un message prérempli.",
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
    },

    terms: {
      title: "Conditions générales de vente et de licence",
      summary: "Les conditions qui régissent la vente de la licence d’utilisation du logiciel MeDoc Dentist et des forfaits de service aux cabinets dentaires. Elles s’adressent exclusivement aux professionnels.",
      updated: UPDATED,
      sections: [
        {
          id: "purpose",
          title: "Objet et champ d’application",
          blocks: [
            {
              kind: "p",
              text: "Les présentes conditions générales régissent la relation entre {company} (le « Fournisseur ») et tout cabinet, centre ou praticien de médecine dentaire qui acquiert une licence d’utilisation du logiciel MeDoc Dentist ou un forfait de service (le « Client »).",
            },
            {
              kind: "p",
              text: "Cette offre s’adresse exclusivement aux professionnels qui contractent pour les besoins de leur activité professionnelle. Les dispositions de la loi n° 31-08 édictant des mesures de protection du consommateur ne s’y appliquent pas, le Client n’étant pas un consommateur au sens de cette loi.",
            },
            {
              kind: "p",
              text: "Les présentes conditions s’appliquent à toute commande et prévalent sur les conditions générales du Client, sauf accord écrit contraire des parties. En cas de contradiction, le devis signé prévaut, puis les présentes conditions.",
            },
          ],
        },
        {
          id: "order",
          title: "Commande et conclusion du contrat",
          blocks: [
            {
              kind: "p",
              text: "Le contrat est conclu par la signature du devis par le Client, ou par son acceptation écrite, et par le paiement du premier acompte. Il peut être conclu par voie électronique, conformément aux dispositions du Dahir formant Code des obligations et contrats (DOC) relatives aux contrats conclus sous forme électronique, telles qu’introduites par la loi n° 53-05 relative à l’échange électronique de données juridiques, ainsi qu’à la loi n° 43-20 relative aux services de confiance pour les transactions électroniques.",
            },
            {
              kind: "p",
              text: "Le devis précise l’édition de la licence, le nombre de postes de travail, le forfait de service choisi, le montant et la date d’installation prévue. Le Fournisseur conserve un exemplaire du contrat et le met à la disposition du Client sur demande.",
            },
          ],
        },
        {
          id: "licence",
          title: "Licence d’utilisation",
          blocks: [
            {
              kind: "p",
              text: "Après paiement intégral du prix, le Fournisseur concède au Client une licence perpétuelle, non exclusive et incessible d’utilisation du logiciel MeDoc Dentist pour un seul cabinet, dans la limite du nombre de postes de travail prévu au devis. Jusqu’au paiement intégral, une licence provisoire est concédée aux mêmes conditions.",
            },
            {
              kind: "facts",
              rows: [
                ["Essentiel", "24 900 MAD HT, 3 mois de service inclus"],
                ["Cabinet", "29 900 MAD HT, 6 mois de service inclus"],
                ["Cabinet+", "34 900 MAD HT, 12 mois de service inclus"],
              ],
            },
            {
              kind: "p",
              text: "Le Client s’interdit de copier le logiciel au-delà de ce qu’exigent son utilisation et ses copies de sauvegarde, de le modifier, de le décompiler ou d’en pratiquer l’ingénierie inverse, de le louer, de le prêter ou de le céder à des tiers, sauf dans les limites expressément permises par la loi. La licence reste valable sans forfait de service.",
            },
          ],
        },
        {
          id: "delivery",
          title: "Livraison et installation",
          blocks: [
            {
              kind: "p",
              text: "Le Fournisseur installe le logiciel sur les ordinateurs du cabinet à la date convenue, sur place ou à distance. La livraison est réputée effectuée lorsque le logiciel fonctionne sur les postes de travail convenus. Le Client formule ses réserves par écrit dans un délai de huit jours à compter de l’installation ; à défaut, la livraison est réputée acceptée.",
            },
            {
              kind: "p",
              text: "Le Client s’engage à fournir des ordinateurs et, le cas échéant, un réseau local conformes aux exigences techniques que le Fournisseur lui communique avant l’installation, et à permettre au Fournisseur d’y accéder à la date fixée.",
            },
          ],
        },
        {
          id: "service-plans",
          title: "Forfaits de service : contenu, durée et résiliation",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Sécurité", "110 MAD HT par mois : mises à jour de sécurité et mises à jour réglementaires, centre d’aide."],
                ["Confort", "290 MAD HT par mois : le contenu de Sécurité, plus les mises à jour fonctionnelles, l’assistance par téléphone et WhatsApp aux heures ouvrables et le contrôle mensuel des sauvegardes."],
                ["Premium", "540 MAD HT par mois : le contenu de Confort, plus une assistance prioritaire dans un délai de 4 heures, une visite et une formation annuelles, et l’aide à la préparation du dossier du cabinet auprès de la CNDP."],
              ],
            },
            {
              kind: "p",
              text: "Chaque licence comprend la période de service indiquée ci-dessus, à compter de la date d’installation. À son terme, le forfait choisi par le Client, s’il en a choisi un, prend effet. Le forfait est conclu pour une durée d’un mois, renouvelable par tacite reconduction de mois en mois.",
            },
            {
              kind: "p",
              text: "Chaque partie peut résilier le forfait par notification écrite, y compris par courrier électronique, moyennant un préavis d’un mois. La résiliation prend effet le dernier jour du mois qui suit la date de réception de la notification par l’autre partie. Les sommes versées pour le mois en cours ne sont pas remboursées.",
            },
            {
              kind: "p",
              text: "Sans forfait de service, le logiciel continue de fonctionner. Le Client bénéficie gratuitement des correctifs de sécurité pendant 12 mois à compter de la date d’achat. Au-delà, les mises à jour et l’assistance ne sont fournies que dans le cadre d’un forfait en cours.",
            },
          ],
        },
        {
          id: "prices-payment",
          title: "Prix et modalités de paiement",
          blocks: [
            {
              kind: "p",
              text: "Les prix sont exprimés en dirhams marocains (MAD), hors taxes. La taxe sur la valeur ajoutée s’y ajoute au taux en vigueur, actuellement 20 % pour les logiciels. Les factures sont établies conformément à l’article 145 du Code général des impôts.",
            },
            {
              kind: "list",
              items: [
                "Prix de la licence : 40 % à la signature, 30 % à l’installation et 30 % trente jours après l’installation.",
                "Forfaits de service : facturés mensuellement et payables d’avance au début de chaque mois.",
              ],
            },
            {
              kind: "p",
              text: "Tout retard de paiement entraîne de plein droit, sans mise en demeure, l’application des pénalités de retard prévues par le Code de commerce (loi n° 15-95), tel que modifié par la loi n° 69-21 relative aux délais de paiement. Après une mise en demeure restée sans effet pendant quinze jours, le Fournisseur peut suspendre les services liés au forfait jusqu’au paiement, sans que cela affecte le fonctionnement du logiciel.",
            },
          ],
        },
        {
          id: "customer-duties",
          title: "Obligations du Client",
          blocks: [
            {
              kind: "list",
              items: [
                "Fournir et entretenir des ordinateurs, des systèmes d’exploitation et, le cas échéant, un réseau, conformes aux exigences techniques.",
                "Effectuer des sauvegardes régulières, en conserver une copie hors du cabinet et vérifier qu’elles peuvent être restaurées.",
                "Gérer les comptes utilisateurs, les mots de passe et les droits d’accès, et en préserver la confidentialité.",
                "Accomplir, en sa qualité de responsable du traitement, les formalités préalables auprès de la CNDP relatives aux données des patients, conformément aux articles 12 et 21 de la loi n° 09-08, et informer les patients de leurs droits.",
                "Utiliser le logiciel conformément à sa destination et à la documentation remise.",
              ],
            },
          ],
        },
        {
          id: "personal-data",
          title: "Données personnelles",
          blocks: [
            {
              kind: "p",
              text: "Le Client est responsable du traitement des données de ses patients. Ces données sont conservées chiffrées sur ses ordinateurs et ne sont pas hébergées par le Fournisseur. Le Fournisseur n’y accède qu’en cas de partage d’écran pendant une session d’assistance ou de remise d’une sauvegarde pour analyse. Il agit alors en qualité de sous-traitant au sens de l’article 24 de la loi n° 09-08, sur les seules instructions du Client.",
            },
            {
              kind: "p",
              text: "Le Fournisseur fournit, sur demande, un contrat de sous-traitance écrit qui précise les mesures de sécurité et les obligations de confidentialité. Le personnel du Fournisseur est tenu au secret professionnel conformément à l’article 446 du Code pénal. La politique de confidentialité s’applique aux données que le Fournisseur traite pour son propre compte.",
            },
          ],
        },
        {
          id: "warranty",
          title: "Garantie",
          blocks: [
            {
              kind: "p",
              text: "Le Fournisseur garantit que le logiciel fonctionne, pour l’essentiel, conformément à la documentation remise lors de la livraison. La garantie des vices cachés prévue par le Dahir formant Code des obligations et contrats (DOC) s’applique d’une manière adaptée à la nature du logiciel : le Client notifie le vice par écrit au Fournisseur dès sa découverte, avec une description qui permet de le reproduire ; le Fournisseur s’engage à le corriger ou à proposer une solution de remplacement dans un délai raisonnable ; à défaut, le Client peut demander la résolution du contrat ou une réduction du prix, conformément à la loi.",
            },
            {
              kind: "p",
              text: "Le Fournisseur ne garantit pas que le logiciel est exempt de toute erreur ni qu’il fonctionnera sans interruption. La garantie ne couvre pas les défaillances causées par le matériel, le réseau, des logiciels tiers, une modification ou une utilisation non conforme à la documentation.",
            },
          ],
        },
        {
          id: "liability",
          title: "Responsabilité",
          blocks: [
            {
              kind: "p",
              text: "Le Fournisseur n’est responsable que des dommages directs résultant d’un manquement à ses obligations. Il n’est pas responsable des dommages indirects, notamment la perte de bénéfices ou de clientèle, ni de la perte de données due à l’absence de sauvegardes, dont le Client a la charge.",
            },
            {
              kind: "p",
              text: "La responsabilité globale du Fournisseur est plafonnée au total des sommes versées par le Client au Fournisseur au cours des douze mois qui précèdent le fait générateur du dommage. Cette limitation ne s’applique pas en cas de dol ou de faute lourde, conformément à l’article 232 du Dahir formant Code des obligations et contrats (DOC).",
            },
          ],
        },
        {
          id: "not-medical-device",
          title: "MeDoc Dentist n’est pas un dispositif médical",
          blocks: [
            {
              kind: "p",
              text: "MeDoc Dentist est un logiciel de gestion et de documentation destiné aux professionnels de la médecine dentaire autorisés à exercer. Ce n’est pas un dispositif médical : il ne pose aucun diagnostic et ne propose aucun traitement. Les décisions cliniques, les prescriptions et le contenu des certificats relèvent de la seule responsabilité du médecin dentiste, qui vérifie chaque document avant de le signer ou de le remettre.",
            },
          ],
        },
        {
          id: "intellectual-property",
          title: "Propriété intellectuelle",
          blocks: [
            {
              kind: "p",
              text: "Le logiciel, sa documentation et ses mises à jour restent la propriété de {company} et sont protégés par la loi n° 2-00 relative aux droits d’auteur et droits voisins. Le contrat ne transfère au Client aucun droit de propriété, mais seulement un droit d’utilisation selon les conditions de la licence. Les données que le Client saisit dans le logiciel restent sa propriété.",
            },
          ],
        },
        {
          id: "confidentiality",
          title: "Confidentialité",
          blocks: [
            {
              kind: "p",
              text: "Chaque partie s’engage à garder confidentielles les informations non publiques dont elle a connaissance à l’occasion de l’exécution du contrat, et à ne les utiliser qu’à cette fin, pendant toute la durée du contrat et cinq ans après son terme. L’obligation de secret professionnel relative aux données des patients demeure sans limitation de durée.",
            },
          ],
        },
        {
          id: "termination",
          title: "Durée et résiliation",
          blocks: [
            {
              kind: "p",
              text: "La licence d’utilisation reste valable sans limitation de durée tant que le Client en respecte les conditions. En cas de manquement de l’une des parties à une obligation essentielle, l’autre partie peut résilier le contrat après une mise en demeure écrite restée sans effet pendant trente jours.",
            },
            {
              kind: "p",
              text: "Si la licence est résiliée pour défaut de paiement de son prix, le Client doit cesser d’utiliser le logiciel. Il peut, dans tous les cas, exporter ses données au préalable. La résiliation est sans effet sur les sommes dues et sur les clauses qui, par leur nature, restent en vigueur, notamment la confidentialité, la responsabilité et la propriété intellectuelle.",
            },
          ],
        },
        {
          id: "law-court",
          title: "Droit applicable, juridiction compétente et divisibilité des clauses",
          blocks: [
            {
              kind: "p",
              text: "Le présent contrat est soumis au droit marocain. Les parties s’efforcent de régler tout litige à l’amiable ; à défaut d’accord dans un délai de trente jours, le tribunal de commerce de {court} est compétent.",
            },
            {
              kind: "p",
              text: "Si l’une des clauses des présentes conditions est déclarée nulle ou inapplicable, les autres clauses restent en vigueur, et la clause nulle est remplacée par une clause valable aussi proche que possible de l’intention des parties.",
            },
          ],
        },
      ],
    },
  },
};
