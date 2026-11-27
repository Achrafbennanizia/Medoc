import type { LegalDocument } from "./types";
import { UPDATED } from "./updated";

/** Terms of sale and licence (en), part of LEGAL_EN in en.ts. */
export const EN_TERMS: LegalDocument = {
  title: "General terms of sale and licence",
  summary: "The terms that govern the sale of MeDoc Dentist licences and service plans to dental practices. They apply to professionals only.",
  updated: UPDATED,
  sections: [
    {
      id: "purpose",
      title: "Purpose and scope",
      blocks: [
        {
          kind: "p",
          text: "These general terms govern the relationship between {company} (the “Supplier”) and any dental practice, dental centre or dental practitioner that acquires a licence to use MeDoc Dentist or a service plan (the “Customer”).",
        },
        {
          kind: "p",
          text: "This offer is made only to professionals who contract for the purposes of their professional activity. Law No. 31-08 on consumer protection does not apply to it, because the Customer is not a consumer within the meaning of that law.",
        },
        {
          kind: "p",
          text: "These terms apply to every order and prevail over the Customer's general terms, unless the parties agree otherwise in writing. In case of conflict, the signed quote prevails, then these terms.",
        },
      ],
    },
    {
      id: "order",
      title: "Orders and formation of the contract",
      blocks: [
        {
          kind: "p",
          text: "The contract is formed when the Customer signs the quote or accepts it in writing, and pays the first instalment. It may be concluded electronically, under the provisions of the Code of Obligations and Contracts (DOC) on contracts concluded electronically, as introduced by Law No. 53-05 on the electronic exchange of legal data, and under Law No. 43-20 on trust services for electronic transactions.",
        },
        {
          kind: "p",
          text: "The quote states the type of licence, the number of workstations, the service plan chosen, the amount and the expected installation date. The Supplier keeps a copy of the contract and provides it to the Customer on request.",
        },
      ],
    },
    {
      id: "licence",
      title: "Licence to use",
      blocks: [
        {
          kind: "p",
          text: "Once the price has been paid in full, the Supplier grants the Customer a perpetual, non-exclusive and non-transferable licence to use MeDoc Dentist for one practice, within the number of workstations stated in the quote. Until full payment, a temporary licence is granted on the same terms.",
        },
        {
          kind: "facts",
          rows: [
            ["Essentiel", "MAD 24,900 excl. tax, including 3 months of service"],
            ["Cabinet", "MAD 29,900 excl. tax, including 6 months of service"],
            ["Cabinet+", "MAD 34,900 excl. tax, including 12 months of service"],
          ],
        },
        {
          kind: "p",
          text: "The Customer may not copy the software beyond what is needed to use it and to keep its backups, modify, decompile or reverse-engineer it, or rent, lend or transfer it to third parties, except within the limits expressly allowed by law. The licence remains in force without a service plan.",
        },
      ],
    },
    {
      id: "delivery",
      title: "Delivery and installation",
      blocks: [
        {
          kind: "p",
          text: "The Supplier installs the software on the practice's computers on the agreed date, on site or remotely. Delivery is complete when the software runs on the agreed workstations. The Customer must state any reservations in writing within eight days of installation. Otherwise, delivery is deemed accepted.",
        },
        {
          kind: "p",
          text: "The Customer undertakes to provide computers and a local network that meet the technical requirements the Supplier communicates before installation, and to give the Supplier access to them on the agreed date.",
        },
      ],
    },
    {
      id: "service-plans",
      title: "Service plans: content, term and termination",
      blocks: [
        {
          kind: "facts",
          rows: [
            ["Sécurité", "MAD 110 per month excl. tax: security and legal updates, and the help centre."],
            ["Confort", "MAD 290 per month excl. tax: all of the above, plus feature updates, phone and WhatsApp support during business hours, and a monthly backup check."],
            ["Premium", "MAD 540 per month excl. tax: all of the above, plus priority support within 4 hours, a yearly visit and training, and help preparing the practice's file with the CNDP."],
          ],
        },
        {
          kind: "p",
          text: "Each licence includes the period of service stated above, from the installation date. When that period ends, the plan chosen by the Customer, if any, begins. A plan is taken out for one month and renews automatically from month to month.",
        },
        {
          kind: "p",
          text: "Either party may end a plan by written notice, including by e-mail, with one month's notice. Termination takes effect on the last day of the month following the date on which the other party receives the notice. Amounts paid for the current month are not refunded.",
        },
        {
          kind: "p",
          text: "Without a service plan, the software keeps working. The Customer receives security fixes free of charge for 12 months from the date of purchase. After that, updates and support are provided only under a current plan.",
        },
      ],
    },
    {
      id: "prices-payment",
      title: "Prices and payment",
      blocks: [
        {
          kind: "p",
          text: "Prices are in Moroccan dirhams (MAD), excluding tax. VAT is added at the applicable rate, currently 20% on software. Invoices are issued in accordance with Article 145 of the General Tax Code.",
        },
        {
          kind: "list",
          items: [
            "Licence price: 40% on signature, 30% on installation and 30% thirty days after installation.",
            "Service plans: invoiced monthly and paid in advance at the start of each month.",
          ],
        },
        {
          kind: "p",
          text: "Any late payment gives rise, by operation of law and without any formal notice, to the late-payment penalties provided for in the Commercial Code (Law No. 15-95), as amended by Law No. 69-21 on payment terms. After a formal notice that remains without effect for fifteen days, the Supplier may suspend the services linked to the plan until payment is made, without affecting the operation of the software.",
        },
      ],
    },
    {
      id: "customer-duties",
      title: "Customer's obligations",
      blocks: [
        {
          kind: "list",
          items: [
            "Provide and maintain computers, a network and operating systems that meet the technical requirements.",
            "Make regular backups, keep a copy outside the practice, and check that they can be restored.",
            "Manage user accounts, passwords and access rights, and keep them confidential.",
            "As controller, complete the prior formalities with the CNDP for patient data, under Articles 12 and 21 of Law No. 09-08, and inform patients of their rights.",
            "Use the software for its intended purpose and in accordance with the documentation provided.",
          ],
        },
      ],
    },
    {
      id: "personal-data",
      title: "Personal data",
      blocks: [
        {
          kind: "p",
          text: "The Customer is the controller of its patients' data. This data is stored encrypted on the Customer's computers and is not hosted by the Supplier. The Supplier sees it only when a screen is shared during a support session or a backup is handed over for analysis. In that case it acts as a processor under Article 24 of Law No. 09-08, solely on the Customer's instructions.",
        },
        {
          kind: "p",
          text: "On request, the Supplier provides a written processing agreement that sets out the security measures and confidentiality obligations. The Supplier's staff are bound by professional secrecy under Article 446 of the Penal Code. The privacy policy applies to the data the Supplier processes on its own behalf.",
        },
      ],
    },
    {
      id: "warranty",
      title: "Warranty",
      blocks: [
        {
          kind: "p",
          text: "The Supplier warrants that, on delivery, the software works substantially in accordance with the documentation provided. The warranty against latent defects under the Code of Obligations and Contracts applies, as suited to the nature of software. The Customer must notify the Supplier of a defect in writing as soon as it is discovered, with a description that allows it to be reproduced. The Supplier undertakes to correct it or to provide a workaround within a reasonable time. If this is not possible, the Customer may ask for the contract to be rescinded or for the price to be reduced, as provided by law.",
        },
        {
          kind: "p",
          text: "The Supplier does not warrant that the software is free of all errors or that it will run without interruption. The warranty does not cover faults caused by hardware, the network, third-party software, modifications, or use that does not follow the documentation.",
        },
      ],
    },
    {
      id: "liability",
      title: "Liability",
      blocks: [
        {
          kind: "p",
          text: "The Supplier is liable only for direct damage resulting from a breach of its obligations. It is not liable for indirect damage, including loss of profit or of clientele, or loss of data caused by a lack of backups, for which the Customer is responsible.",
        },
        {
          kind: "p",
          text: "The Supplier's total liability is capped at the total amounts the Customer paid the Supplier in the twelve months before the event that caused the damage. This cap does not apply in case of fraud or gross fault, under Article 232 of the Code of Obligations and Contracts.",
        },
      ],
    },
    {
      id: "not-medical-device",
      title: "Not a medical device",
      blocks: [
        {
          kind: "p",
          text: "MeDoc Dentist is management and record-keeping software for licensed dental professionals. It is not a medical device. It does not make diagnoses or suggest treatments. Clinical decisions, prescriptions and the content of certificates remain the sole responsibility of the dentist, who must check every document before signing it or handing it over.",
        },
      ],
    },
    {
      id: "intellectual-property",
      title: "Intellectual property",
      blocks: [
        {
          kind: "p",
          text: "The software, its documentation and its updates remain the property of {company} and are protected by Law No. 2-00 on copyright and related rights. The contract transfers no ownership right to the Customer, only a right of use under the licence terms. The data the Customer enters in the software remains the Customer's property.",
        },
      ],
    },
    {
      id: "confidentiality",
      title: "Confidentiality",
      blocks: [
        {
          kind: "p",
          text: "Each party undertakes to keep confidential any non-public information it learns while performing the contract, and to use it only for that purpose, for the term of the contract and for five years after it ends. The duty of professional secrecy concerning patient data continues without time limit.",
        },
      ],
    },
    {
      id: "termination",
      title: "Term and termination",
      blocks: [
        {
          kind: "p",
          text: "The licence to use remains in force without time limit as long as the Customer complies with its terms. If either party breaches an essential obligation, the other party may terminate the contract after a written formal notice that remains without effect for thirty days.",
        },
        {
          kind: "p",
          text: "If the licence is terminated for non-payment of its price, the Customer must stop using the software. In every case, the Customer may export its data beforehand. Termination does not affect amounts due or the clauses that by their nature survive it, including confidentiality, liability and intellectual property.",
        },
      ],
    },
    {
      id: "law-court",
      title: "Applicable law, jurisdiction and severability",
      blocks: [
        {
          kind: "p",
          text: "This contract is governed by Moroccan law. The parties will try to settle any dispute amicably. If they cannot do so within thirty days, the Commercial Court of {court} has jurisdiction.",
        },
        {
          kind: "p",
          text: "If any clause of these terms is held void or unenforceable, the other clauses remain in force, and the void clause is replaced by a valid clause as close as possible to the parties' intention.",
        },
      ],
    },
  ],
};
