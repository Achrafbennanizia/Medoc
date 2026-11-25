import type { LegalSet } from "./types";

const UPDATED = "2026-11-22";

export const LEGAL_EN: LegalSet = {
  jurisdictionLabel: "Written for the European Union (GDPR)",
  reviewNote:
    "These texts are a draft and must be reviewed by a qualified lawyer before they are published or used in a contract.",
  docs: {
    "legal-notice": {
      title: "Legal notice",
      summary:
        "Who provides this website and the MeDoc software, as required by Article 5 of the EU e-Commerce Directive 2000/31/EC.",
      updated: UPDATED,
      sections: [
        {
          id: "provider",
          title: "Provider of this website",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Company", "{company}"],
                ["Legal form", "{legalForm}"],
                ["Registered office", "{address}, {country}"],
                ["Share capital", "{capital}"],
                ["Legal representative", "{director}"],
              ],
            },
          ],
        },
        {
          id: "contact",
          title: "Contact",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["E-mail", "{email}"],
                ["Phone", "{phone}"],
                ["Postal address", "{address}, {country}"],
              ],
            },
            {
              kind: "p",
              text: "The e-mail address above is the fastest way to reach us. We answer in the order requests arrive.",
            },
          ],
        },
        {
          id: "register",
          title: "Company register and tax numbers",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Register", "{registry}"],
                ["Registration number", "{registryNumber}"],
                ["VAT identification number", "{vatId}"],
                ["Tax number", "{taxId}"],
              ],
            },
          ],
        },
        {
          id: "responsible",
          title: "Responsible for the content",
          blocks: [
            {
              kind: "p",
              text: "{director}, {company}, {address}, {country}, is responsible for the content of this website.",
            },
          ],
        },
        {
          id: "professionals",
          title: "Offer for professionals only",
          blocks: [
            {
              kind: "p",
              text: "Our offer is addressed exclusively to licensed dental practices and other healthcare professionals acting in the course of their professional activity. We do not sell to consumers.",
            },
            {
              kind: "p",
              text: "For this reason, the rules on consumer dispute resolution do not apply to our contracts. We are neither obliged nor willing to take part in dispute resolution proceedings before a consumer arbitration board.",
            },
          ],
        },
        {
          id: "content-liability",
          title: "Liability for content",
          blocks: [
            {
              kind: "p",
              text: "We prepare the content of this website with care. It describes our product and our offer in general terms and is not a binding offer. Only the written order confirmation and our terms of sale and licence are binding.",
            },
            {
              kind: "p",
              text: "We do not guarantee that the information on this website is complete, current or free of errors at all times. If you notice an error, please tell us at {email}.",
            },
          ],
        },
        {
          id: "links",
          title: "Liability for links",
          blocks: [
            {
              kind: "p",
              text: "This website may contain links to websites of third parties, for example WhatsApp. We have no influence on their content and are not responsible for it. The provider of the linked page is responsible for its content.",
            },
            {
              kind: "p",
              text: "We checked linked pages for obvious legal violations when we set the link. If we become aware of a violation, we remove the link without delay.",
            },
          ],
        },
        {
          id: "copyright",
          title: "Copyright",
          blocks: [
            {
              kind: "p",
              text: "The texts, images, screenshots, logos and the software MeDoc are protected by copyright and other intellectual property rights. They belong to {company} unless stated otherwise.",
            },
            {
              kind: "p",
              text: "Copying, editing, distributing or any other use beyond the limits of copyright law requires our prior written consent. Fonts and other third-party components are used under their respective licences.",
            },
          ],
        },
      ],
    },

    "privacy-notice": {
      title: "Privacy notice",
      summary:
        "A short, plain-language overview of what happens to your data when you visit this website. The full details are in our privacy policy.",
      updated: UPDATED,
      sections: [
        {
          id: "who",
          title: "Who we are",
          blocks: [
            {
              kind: "p",
              text: "{company}, {address}, {country}, operates this website and is the controller for the data described here under the General Data Protection Regulation (EU) 2016/679 (GDPR).",
            },
            {
              kind: "p",
              text: "Questions about data protection: {dpoContact}.",
            },
          ],
        },
        {
          id: "collect",
          title: "What this website collects",
          blocks: [
            {
              kind: "p",
              text: "Almost nothing. This website uses no analytics, no advertising and no tracking. It sets only necessary first-party cookies, and only when you choose a language, a theme or a country, or close the cookie notice. Our fonts are stored on our own server, so your browser does not contact font services or other third parties when you load a page.",
            },
          ],
        },
        {
          id: "email",
          title: "When you write to us",
          blocks: [
            {
              kind: "p",
              text: "The demo form sends what you enter (name, practice, city, phone, e-mail, message) over an encrypted connection to our server at sifralabs.com, run on Cloudflare, which forwards it by e-mail to {email}; our mailbox is hosted by Zoho. The website keeps no copy. If our server can't be reached, your own e-mail program opens with the prepared message instead, and you decide whether to send it.",
            },
            {
              kind: "p",
              text: "If you send it, we use your name, contact details and message only to answer your request and, if you wish, to prepare an offer. If you contact us through WhatsApp, WhatsApp (Meta) processes your data under its own privacy policy.",
            },
          ],
        },
        {
          id: "local-storage",
          title: "Settings stored in your browser",
          blocks: [
            {
              kind: "p",
              text: "The website remembers the language and the light or dark theme you chose. This is stored only in your browser (local storage). It is never sent to us. You can delete it at any time in your browser settings.",
            },
          ],
        },
        {
          id: "hosting",
          title: "Hosting and server logs",
          blocks: [
            {
              kind: "p",
              text: "The website is hosted by {hostingProvider}. To deliver pages and protect the server against attacks, the host briefly records your IP address, the time of the request and the page requested. These logs are deleted automatically after a short period.",
            },
          ],
        },
        {
          id: "rights",
          title: "Your rights",
          blocks: [
            {
              kind: "p",
              text: "You can ask us for access to your data, its correction or deletion, a restriction of its use or a copy of it, and you can object to its use. You can also complain to the data protection supervisory authority in the EU member state where you live or work.",
            },
          ],
        },
        {
          id: "contact",
          title: "Contact and full policy",
          blocks: [
            {
              kind: "p",
              text: "Write to {dpoContact} or {email}. Our privacy policy explains in full how we handle data on this website, in our customer relationships and in the MeDoc software.",
            },
          ],
        },
      ],
    },

    "privacy-policy": {
      title: "Privacy policy",
      summary:
        "How {company} processes personal data on this website, in sales and customer relationships, and in connection with the MeDoc software, under Articles 13 and 14 GDPR.",
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
                ["E-mail", "{email}"],
                ["Phone", "{phone}"],
                ["Data protection contact", "{dpoContact}"],
              ],
            },
            {
              kind: "p",
              text: "This policy applies under the General Data Protection Regulation (EU) 2016/679 (GDPR). Articles cited below refer to the GDPR unless stated otherwise.",
            },
          ],
        },
        {
          id: "website",
          title: "Website: what we process and why",
          blocks: [
            {
              kind: "p",
              text: "This is a static website. It uses no analytics, tracking, advertising or social media plug-ins. Fonts are served from our own host, so no third party receives your IP address when you load a page.",
            },
            {
              kind: "facts",
              rows: [
                ["medoc_lang", "Language you chose. 12 months."],
                ["medoc_theme", "Light or dark theme you chose. 12 months."],
                ["medoc_country", "Country you chose (adapts documents and prices shown). 12 months."],
                ["medoc_cookie_notice", "Remembers that you closed the cookie notice. 12 months."],
              ],
            },
            {
              kind: "p",
              text: "These first-party cookies are set only when you make the choice, never by default, and are not sent to anyone else. They are strictly necessary for the service you ask for, so they need no consent (Article 5(3) of Directive 2002/58/EC). The country is first guessed from your browser's time zone and language, on your device only; that guess is not stored. You can delete the cookies at any time in your browser settings.",
            },
            {
              kind: "list",
              items: [
                "Server logs: {hostingProvider} records your IP address, the date and time of the request and the page requested. Purpose: delivering the website and protecting it against misuse and attacks. Legal basis: Article 6(1)(f), our legitimate interest in a secure, working website. The logs are kept only as long as needed for this purpose and then deleted automatically.",
                "Local storage: your chosen language and light or dark theme are stored in your browser only, because you asked for this function. This information is not sent to us. Storing it is strictly necessary for a service you requested (Article 5(3) of Directive 2002/58/EC). You can delete it in your browser at any time.",
                "Demo form: your entries are sent over an encrypted connection to our server at sifralabs.com (Cloudflare), which forwards them by e-mail to {email} (mailbox hosted by Zoho). The server keeps no copy. If it can't be reached, your own e-mail program opens with a prepared message instead.",
                "WhatsApp: if you use the optional WhatsApp link, WhatsApp, a service of Meta, processes your data as its own controller under its own privacy policy. Use e-mail if you do not want this.",
              ],
            },
          ],
        },
        {
          id: "sales",
          title: "Enquiries, sales and customer relationship",
          blocks: [
            {
              kind: "p",
              text: "When you contact us or become a customer, we process the contact details of the people we deal with (name, practice, role, e-mail, phone, postal address), the content of our correspondence, offers, contracts, licence data (practice, number of workstations, licence key), installation and support records, invoices and payment data.",
            },
            {
              kind: "list",
              items: [
                "Answering enquiries, preparing offers, performing the contract, installation, support and service plans: Article 6(1)(b).",
                "Keeping invoices and accounting records as required by tax and commercial law: Article 6(1)(c).",
                "Communicating with contact persons of a customer practice, keeping a record of support requests, and asserting or defending legal claims: Article 6(1)(f), our legitimate interest in running and protecting our business.",
              ],
            },
            {
              kind: "p",
              text: "We do not use your data for newsletters or advertising unless you have asked for this separately.",
            },
          ],
        },
        {
          id: "software-roles",
          title: "MeDoc software: who is responsible for patient data",
          blocks: [
            {
              kind: "p",
              text: "MeDoc runs on the practice's own computers. Patient records, odontograms, appointments, prescriptions, certificates, invoices, cash desk and staff time data are stored in an encrypted database (SQLCipher, AES-256) on those computers. They are synchronised only between the practice's own devices over its local network.",
            },
            {
              kind: "p",
              text: "We do not host patient data and we operate no cloud for it. The dental practice decides why and how patient data is processed and is the controller for this data (Article 4(7)). Health data is a special category of personal data under Article 9; the practice is responsible for its lawful processing and for professional secrecy.",
            },
          ],
        },
        {
          id: "software-access",
          title: "MeDoc software: what we can and cannot see",
          blocks: [
            {
              kind: "p",
              text: "In normal use we have no access to patient data. We can see it only in two cases, and only if the practice chooses to:",
            },
            {
              kind: "list",
              items: [
                "Support session: the practice shares its screen with us so that we can help with a problem. We see what is shown on the screen for the duration of the session. We do not record sessions.",
                "Backup for support: the practice hands us a backup of its database so that we can analyse or repair it. We use it only for that task and delete it when the task is done.",
              ],
            },
            {
              kind: "p",
              text: "In both cases we act as processor on behalf of the practice under Article 28. We process the data only on the practice's documented instructions, and we sign a data processing agreement with the practice before such access. Our staff are bound to confidentiality.",
            },
            {
              kind: "p",
              text: "Update checks: to check for licence and software updates, MeDoc contacts our update server. It sends the application version and the technical data needed for the connection, such as the IP address of the practice's network. It sends no patient data. Legal basis: Article 6(1)(b) and (f), providing updates and security fixes under the licence.",
            },
          ],
        },
        {
          id: "security",
          title: "Security measures",
          blocks: [
            {
              kind: "p",
              text: "We take technical and organisational measures appropriate to the risk, as required by Article 32. They include:",
            },
            {
              kind: "list",
              items: [
                "Encryption of the MeDoc database at rest with SQLCipher (AES-256).",
                "Synchronisation only within the practice's own local network; no patient data in our systems in normal operation.",
                "Support access only when the practice starts it, for a defined task, under a data processing agreement.",
                "Deletion of support backups once the support task is finished.",
                "Access to our own business records limited to staff who need it, and bound to confidentiality.",
              ],
            },
            {
              kind: "p",
              text: "The practice remains responsible for the security of its own computers, network, user accounts and backups.",
            },
          ],
        },
        {
          id: "recipients",
          title: "Recipients and sub-processors",
          blocks: [
            {
              kind: "p",
              text: "We do not sell personal data. We disclose it only where needed:",
            },
            {
              kind: "list",
              items: [
                "Website host: {hostingProvider}, for the server logs described above.",
                "E-mail provider: [E-mail provider name and address], which stores our e-mail correspondence on our behalf.",
                "Accountants, tax advisers, auditors and lawyers, who are bound to professional secrecy, and public authorities where the law requires it.",
              ],
            },
            {
              kind: "p",
              text: "For patient data in MeDoc we use no sub-processors by default. If we ever need one, we will inform the practice in advance and give it the opportunity to object, as required by Article 28(2).",
            },
          ],
        },
        {
          id: "transfers",
          title: "Transfers outside the European Economic Area",
          blocks: [
            {
              kind: "p",
              text: "By default we do not transfer personal data to countries outside the European Economic Area. If a transfer becomes necessary, we will make it only on the basis of an adequacy decision of the European Commission (Article 45) or the Standard Contractual Clauses adopted by the Commission (Article 46(2)(c)), and we will update this policy.",
            },
            {
              kind: "p",
              text: "If you use WhatsApp, Meta may process your data outside the EEA under its own terms.",
            },
          ],
        },
        {
          id: "retention",
          title: "How long we keep data",
          blocks: [
            {
              kind: "list",
              items: [
                "Server logs: deleted automatically after a short period, unless needed to investigate a specific security incident.",
                "Enquiries that do not lead to a contract: deleted when the request is closed, at the latest 12 months after our last contact.",
                "Contracts, licence and support records: for the term of the contract and then until the end of the applicable limitation period for claims.",
                "Invoices and accounting records: for the period required by the tax and commercial law of {country}.",
                "Support backups and data seen in support sessions: not kept beyond the support task.",
              ],
            },
          ],
        },
        {
          id: "rights",
          title: "Your rights",
          blocks: [
            {
              kind: "p",
              text: "Under the GDPR you have the following rights regarding your personal data:",
            },
            {
              kind: "list",
              items: [
                "Access to your data (Article 15).",
                "Rectification of inaccurate data (Article 16).",
                "Erasure (Article 17).",
                "Restriction of processing (Article 18).",
                "Data portability (Article 20).",
                "Objection to processing based on Article 6(1)(f), on grounds relating to your particular situation (Article 21).",
                "Withdrawal of consent at any time, with effect for the future, where processing is based on consent (Article 7(3)).",
              ],
            },
            {
              kind: "p",
              text: "To exercise these rights, write to {dpoContact} or to our postal address. We may ask you to confirm your identity. We answer within one month (Article 12(3)).",
            },
            {
              kind: "p",
              text: "Patients of a dental practice who use MeDoc should address their requests to the practice, which is the controller. If such a request reaches us, we forward it to the practice and support the practice in answering it.",
            },
          ],
        },
        {
          id: "complaint",
          title: "Right to lodge a complaint",
          blocks: [
            {
              kind: "p",
              text: "You have the right to lodge a complaint with a data protection supervisory authority, in particular in the EU member state where you live, work or where the alleged infringement took place (Article 77). We would appreciate the chance to resolve your concern first.",
            },
          ],
        },
        {
          id: "obligation",
          title: "Whether you must provide data",
          blocks: [
            {
              kind: "p",
              text: "You are not required to provide personal data to visit this website. To receive an answer or conclude a contract, we need your contact details and the information required for the contract and for invoicing. Without them we cannot answer or contract with you.",
            },
          ],
        },
        {
          id: "automated",
          title: "No automated decision-making",
          blocks: [
            {
              kind: "p",
              text: "We do not make decisions based solely on automated processing, including profiling, that produce legal effects concerning you or similarly significantly affect you (Article 22).",
            },
          ],
        },
        {
          id: "changes",
          title: "Changes to this policy",
          blocks: [
            {
              kind: "p",
              text: "We update this policy when our processing or the law changes. The current version is always available on this website, with the date of the last update at the top.",
            },
          ],
        },
      ],
    },

    terms: {
      title: "General terms of sale and licence",
      summary:
        "The terms under which {company} licenses the MeDoc software and provides installation and service plans to dental practices and other healthcare professionals.",
      updated: UPDATED,
      sections: [
        {
          id: "scope",
          title: "Scope and parties",
          blocks: [
            {
              kind: "p",
              text: "These terms apply to all contracts between {company}, {address}, {country} (\"we\") and the customer (\"you\") for the licence of the MeDoc software, its installation, data import and service plans.",
            },
            {
              kind: "p",
              text: "We contract only with businesses: licensed dental practices and other healthcare professionals acting in their professional capacity. Consumers cannot conclude contracts with us. Your own general terms do not apply, even if we do not object to them, unless we accept them in writing.",
            },
          ],
        },
        {
          id: "formation",
          title: "Offer and conclusion of the contract",
          blocks: [
            {
              kind: "p",
              text: "Information on our website is not a binding offer. We send you a written offer stating the licence tier, the number of workstations, the scope of installation and data import, and the price. The contract is concluded when you sign the offer or order and we confirm it in writing.",
            },
            {
              kind: "p",
              text: "The signed offer or order confirmation takes precedence over these terms where they differ.",
            },
          ],
        },
        {
          id: "licence",
          title: "Licence grant",
          blocks: [
            {
              kind: "p",
              text: "On full payment of the licence fee we grant you a perpetual, non-exclusive, non-transferable right to use MeDoc for the internal purposes of the practice named in the order, on the number of workstations stated there. Until full payment, the right of use is provisional and may be revoked if you are in default of payment.",
            },
            {
              kind: "list",
              items: [
                "Essentiel: 2,500 € excl. VAT, includes 3 months of service.",
                "Cabinet: 2,900 € excl. VAT, includes 6 months of service.",
                "Clinique: 3,500 € excl. VAT, includes 12 months of service.",
              ],
            },
            {
              kind: "p",
              text: "You may not sublicense, rent out, sell or otherwise make MeDoc available to third parties, use it for other practices, or decompile or modify it except where mandatory law allows (Articles 5 and 6 of Directive 2009/24/EC). Additional workstations or practices require an additional licence.",
            },
            {
              kind: "p",
              text: "The licence keeps working without a service plan. Security fixes remain free of charge for 12 months after purchase.",
            },
          ],
        },
        {
          id: "installation",
          title: "Delivery, installation and data import",
          blocks: [
            {
              kind: "p",
              text: "We install MeDoc on your computers and import existing data to the extent included in your licence tier and described in the offer. We agree the installation date with you.",
            },
            {
              kind: "p",
              text: "You make the computers, network and access available on that date, and provide the data to be imported in a readable format. The minimum hardware and system requirements are stated in the offer. Delays caused by missing access, hardware or data are not our responsibility and may be charged as additional work at the rates stated in the offer.",
            },
          ],
        },
        {
          id: "plans",
          title: "Service plans",
          blocks: [
            {
              kind: "p",
              text: "After the service period included in your licence tier, you may subscribe to a monthly service plan:",
            },
            {
              kind: "list",
              items: [
                "Sécurité, 10 € per month excl. VAT: security and legal updates, access to the help centre.",
                "Confort, 25 € per month excl. VAT: everything in Sécurité, plus feature updates, phone and WhatsApp support during office hours, and a monthly backup check.",
                "Premium, 50 € per month excl. VAT: everything in Confort, plus priority support with a response within 4 office hours, and a yearly visit with training.",
              ],
            },
            {
              kind: "p",
              text: "A plan starts on the date agreed, at the earliest the day after the included service period ends. It runs for one calendar month and renews automatically by one month at a time. Either party may cancel it in writing (e-mail is sufficient) with one month's notice to the end of a calendar month. You can change to another plan with effect from the next calendar month.",
            },
            {
              kind: "p",
              text: "We may change plan prices with at least two months' written notice. If you do not accept the change, you may cancel the plan with effect from the date the new price applies.",
            },
          ],
        },
        {
          id: "payment",
          title: "Prices and payment",
          blocks: [
            {
              kind: "p",
              text: "All prices are in euro and exclude VAT, which is added at the applicable rate. Where the reverse-charge mechanism applies, the invoice states this.",
            },
            {
              kind: "list",
              items: [
                "40 % of the licence fee on signature of the contract.",
                "30 % on completion of the installation.",
                "30 % 30 days after installation.",
              ],
            },
            {
              kind: "p",
              text: "Service plans are invoiced monthly in advance. Invoices are due within 14 days of receipt unless the invoice states otherwise.",
            },
            {
              kind: "p",
              text: "If you pay late, we may charge interest at the statutory rate for commercial transactions, at least the reference rate of the European Central Bank plus eight percentage points, and a fixed compensation of 40 € for recovery costs, in accordance with Articles 3 and 6 of Directive 2011/7/EU as implemented in {country}. We may suspend support and service plans while a due amount remains unpaid after a written reminder.",
            },
          ],
        },
        {
          id: "duties",
          title: "Your obligations",
          blocks: [
            {
              kind: "list",
              items: [
                "Provide and maintain suitable hardware, operating systems and a local network, and keep them secure and up to date.",
                "Make regular backups of your data, store them securely and test that they can be restored. MeDoc stores data on your computers; we do not keep a copy.",
                "Create individual user accounts for your staff, protect passwords and remove access for people who leave.",
                "As controller, process patient data lawfully, in particular under the GDPR and the professional secrecy rules that apply to you.",
                "Report defects promptly and in a way that allows us to reproduce them.",
              ],
            },
          ],
        },
        {
          id: "data-protection",
          title: "Data protection",
          blocks: [
            {
              kind: "p",
              text: "MeDoc stores patient data only on your computers. We do not access it in normal operation. If you share your screen in a support session or hand us a backup, we act as your processor under Article 28 GDPR. We will sign a data processing agreement with you on request, and before any such access.",
            },
            {
              kind: "p",
              text: "How we process the personal data of your contact persons is described in our privacy policy.",
            },
          ],
        },
        {
          id: "medical",
          title: "Not a medical device; clinical decisions",
          blocks: [
            {
              kind: "p",
              text: "MeDoc is administration and documentation software for licensed dental staff. It is not intended for diagnosis, prevention, monitoring, treatment or prediction of disease and is not a medical device within the meaning of Regulation (EU) 2017/745.",
            },
            {
              kind: "p",
              text: "All clinical decisions, diagnoses, prescriptions and certificates remain the responsibility of the treating dentist. You must check documents produced with MeDoc before you sign or issue them.",
            },
          ],
        },
        {
          id: "warranty",
          title: "Warranty and defects",
          blocks: [
            {
              kind: "p",
              text: "MeDoc has the features described in the documentation applicable at the time of the contract. A defect exists where the software does not have these features in a way that more than insignificantly affects its use.",
            },
            {
              kind: "p",
              text: "Please report defects in writing with a description. We remedy them, at our choice, by a fix, an update or a reasonable workaround. If we fail to remedy a defect within a reasonable period after at least two attempts, you may reduce the price or, for a significant defect, terminate the affected contract.",
            },
            {
              kind: "p",
              text: "Warranty claims become time-barred 12 months after installation, except in cases of intent, gross negligence or fraudulently concealed defects. Defects caused by changes you make, unsuitable hardware or systems, or use contrary to the documentation are not covered.",
            },
          ],
        },
        {
          id: "liability",
          title: "Liability",
          blocks: [
            {
              kind: "p",
              text: "We are liable without limitation for damage caused intentionally or by gross negligence, for injury to life, body or health, under a guarantee we have given, and where mandatory law, in particular product liability law, provides for liability.",
            },
            {
              kind: "p",
              text: "For slight negligence we are liable only for breach of an essential contractual obligation, that is, an obligation whose fulfilment makes proper performance of the contract possible and on which you may regularly rely. In that case our liability is limited to damage typical for this type of contract and foreseeable when the contract was concluded.",
            },
            {
              kind: "p",
              text: "Except in the cases of unlimited liability above, our total liability per calendar year is limited to the fees you paid us in the 12 months before the event giving rise to the claim. For loss of data we are liable only for the cost of restoring it from backups you have made as required by these terms.",
            },
          ],
        },
        {
          id: "ip",
          title: "Intellectual property",
          blocks: [
            {
              kind: "p",
              text: "MeDoc, its documentation and all updates remain the property of {company}. You receive only the rights of use described in these terms. You may not remove copyright notices or licence controls.",
            },
            {
              kind: "p",
              text: "The data you enter into MeDoc remains yours. You can export it at any time.",
            },
          ],
        },
        {
          id: "confidentiality",
          title: "Confidentiality",
          blocks: [
            {
              kind: "p",
              text: "Both parties keep confidential all non-public information they receive from the other party in connection with the contract, in particular patient data, business information and licence keys. This obligation continues for five years after the contract ends, and without time limit for patient data.",
            },
          ],
        },
        {
          id: "termination",
          title: "Term and termination",
          blocks: [
            {
              kind: "p",
              text: "The licence is perpetual. Service plans run and end as described above. Either party may terminate the contract for good cause without notice, in particular if the other party seriously breaches it and does not remedy the breach within a reasonable period after a written warning.",
            },
            {
              kind: "p",
              text: "If we terminate the licence for good cause, in particular for unauthorised use or for non-payment of the licence fee, you must stop using MeDoc. You keep the right to export your data.",
            },
          ],
        },
        {
          id: "final",
          title: "Governing law, venue and severability",
          blocks: [
            {
              kind: "p",
              text: "These terms and all contracts under them are governed by the law of {country}, excluding the UN Convention on Contracts for the International Sale of Goods (CISG).",
            },
            {
              kind: "p",
              text: "The exclusive place of jurisdiction for all disputes arising from or in connection with the contract is {court}, to the extent permitted by law. We may also bring proceedings at your registered office.",
            },
            {
              kind: "p",
              text: "If any provision of these terms is or becomes invalid, the remaining provisions remain valid. The invalid provision is replaced by the valid provision that comes closest to its economic purpose. Changes and additions to the contract must be in writing; e-mail is sufficient.",
            },
          ],
        },
      ],
    },
  },
};
