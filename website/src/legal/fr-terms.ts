import type { LegalDocument } from "./types";
import { UPDATED } from "./updated";

/** Terms of sale and licence (fr), part of LEGAL_FR in fr.ts. */
export const FR_TERMS: LegalDocument = {
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
};
