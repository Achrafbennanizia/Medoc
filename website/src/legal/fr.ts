import type { LegalSet } from "./types";

const UPDATED = "2026-11-22";

export const LEGAL_FR: LegalSet = {
  jurisdictionLabel: "Rédigé selon le droit français",
  reviewNote:
    "Projet de texte : il doit être relu et validé par un avocat avant toute publication.",
  docs: {
    /* ------------------------------------------------------------------ */
    "legal-notice": {
      title: "Mentions légales",
      summary:
        "Informations sur l’éditeur et l’hébergeur de ce site, publiées en application de l’article 6 III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN).",
      updated: UPDATED,
      sections: [
        {
          id: "editeur",
          title: "Éditeur du site",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Raison sociale", "{company}"],
                ["Forme juridique", "{legalForm}"],
                ["Capital social", "{capital}"],
                ["Siège social", "{address}, {country}"],
                ["Immatriculation", "{registry}, n° {registryNumber}"],
                ["N° de TVA intracommunautaire", "{vatId}"],
                ["Courriel", "{email}"],
                ["Téléphone", "{phone}"],
              ],
            },
          ],
        },
        {
          id: "directeur-publication",
          title: "Directeur de la publication",
          blocks: [
            {
              kind: "p",
              text: "Le directeur de la publication est {director}, en sa qualité de représentant légal de {company}.",
            },
          ],
        },
        {
          id: "hebergeur",
          title: "Hébergeur",
          blocks: [
            {
              kind: "p",
              text: "Le site est hébergé par {hostingProvider}. Les coordonnées complètes de l’hébergeur (dénomination, adresse et moyen de contact) figurent ci-dessus.",
            },
            {
              kind: "p",
              text: "L’hébergement du site ne concerne que les pages publiques. Aucune donnée de santé n’est hébergée par l’éditeur ni par cet hébergeur.",
            },
          ],
        },
        {
          id: "offre-professionnels",
          title: "Offre réservée aux professionnels",
          blocks: [
            {
              kind: "p",
              text: "Le logiciel MeDoc et les services décrits sur ce site sont proposés exclusivement à des professionnels, en particulier aux cabinets dentaires et aux chirurgiens-dentistes agissant dans le cadre de leur activité. Ils ne sont pas proposés aux consommateurs.",
            },
          ],
        },
        {
          id: "propriete-intellectuelle",
          title: "Propriété intellectuelle",
          blocks: [
            {
              kind: "p",
              text: "Les textes, images, logos, captures d’écran, la marque MeDoc et la structure du site sont protégés par le Code de la propriété intellectuelle. Ils appartiennent à {company} ou sont utilisés avec l’autorisation de leurs titulaires.",
            },
            {
              kind: "p",
              text: "Toute reproduction, représentation ou adaptation, totale ou partielle, sans autorisation écrite préalable de {company} est interdite et peut constituer une contrefaçon au sens des articles L.335-2 et suivants du Code de la propriété intellectuelle.",
            },
          ],
        },
        {
          id: "liens",
          title: "Liens vers d’autres sites",
          blocks: [
            {
              kind: "p",
              text: "Le site peut contenir des liens vers des sites tiers, par exemple WhatsApp. {company} n’exerce aucun contrôle sur ces sites et n’est pas responsable de leur contenu ni de leurs pratiques en matière de données personnelles.",
            },
            {
              kind: "p",
              text: "La création d’un lien vers ce site est libre, à condition de ne pas porter atteinte à l’image de {company} et de ne pas présenter le site dans un cadre qui en masque l’origine.",
            },
          ],
        },
        {
          id: "donnees-personnelles",
          title: "Données personnelles et cookies",
          blocks: [
            {
              kind: "p",
              text: "Le site n’utilise aucun outil de mesure d’audience ni aucun traceur. Il ne dépose que des cookies nécessaires, et seulement lorsque vous choisissez une langue, un thème ou un pays. Le traitement des données personnelles est décrit dans la notice d’information et dans la politique de confidentialité.",
            },
          ],
        },
        {
          id: "contact",
          title: "Contact",
          blocks: [
            {
              kind: "p",
              text: "Pour toute question sur le site, vous pouvez écrire à {email} ou appeler le {phone}.",
            },
          ],
        },
      ],
    },

    /* ------------------------------------------------------------------ */
    "privacy-notice": {
      title: "Notice d’information sur les données personnelles",
      summary:
        "L’essentiel, en quelques lignes, sur ce que {company} fait de vos données lorsque vous consultez ce site, nous contactez ou utilisez MeDoc.",
      updated: UPDATED,
      sections: [
        {
          id: "qui",
          title: "Qui est responsable",
          blocks: [
            {
              kind: "p",
              text: "{company}, {address}, {country}, est responsable des données traitées par ce site et dans la relation commerciale. Contact données personnelles : {dpoContact}.",
            },
          ],
        },
        {
          id: "site",
          title: "Sur ce site",
          blocks: [
            {
              kind: "list",
              items: [
                "Aucune mesure d’audience, aucun traceur : seulement des cookies nécessaires, déposés quand vous faites un choix.",
                "Votre langue, votre thème (clair ou sombre) et votre pays sont gardés dans votre navigateur et ne nous sont pas transmis.",
                "Les polices sont hébergées sur notre site : aucune requête vers un service tiers.",
                "Notre hébergeur conserve brièvement des journaux techniques (adresse IP, heure, page demandée) pour la sécurité du site.",
              ],
            },
          ],
        },
        {
          id: "contact",
          title: "Quand vous nous contactez",
          blocks: [
            {
              kind: "p",
              text: "Le formulaire de démonstration transmet ce que vous saisissez (nom, cabinet, ville, téléphone, e-mail, message) par une connexion chiffrée à notre serveur sifralabs.com, hébergé par Cloudflare, qui le transfère par e-mail à {email} ; notre messagerie est hébergée par Zoho. Le site n’en garde aucune copie. Si notre serveur est injoignable, votre messagerie s’ouvre à la place avec un message prérempli. Nous utilisons ce que vous nous écrivez pour vous répondre et, si vous devenez client, pour exécuter le contrat et tenir notre comptabilité.",
            },
            {
              kind: "p",
              text: "Si vous choisissez de nous écrire sur WhatsApp, la société Meta traite aussi ces échanges selon sa propre politique, éventuellement hors de l’Union européenne.",
            },
          ],
        },
        {
          id: "medoc",
          title: "Dans le logiciel MeDoc",
          blocks: [
            {
              kind: "p",
              text: "Les données des patients restent chiffrées sur les ordinateurs du cabinet et ne circulent que sur son réseau local. Nous ne les hébergeons pas. Le cabinet en est responsable. Nous n’y avons accès que si le cabinet partage son écran pendant une assistance ou nous remet une sauvegarde, en qualité de sous-traitant tenu au secret.",
            },
          ],
        },
        {
          id: "duree",
          title: "Combien de temps",
          blocks: [
            {
              kind: "list",
              items: [
                "Prospects : 3 ans après le dernier contact.",
                "Clients : pendant le contrat, puis 10 ans pour les pièces comptables.",
                "Journaux du site : quelques jours à quelques semaines, selon l’hébergeur.",
              ],
            },
          ],
        },
        {
          id: "droits",
          title: "Vos droits",
          blocks: [
            {
              kind: "p",
              text: "Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la portabilité de vos données, et vous opposer à leur traitement, en écrivant à {dpoContact}. Vous pouvez aussi saisir la CNIL (www.cnil.fr). Le détail figure dans notre politique de confidentialité.",
            },
          ],
        },
      ],
    },

    /* ------------------------------------------------------------------ */
    "privacy-policy": {
      title: "Politique de confidentialité",
      summary:
        "Information complète, au sens des articles 13 et 14 du RGPD, sur les traitements de données personnelles réalisés par {company} pour son site, sa relation commerciale et le logiciel MeDoc.",
      updated: UPDATED,
      sections: [
        {
          id: "responsable",
          title: "1. Responsable du traitement et contact",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Responsable du traitement", "{company}, {legalForm}"],
                ["Adresse", "{address}, {country}"],
                ["Contact général", "{email}"],
                ["Contact données personnelles / délégué", "{dpoContact}"],
              ],
            },
            {
              kind: "p",
              text: "Cette politique est établie en application du règlement (UE) 2016/679 du 27 avril 2016 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 relative à l’informatique, aux fichiers et aux libertés (loi Informatique et Libertés).",
            },
          ],
        },
        {
          id: "site",
          title: "2. Consultation du site",
          blocks: [
            {
              kind: "p",
              text: "Le site est statique. Il n’utilise aucun outil de mesure d’audience, de publicité ni aucun autre traceur. Il ne dépose que des cookies strictement nécessaires : aucun bandeau de consentement n’est donc requis, un simple avis vous en informe.",
            },
            {
              kind: "p",
              text: "Vos choix de langue, de thème (clair ou sombre) et de pays sont enregistrés dans des cookies propres au site, uniquement lorsque vous les faites. Ils ne nous sont pas transmis et ne sont partagés avec personne. Ils sont strictement nécessaires au service que vous demandez et relèvent de l’exemption prévue à l’article 82 de la loi Informatique et Libertés. Le pays est d’abord estimé à partir du fuseau horaire et de la langue de votre navigateur, sur votre appareil seulement ; cette estimation n’est pas enregistrée. Vous pouvez effacer ces cookies à tout moment depuis les réglages de votre navigateur.",
            },
            {
              kind: "facts",
              rows: [
                ["medoc_lang", "Langue choisie. 12 mois."],
                ["medoc_theme", "Thème clair ou sombre choisi. 12 mois."],
                ["medoc_country", "Pays choisi (adapte les documents et les prix affichés). 12 mois."],
                ["medoc_cookie_notice", "Retient que vous avez fermé l’avis sur les cookies. 12 mois."],
              ],
            },
            {
              kind: "p",
              text: "Les polices de caractères sont servies depuis notre propre site : votre navigateur ne contacte aucun service tiers pour les charger.",
            },
            {
              kind: "p",
              text: "Notre hébergeur, {hostingProvider}, enregistre des journaux techniques à chaque requête : adresse IP, date et heure, page demandée et informations techniques du navigateur. Ces journaux servent à la sécurité et au bon fonctionnement du site. Base légale : notre intérêt légitime à protéger le site (art. 6.1 f RGPD). Ils sont conservés pour une courte durée, puis supprimés.",
            },
          ],
        },
        {
          id: "contact-prospects",
          title: "3. Demandes de démonstration et prospects",
          blocks: [
            {
              kind: "p",
              text: "Le formulaire de démonstration envoie vos saisies par une connexion chiffrée à notre serveur sifralabs.com (Cloudflare), qui les transfère par e-mail à {email} (messagerie hébergée par Zoho). Le serveur n’en garde aucune copie. S’il est injoignable, votre logiciel de messagerie s’ouvre à la place avec un message prérempli.",
            },
            {
              kind: "p",
              text: "Nous traitons les données contenues dans votre message (nom, cabinet, coordonnées, contenu de la demande) pour vous répondre et organiser une démonstration. Base légale : mesures précontractuelles prises à votre demande (art. 6.1 b RGPD) et notre intérêt légitime à développer notre activité auprès des professionnels (art. 6.1 f RGPD).",
            },
            {
              kind: "p",
              text: "Si vous nous contactez via WhatsApp, ce service est fourni par Meta, qui traite les échanges selon sa propre politique de confidentialité, avec un possible transfert hors de l’Union européenne. Ce canal est facultatif : vous pouvez toujours nous écrire par courriel ou par téléphone.",
            },
          ],
        },
        {
          id: "clients",
          title: "4. Clients",
          blocks: [
            {
              kind: "p",
              text: "Pour nos clients, nous traitons les données des interlocuteurs du cabinet (nom, fonction, coordonnées professionnelles), les données de commande, de facturation et de paiement, ainsi que l’historique des demandes d’assistance.",
            },
            {
              kind: "list",
              items: [
                "Exécution du contrat (licence, installation, forfaits de service, assistance) : art. 6.1 b RGPD.",
                "Obligations comptables et fiscales : art. 6.1 c RGPD.",
                "Gestion de la relation client, prévention des impayés et défense de nos droits : intérêt légitime, art. 6.1 f RGPD.",
              ],
            },
          ],
        },
        {
          id: "medoc",
          title: "5. Le logiciel MeDoc",
          blocks: [
            {
              kind: "p",
              text: "MeDoc est installé sur les ordinateurs du cabinet. Le dossier patient, le schéma dentaire, l’agenda, les ordonnances, les certificats, les factures, la caisse et le temps de travail y sont enregistrés. Les données sont chiffrées (SQLCipher, AES-256) et synchronisées uniquement entre les appareils du cabinet, sur son réseau local.",
            },
            {
              kind: "p",
              text: "{company} n’héberge aucune donnée de santé. Aucune donnée patient n’est envoyée à nos serveurs. Nous ne réalisons donc pas d’activité d’hébergement de données de santé soumise à la certification HDS prévue à l’article L.1111-8 du Code de la santé publique.",
            },
            {
              kind: "p",
              text: "Le cabinet est responsable des traitements qu’il réalise avec MeDoc sur les données de ses patients. Il lui appartient notamment d’informer ses patients et de gérer leurs demandes d’exercice de droits.",
            },
            {
              kind: "p",
              text: "{company} ne voit des données patients que dans deux cas, à l’initiative du cabinet : lorsque le cabinet partage son écran pendant une session d’assistance, ou lorsqu’il nous remet une sauvegarde pour analyse. Nous agissons alors comme sous-traitant au sens de l’article 28 du RGPD, sur instruction du cabinet, dans le cadre d’un contrat de sous-traitance. Les sauvegardes remises sont supprimées dès la fin de l’analyse.",
            },
            {
              kind: "p",
              text: "Les personnes de {company} qui interviennent sont soumises à une obligation de confidentialité et au respect du secret médical prévu à l’article L.1110-4 du Code de la santé publique.",
            },
            {
              kind: "p",
              text: "La vérification des mises à jour contacte notre serveur. Elle transmet la version installée du logiciel et les informations techniques nécessaires à la connexion (dont l’adresse IP), jamais de donnée patient. Base légale : notre intérêt légitime et l’exécution du contrat (fourniture des correctifs).",
            },
          ],
        },
        {
          id: "securite",
          title: "6. Sécurité",
          blocks: [
            {
              kind: "p",
              text: "Conformément à l’article 32 du RGPD, nous mettons en œuvre des mesures techniques et organisationnelles adaptées au risque, notamment :",
            },
            {
              kind: "list",
              items: [
                "chiffrement de la base de données de MeDoc (SQLCipher, AES-256) ;",
                "synchronisation limitée au réseau local du cabinet, sans serveur central de l’éditeur ;",
                "accès de l’éditeur aux données patients uniquement à l’initiative du cabinet et pour la durée nécessaire ;",
                "obligation de confidentialité de notre personnel et limitation des accès internes ;",
                "mises à jour de sécurité du logiciel.",
              ],
            },
            {
              kind: "p",
              text: "La sécurité du matériel, du réseau, des comptes utilisateurs et des sauvegardes du cabinet relève du cabinet.",
            },
          ],
        },
        {
          id: "destinataires",
          title: "7. Destinataires et sous-traitants",
          blocks: [
            {
              kind: "p",
              text: "Vos données sont accessibles aux seules personnes de {company} qui en ont besoin. Elles peuvent être communiquées à nos sous-traitants techniques, dans la limite de leur mission :",
            },
            {
              kind: "list",
              items: [
                "{hostingProvider}, pour l’hébergement du site et du serveur de mises à jour ;",
                "nos prestataires de messagerie, de comptabilité et notre expert-comptable ;",
                "les autorités administratives ou judiciaires, lorsque la loi l’exige.",
              ],
            },
            { kind: "p", text: "Nous ne vendons ni ne louons aucune donnée personnelle." },
          ],
        },
        {
          id: "transferts",
          title: "8. Transferts hors de l’Union européenne",
          blocks: [
            {
              kind: "p",
              text: "Par défaut, nous ne transférons aucune donnée personnelle hors de l’Union européenne. Seul l’usage facultatif de WhatsApp, à votre initiative, peut entraîner un transfert par Meta. Si un transfert devenait nécessaire, il serait encadré par une décision d’adéquation ou par les clauses contractuelles types de la Commission européenne (art. 44 et suivants du RGPD).",
            },
          ],
        },
        {
          id: "durees",
          title: "9. Durées de conservation",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Prospects", "3 ans à compter du dernier contact de votre part"],
                ["Clients (données contractuelles)", "Durée du contrat, puis 5 ans (prescription, art. L.110-4 C. com.)"],
                ["Pièces comptables et factures", "10 ans (art. L.123-22 C. com.)"],
                ["Journaux techniques du site", "Courte durée fixée par l’hébergeur"],
                ["Sauvegardes remises pour analyse", "Supprimées à la fin de l’analyse"],
              ],
            },
          ],
        },
        {
          id: "droits",
          title: "10. Vos droits",
          blocks: [
            {
              kind: "p",
              text: "Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :",
            },
            {
              kind: "list",
              items: [
                "droit d’accès (art. 15) et de rectification (art. 16) ;",
                "droit à l’effacement (art. 17) et à la limitation du traitement (art. 18) ;",
                "droit à la portabilité (art. 20) ;",
                "droit d’opposition, notamment à la prospection (art. 21) ;",
                "droit de définir des directives sur le sort de vos données après votre décès (art. 85 de la loi Informatique et Libertés).",
              ],
            },
            {
              kind: "p",
              text: "Pour les exercer, écrivez à {dpoContact}. Nous répondons dans un délai d’un mois, prolongeable de deux mois si la demande est complexe (art. 12 RGPD). Nous pouvons demander un justificatif d’identité en cas de doute raisonnable.",
            },
            {
              kind: "p",
              text: "Les patients d’un cabinet qui utilise MeDoc doivent adresser leurs demandes à leur cabinet, responsable du traitement. Nous l’assistons si nécessaire.",
            },
          ],
        },
        {
          id: "cnil",
          title: "11. Réclamation auprès de la CNIL",
          blocks: [
            {
              kind: "p",
              text: "Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la Commission nationale de l’informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, www.cnil.fr.",
            },
          ],
        },
        {
          id: "decision-automatisee",
          title: "12. Absence de décision automatisée",
          blocks: [
            {
              kind: "p",
              text: "Nous ne prenons aucune décision fondée exclusivement sur un traitement automatisé, y compris le profilage, produisant des effets juridiques à votre égard (art. 22 RGPD).",
            },
          ],
        },
        {
          id: "modifications",
          title: "13. Modifications",
          blocks: [
            {
              kind: "p",
              text: "Nous pouvons modifier cette politique, notamment en cas d’évolution du site, du logiciel ou de la réglementation. La date de mise à jour figure en tête du document. En cas de changement important, nos clients en sont informés par courriel.",
            },
          ],
        },
      ],
    },

    /* ------------------------------------------------------------------ */
    terms: {
      title: "Conditions générales de vente et de licence",
      summary:
        "Conditions applicables à la licence du logiciel MeDoc et aux forfaits de service vendus par {company} aux professionnels de santé dentaire.",
      updated: UPDATED,
      sections: [
        {
          id: "objet",
          title: "1. Objet et champ d’application",
          blocks: [
            {
              kind: "p",
              text: "Les présentes conditions générales (les « Conditions ») régissent la concession de licence du logiciel MeDoc, son installation et les forfaits de service fournis par {company} (l’« Éditeur ») à ses clients (le « Client »).",
            },
            {
              kind: "p",
              text: "L’offre est réservée aux professionnels, en particulier aux cabinets dentaires et chirurgiens-dentistes agissant pour les besoins de leur activité. Elle n’est pas destinée aux consommateurs. Les dispositions du Code de la consommation ne s’appliquent donc pas.",
            },
            {
              kind: "p",
              text: "Les Conditions constituent le socle de la négociation commerciale au sens de l’article L.441-1 du Code de commerce. Elles prévalent sur les conditions d’achat du Client, sauf accord écrit contraire.",
            },
          ],
        },
        {
          id: "commande",
          title: "2. Commande et formation du contrat",
          blocks: [
            {
              kind: "p",
              text: "Toute commande fait l’objet d’un devis ou bon de commande indiquant la formule choisie, le nombre de postes, le prix et le calendrier d’installation. Le contrat est formé à la signature du bon de commande par le Client et au paiement du premier acompte.",
            },
            {
              kind: "p",
              text: "Le contrat se compose, par ordre de priorité décroissant : du bon de commande, des présentes Conditions, puis du contrat de sous-traitance des données lorsqu’il est conclu.",
            },
          ],
        },
        {
          id: "licence",
          title: "3. Licence",
          blocks: [
            {
              kind: "p",
              text: "L’Éditeur concède au Client une licence d’utilisation de MeDoc perpétuelle, non exclusive, non cessible et non transférable, pour un cabinet et pour le nombre de postes indiqué au bon de commande, en vue de l’usage professionnel interne du Client.",
            },
            {
              kind: "p",
              text: "Le Client s’interdit de reproduire le logiciel au-delà des besoins de son utilisation et de ses sauvegardes, de le modifier, de le décompiler hors des cas prévus à l’article L.122-6-1 du Code de la propriété intellectuelle, de le louer, de le sous-licencier ou de le mettre à disposition de tiers.",
            },
            {
              kind: "facts",
              rows: [
                ["Essentiel", "2 500 € HT — 3 mois de service inclus"],
                ["Cabinet", "2 900 € HT — 6 mois de service inclus"],
                ["Clinique", "3 500 € HT — 12 mois de service inclus"],
              ],
            },
            {
              kind: "p",
              text: "Sans forfait de service, la licence continue de fonctionner sans limite de durée. Les correctifs de sécurité restent fournis gratuitement pendant 12 mois à compter de l’achat.",
            },
          ],
        },
        {
          id: "installation",
          title: "4. Livraison et installation",
          blocks: [
            {
              kind: "p",
              text: "L’Éditeur installe MeDoc sur les ordinateurs du Client à la date convenue. L’installation est réputée réalisée lorsque le logiciel est opérationnel sur les postes prévus ; elle fait l’objet d’un procès-verbal ou d’un courriel de confirmation.",
            },
            {
              kind: "p",
              text: "Le Client met à disposition, à la date prévue, un matériel et un réseau local conformes aux prérequis communiqués par l’Éditeur. Un retard imputable au Client décale l’installation sans remettre en cause l’échéancier de paiement lié à la signature.",
            },
          ],
        },
        {
          id: "forfaits",
          title: "5. Forfaits de service",
          blocks: [
            {
              kind: "p",
              text: "À l’issue de la période de service incluse dans la licence, le Client peut souscrire l’un des forfaits suivants. Les forfaits sont cumulatifs : chacun comprend le contenu du précédent.",
            },
            {
              kind: "facts",
              rows: [
                ["Sécurité — 10 € HT/mois", "Mises à jour de sécurité et réglementaires, accès au centre d’aide."],
                ["Confort — 25 € HT/mois", "Sécurité + nouvelles fonctions, assistance par téléphone et WhatsApp aux heures ouvrables, contrôle mensuel des sauvegardes."],
                ["Premium — 50 € HT/mois", "Confort + assistance prioritaire avec prise en charge sous 4 heures ouvrables, visite annuelle et formation."],
              ],
            },
            {
              kind: "p",
              text: "Les forfaits sont conclus pour une durée d’un mois, reconduite tacitement de mois en mois. Chaque partie peut les résilier par écrit (courriel compris) avec un préavis d’un mois : la résiliation prend effet à la fin du mois civil qui suit la réception de la demande. Tout mois commencé est dû.",
            },
            {
              kind: "p",
              text: "Le Client peut changer de forfait à la hausse à tout moment, avec effet au mois suivant ; un changement à la baisse suit les mêmes règles de préavis qu’une résiliation.",
            },
          ],
        },
        {
          id: "prix",
          title: "6. Prix et paiement",
          blocks: [
            {
              kind: "p",
              text: "Les prix sont exprimés en euros hors taxes. La TVA au taux en vigueur s’y ajoute. Les frais de déplacement éventuels sont indiqués au bon de commande.",
            },
            {
              kind: "list",
              items: [
                "40 % du prix de la licence à la signature du bon de commande ;",
                "30 % à l’installation ;",
                "30 % à 30 jours après l’installation.",
              ],
            },
            {
              kind: "p",
              text: "Les forfaits de service sont facturés mensuellement, à terme à échoir, et payables à réception de facture.",
            },
            {
              kind: "p",
              text: "Tout retard de paiement entraîne de plein droit, sans rappel, des pénalités de retard égales au taux d’intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente majoré de 10 points (art. L.441-10 C. com.), ainsi qu’une indemnité forfaitaire pour frais de recouvrement de 40 € (art. D.441-5 C. com.). Une indemnité complémentaire peut être demandée sur justificatif si les frais réels sont supérieurs. Aucun escompte n’est accordé pour paiement anticipé.",
            },
            {
              kind: "p",
              text: "Après mise en demeure restée sans effet pendant 15 jours, l’Éditeur peut suspendre les forfaits de service jusqu’au paiement complet. La licence elle-même n’est pas désactivée.",
            },
          ],
        },
        {
          id: "obligations-client",
          title: "7. Obligations du Client",
          blocks: [
            {
              kind: "list",
              items: [
                "Fournir et entretenir un matériel, un système d’exploitation et un réseau local conformes aux prérequis.",
                "Réaliser et vérifier régulièrement ses sauvegardes et en conserver au moins une copie hors du cabinet. Le contrôle mensuel prévu au forfait Confort ne remplace pas cette obligation.",
                "Créer des comptes utilisateurs individuels, protéger les mots de passe et retirer les accès des personnes qui quittent le cabinet.",
                "Agir en tant que responsable du traitement des données de ses patients : information des patients, gestion de leurs droits, tenue du registre des traitements.",
                "Installer les mises à jour de sécurité mises à sa disposition.",
              ],
            },
          ],
        },
        {
          id: "donnees",
          title: "8. Données personnelles",
          blocks: [
            {
              kind: "p",
              text: "Les données des patients sont stockées chiffrées sur les ordinateurs du Client et synchronisées uniquement sur son réseau local. L’Éditeur ne les héberge pas et n’exerce donc pas d’activité d’hébergement de données de santé au sens de l’article L.1111-8 du Code de la santé publique.",
            },
            {
              kind: "p",
              text: "Lorsque l’Éditeur accède à des données patients, à l’initiative du Client (partage d’écran pendant l’assistance, sauvegarde remise pour analyse), il agit en qualité de sous-traitant au sens de l’article 28 du RGPD. Un contrat de sous-traitance conforme à cet article est conclu sur simple demande du Client. Le personnel de l’Éditeur est tenu à la confidentialité et au respect du secret médical (art. L.1110-4 CSP).",
            },
            {
              kind: "p",
              text: "Les données des interlocuteurs du Client sont traitées par l’Éditeur conformément à sa politique de confidentialité.",
            },
          ],
        },
        {
          id: "garanties",
          title: "9. Garanties",
          blocks: [
            {
              kind: "p",
              text: "L’Éditeur garantit que MeDoc est conforme, pour l’essentiel, à sa documentation pendant 12 mois à compter de l’installation. Pendant cette période, il corrige gratuitement les anomalies reproductibles qui lui sont signalées, ou propose une solution de contournement.",
            },
            {
              kind: "p",
              text: "L’Éditeur garantit être titulaire des droits nécessaires à la concession de la licence. Il ne garantit pas que le logiciel fonctionnera sans aucune interruption ni erreur, ni qu’il répondra à des besoins particuliers non décrits dans la documentation.",
            },
            {
              kind: "p",
              text: "Ces garanties ne couvrent pas les dysfonctionnements causés par le matériel, le réseau, un autre logiciel, une modification non autorisée ou le non-respect des prérequis.",
            },
          ],
        },
        {
          id: "dispositif-medical",
          title: "10. MeDoc n’est pas un dispositif médical",
          blocks: [
            {
              kind: "p",
              text: "MeDoc est un logiciel de gestion et de documentation destiné aux professionnels dentaires. Il n’a pas de finalité médicale au sens du règlement (UE) 2017/745 relatif aux dispositifs médicaux : il ne pose aucun diagnostic et ne propose aucun traitement.",
            },
            {
              kind: "p",
              text: "Toute décision clinique, prescription ou acte de soin relève de la seule responsabilité du chirurgien-dentiste, qui vérifie le contenu des documents produits avant de les signer ou de les remettre.",
            },
          ],
        },
        {
          id: "responsabilite",
          title: "11. Responsabilité",
          blocks: [
            {
              kind: "p",
              text: "L’Éditeur est tenu d’une obligation de moyens. Sa responsabilité ne peut être engagée que pour les dommages directs et prévisibles résultant d’un manquement prouvé à ses obligations (art. 1231-3 C. civ.).",
            },
            {
              kind: "p",
              text: "Sont exclus les dommages indirects, tels que la perte de chiffre d’affaires, de clientèle ou d’exploitation, ainsi que la perte de données lorsque le Client n’a pas respecté son obligation de sauvegarde.",
            },
            {
              kind: "p",
              text: "Toutes causes confondues, la responsabilité de l’Éditeur est plafonnée au montant des sommes effectivement versées par le Client au cours des 12 mois précédant le fait générateur. Ce plafond ne s’applique pas en cas de faute lourde ou dolosive, ni aux dommages corporels.",
            },
            {
              kind: "p",
              text: "Aucune partie n’est responsable d’un manquement dû à un cas de force majeure au sens de l’article 1218 du Code civil.",
            },
          ],
        },
        {
          id: "propriete",
          title: "12. Propriété intellectuelle et confidentialité",
          blocks: [
            {
              kind: "p",
              text: "MeDoc, son code, sa documentation et la marque MeDoc restent la propriété exclusive de {company}. Le contrat ne transfère au Client aucun droit autre que la licence décrite à l’article 3. Les données saisies par le Client restent sa propriété ; il peut les exporter à tout moment.",
            },
            {
              kind: "p",
              text: "Chaque partie garde confidentielles les informations non publiques de l’autre dont elle a connaissance à l’occasion du contrat, pendant toute sa durée et 5 ans après sa fin. Les données patients restent confidentielles sans limite de durée.",
            },
          ],
        },
        {
          id: "duree-resiliation",
          title: "13. Durée et résiliation",
          blocks: [
            {
              kind: "p",
              text: "La licence est concédée pour une durée illimitée. Les forfaits de service suivent la durée et les règles de résiliation de l’article 5.",
            },
            {
              kind: "p",
              text: "En cas de manquement grave d’une partie non réparé dans les 30 jours suivant une mise en demeure par lettre recommandée avec avis de réception, l’autre partie peut résilier le contrat de plein droit (art. 1224 et suivants C. civ.). La licence peut être résiliée pour violation de ses limites d’utilisation ou pour défaut de paiement du prix de la licence.",
            },
            {
              kind: "p",
              text: "À la fin d’un forfait, le Client conserve l’usage de la licence et de ses données. L’Éditeur supprime toute sauvegarde du Client encore en sa possession.",
            },
          ],
        },
        {
          id: "droit-applicable",
          title: "14. Droit applicable et litiges",
          blocks: [
            {
              kind: "p",
              text: "Le contrat est soumis au droit français. Les parties recherchent d’abord une solution amiable. À défaut d’accord dans un délai de 30 jours, tout litige relatif à la formation, l’exécution ou la fin du contrat relève de la compétence exclusive du tribunal de commerce de {court}, y compris en cas de pluralité de défendeurs ou d’appel en garantie.",
            },
          ],
        },
        {
          id: "divers",
          title: "15. Dispositions diverses",
          blocks: [
            {
              kind: "p",
              text: "Si une clause des Conditions est déclarée nulle ou inapplicable, elle est réputée non écrite et les autres clauses restent en vigueur. Le fait pour une partie de ne pas se prévaloir d’un manquement ne vaut pas renonciation à s’en prévaloir ultérieurement.",
            },
            {
              kind: "p",
              text: "L’Éditeur peut faire évoluer les Conditions. La version applicable est celle en vigueur à la date de la commande ; pour les forfaits en cours, une nouvelle version s’applique au plus tôt un mois après sa notification au Client, qui peut résilier son forfait dans ce délai.",
            },
          ],
        },
      ],
    },
  },
};
