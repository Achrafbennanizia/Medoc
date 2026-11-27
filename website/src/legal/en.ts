import type { LegalSet } from "./types";

const UPDATED = "2026-11-22";

/** English version of the Moroccan-law set in ar.ts. Keep the two in step, section by section. */
export const LEGAL_EN: LegalSet = {
  jurisdictionLabel: "Applies under Moroccan law",
  reviewNote: "These texts are a draft. A lawyer qualified in Moroccan law must review them before they are published.",
  docs: {
    "legal-notice": {
      title: "Legal notice",
      summary: "Who publishes and hosts this website, and the terms for using it.",
      updated: UPDATED,
      sections: [
        {
          id: "publisher",
          title: "Publisher of the website",
          blocks: [
            { kind: "p", text: "This website is published and operated by:" },
            {
              kind: "facts",
              rows: [
                ["Company name", "{company}"],
                ["Legal form", "{legalForm}"],
                ["Share capital", "{capital}"],
                ["Registered office", "{address}, {country}"],
                ["Trade Register (RC)", "{registry}, No. {registryNumber}"],
                ["Tax identification number (IF)", "{taxId}"],
                ["Common Company Identifier (ICE)", "{ice}"],
                ["E-mail", "{email}"],
                ["Phone", "{phone}"],
                ["Legal representative", "{director}"],
              ],
            },
          ],
        },
        {
          id: "publication-director",
          title: "Director of publication",
          blocks: [
            { kind: "p", text: "The director of publication of this website is {director}, as legal representative of {company}." },
          ],
        },
        {
          id: "host",
          title: "Host",
          blocks: [
            { kind: "p", text: "This website is hosted by: {hostingProvider}." },
          ],
        },
        {
          id: "professional-offer",
          title: "An offer for professionals only",
          blocks: [
            {
              kind: "p",
              text: "This website presents MeDoc Dentist, software for managing dental practices. The offer is made only to professionals, that is, dental practices, dental centres and licensed practitioners. It is not made to consumers within the meaning of Law No. 31-08 on consumer protection.",
            },
            {
              kind: "p",
              text: "Prices shown on this website are in Moroccan dirhams (MAD), excluding value added tax (VAT). Sales are governed by the general terms of sale and licence published on this website.",
            },
          ],
        },
        {
          id: "intellectual-property",
          title: "Intellectual property",
          blocks: [
            {
              kind: "p",
              text: "The texts, images, drawings and logos, the design of this website and the MeDoc Dentist software are protected by Law No. 2-00 on copyright and related rights. They belong to {company} or are used by it under licence.",
            },
            {
              kind: "p",
              text: "No part of this website may be copied, republished, modified or used commercially without the prior written permission of {company}, except for personal use or a short quotation that names the source, within the limits allowed by law.",
            },
          ],
        },
        {
          id: "links",
          title: "Links",
          blocks: [
            {
              kind: "p",
              text: "This website may contain links to websites or services run by third parties, including an optional link to WhatsApp. {company} does not control the content of these websites or how they process data, and accepts no liability for them.",
            },
            {
              kind: "p",
              text: "You may link to the home page of this website without permission, provided the link does not suggest a partnership or endorsement that does not exist.",
            },
          ],
        },
        {
          id: "liability",
          title: "Publisher's liability for content",
          blocks: [
            {
              kind: "p",
              text: "{company} takes care to keep the information published here accurate and up to date. It is general information, however, and is not a binding contractual offer. The final contractual terms are set in the quote or the signed contract.",
            },
          ],
        },
        {
          id: "privacy",
          title: "Protection of personal data",
          blocks: [
            {
              kind: "p",
              text: "This website uses no audience measurement or tracking tools. It sets only necessary cookies, and only when you choose a language or a theme, or close the cookie notice. The privacy policy explains how personal data is processed under Law No. 09-08 on the protection of individuals with regard to the processing of personal data.",
            },
          ],
        },
        {
          id: "law",
          title: "Applicable law",
          blocks: [
            {
              kind: "p",
              text: "This notice and the use of this website are governed by Moroccan law. In the event of a dispute, the Commercial Court of {court} has jurisdiction.",
            },
          ],
        },
      ],
    },

    "privacy-notice": {
      title: "Privacy notice",
      summary: "A short, clear summary of what we do with your data when you visit this website, contact us or use MeDoc Dentist.",
      updated: UPDATED,
      sections: [
        {
          id: "who",
          title: "Who we are",
          blocks: [
            {
              kind: "p",
              text: "{company}, {address}, {country}, is the controller of the data relating to this website and to its business relationships. To contact us about your data: {dpoContact}.",
            },
          ],
        },
        {
          id: "website",
          title: "The website: no tracking cookies, no tracking",
          blocks: [
            {
              kind: "list",
              items: [
                "No analytics or tracking tools: only necessary cookies, set when you make a choice.",
                "Your choice of language and of light or dark mode is stored by your browser alone and is not sent to us.",
                "Fonts are served from the website's own server, so your browser does not connect to outside font services.",
                "The host, {hostingProvider}, keeps technical logs (IP address, time, page requested) for a short time, for security purposes.",
              ],
            },
          ],
        },
        {
          id: "contact",
          title: "Demo requests and contact",
          blocks: [
            {
              kind: "p",
              text: "The demo request form sends what you enter (name, practice, city, phone, e-mail, message) over an encrypted connection to our server at sifralabs.com, hosted by Cloudflare, which forwards it by e-mail to {email}. Our e-mail is hosted by Zoho. The website keeps no copy. If our server cannot be reached, your e-mail program opens instead with a ready-made message. We use what you send us to reply to you and to prepare an offer. The WhatsApp link is optional. If you use it, Meta's policy applies and your data may be transferred outside Morocco.",
            },
          ],
        },
        {
          id: "software",
          title: "MeDoc Dentist and patient data",
          blocks: [
            {
              kind: "p",
              text: "Patient data is stored encrypted on the practice's computers only. In Cabinet and Cabinet+, it is synchronised within the practice's local network. We do not host this data or transfer it abroad. We see it only if the practice shares its screen during a support session or gives us a backup to analyse, and in that case we act as a processor under a written contract. The update check sends only the software's version number.",
            },
          ],
        },
        {
          id: "retention",
          title: "Retention and sharing",
          blocks: [
            {
              kind: "p",
              text: "We do not sell or rent your data. We keep it for as long as the purpose for which it was collected requires, and we keep accounting documents for ten years under Article 22 of the Commercial Code.",
            },
          ],
        },
        {
          id: "rights",
          title: "Your rights",
          blocks: [
            {
              kind: "p",
              text: "You have the rights to information, access, rectification and objection under Articles 5, 7, 8 and 9 of Law No. 09-08. Write to us at {dpoContact}. You can also lodge a complaint with the National Commission for the Control of Personal Data Protection (CNDP). The full details are in the privacy policy.",
            },
          ],
        },
      ],
    },

    "privacy-policy": {
      title: "Privacy policy",
      summary: "The full text on how {company} processes the personal data of website visitors, prospects and customers, and on its role regarding MeDoc Dentist, under Law No. 09-08.",
      updated: UPDATED,
      sections: [
        {
          id: "controller",
          title: "Controller and contact",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Controller", "{company}, {legalForm}"],
                ["Address", "{address}, {country}"],
                ["Legal representative", "{director}"],
                ["Data protection contact", "{dpoContact}"],
                ["Declaration to the CNDP", "[CNDP declaration receipt number], available on request"],
              ],
            },
            {
              kind: "p",
              text: "This policy applies Law No. 09-08 on the protection of individuals with regard to the processing of personal data and its implementing texts.",
            },
          ],
        },
        {
          id: "website",
          title: "Visiting the website",
          blocks: [
            {
              kind: "p",
              text: "The website is static and has no user accounts. It uses no audience measurement, advertising or tracking tools, and it sets only the necessary cookies listed below.",
            },
            {
              kind: "list",
              items: [
                "Display preferences: your language and light or dark mode are stored in the website's own cookies (medoc_lang and medoc_theme, for 12 months), only when you choose them, and are not sent to us. medoc_cookie_notice records that you closed the cookie notice. You can delete these cookies in your browser settings.",
                "Fonts: served from the website's own server, so your address is not passed to any outside font provider.",
                "Server logs: the host, {hostingProvider}, records the IP address, the time of the request and the page requested, to keep the website secure and working properly, on the basis of legitimate interest (Article 4 of Law No. 09-08). These logs are kept for a short time, no longer than this purpose requires.",
              ],
            },
          ],
        },
        {
          id: "demo-whatsapp",
          title: "Demo requests and the WhatsApp link",
          blocks: [
            {
              kind: "p",
              text: "The demo request form sends your data over an encrypted connection to our server at sifralabs.com (Cloudflare), which forwards it by e-mail to {email} (e-mail hosted by Zoho). The server keeps no copy. If it cannot be reached, your e-mail program opens instead with a ready-made message.",
            },
            {
              kind: "p",
              text: "The WhatsApp link is optional. If you use it, Meta processes your data under its own policy, which may involve transferring data outside Morocco. This happens only if you choose to use the link.",
            },
          ],
        },
        {
          id: "prospects-customers",
          title: "Prospects and customers: purposes and legal bases",
          blocks: [
            {
              kind: "p",
              text: "We process the data of people who contact us or who represent a customer practice: name, position, practice name, e-mail, phone, address, billing details (ICE, IF) and the content of correspondence.",
            },
            {
              kind: "list",
              items: [
                "Answering requests and preparing offers: taking pre-contractual steps at your request (Article 4 of Law No. 09-08).",
                "Performing the contract: delivery, installation, support, updates and management of the customer account (performance of the contract).",
                "Invoicing and accounting: complying with legal obligations, including Article 145 of the General Tax Code and the Commercial Code (legal obligation).",
                "Following up the business relationship, improving our service and protecting our rights in a dispute (legitimate interest).",
                "Sending commercial information about our products by e-mail to people who are not customers: only with your consent, which you can withdraw at any time.",
              ],
            },
          ],
        },
        {
          id: "software",
          title: "MeDoc Dentist: who does what",
          blocks: [
            {
              kind: "p",
              text: "MeDoc Dentist is management and record-keeping software installed on the practice's computers. Patient data (the record, tooth chart, appointments, prescriptions, certificates, invoices) is stored encrypted (SQLCipher / AES-256) on these computers. In Cabinet and Cabinet+, it is synchronised only between the practice's own devices, within its local network.",
            },
            {
              kind: "list",
              items: [
                "The practice is the controller of its patients' data. It must complete the prior formalities with the CNDP that apply to health data, under Articles 12 and 21 of Law No. 09-08.",
                "{company} does not host patient data, does not transfer it abroad and does not see it during normal use.",
                "We see patient data in only two cases: if the practice shares its screen during a support session, or if it gives us a backup to analyse. In both cases we act as a processor under Article 24 of Law No. 09-08, on the practice's instructions and under a written contract.",
                "Update checks: the software contacts our update server and sends only the version number, with no patient data.",
              ],
            },
          ],
        },
        {
          id: "security",
          title: "Data security and professional secrecy",
          blocks: [
            {
              kind: "p",
              text: "Under Article 23 of Law No. 09-08, we take appropriate technical and organisational measures to protect data against destruction, loss and unauthorised access.",
            },
            {
              kind: "list",
              items: [
                "The software's database is encrypted on the computers (SQLCipher / AES-256).",
                "Synchronisation is limited to the practice's local network (Cabinet and Cabinet+).",
                "Support staff access only what they need, and backups given to us for analysis are deleted once the work is done.",
                "Our staff are bound by confidentiality, and we respect the professional secrecy set out in Article 446 of the Penal Code for medical data.",
              ],
            },
          ],
        },
        {
          id: "recipients",
          title: "Recipients and processors",
          blocks: [
            {
              kind: "p",
              text: "Only authorised staff of {company} see your data, and only as far as their duties require. We use processors that handle data on our behalf and on our instructions, including:",
            },
            {
              kind: "list",
              items: [
                "The website host: {hostingProvider}.",
                "Our e-mail service provider.",
                "Our accountant or chartered accountant, and banks for processing payments.",
              ],
            },
            {
              kind: "p",
              text: "We may disclose data to administrative or judicial authorities where the law requires us to. We do not sell or rent data.",
            },
          ],
        },
        {
          id: "transfers",
          title: "Transfers abroad",
          blocks: [
            {
              kind: "p",
              text: "As a rule, we do not transfer any personal data outside Morocco. If this ever becomes necessary, the transfer will take place only under Articles 43 and 44 of Law No. 09-08, that is, to a country that ensures an adequate level of protection, with the authorisation of the CNDP, or in one of the exceptional cases set by law. We will update this policy beforehand.",
            },
            {
              kind: "p",
              text: "The exception is your optional use of the WhatsApp link, for which Meta is responsible for its own processing.",
            },
          ],
        },
        {
          id: "retention",
          title: "Retention periods",
          blocks: [
            {
              kind: "list",
              items: [
                "Server logs: a short period, for security purposes.",
                "Correspondence with prospects who did not sign a contract: at most three years after the last contact.",
                "Customer data: for the duration of the contractual relationship, then for the applicable limitation period, as evidence.",
                "Invoices and accounting documents: ten years, under Article 22 of the Commercial Code.",
                "Backups given to us for analysis: deleted as soon as the analysis is finished.",
              ],
            },
          ],
        },
        {
          id: "rights",
          title: "Your rights and how to exercise them",
          blocks: [
            {
              kind: "list",
              items: [
                "Right to information (Article 5): to know the identity of the controller, the purposes of the processing, the recipients and your rights. This policy gives you that information.",
                "Right of access (Article 7): to obtain confirmation that your data is being processed, and a copy of it.",
                "Right to rectification (Article 8): to have inaccurate or incomplete data corrected, updated or erased.",
                "Right to object (Article 9): to object, on legitimate grounds, to the processing of your data, and to object without giving reasons to its use for commercial prospecting.",
              ],
            },
            {
              kind: "p",
              text: "To exercise your rights, write to us at {dpoContact} or by post to {address}. We may ask for proof of identity if there is reasonable doubt. We reply as soon as possible and within the legal time limits.",
            },
            {
              kind: "p",
              text: "If your request concerns a patient's data stored in MeDoc Dentist, the practice is the controller and you should contact it directly. We will help it reply if it asks us to.",
            },
          ],
        },
        {
          id: "complaint",
          title: "Complaints to the CNDP",
          blocks: [
            {
              kind: "p",
              text: "If you believe your rights have not been respected, you can lodge a complaint with the National Commission for the Control of Personal Data Protection (CNDP). You may also contact us first to try to find a solution.",
            },
          ],
        },
        {
          id: "changes",
          title: "Changes to this policy",
          blocks: [
            {
              kind: "p",
              text: "We may change this policy as the website, the software or the law changes. The date of the last review is shown at the top of the page. We inform our customers in advance of any material change.",
            },
          ],
        },
      ],
    },

    terms: {
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
    },
  },
};
