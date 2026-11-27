import type { LegalDocument } from "./types";
import { UPDATED } from "./updated";

/** Privacy policy (en), part of LEGAL_EN in en.ts. */
export const EN_PRIVACY_POLICY: LegalDocument = {
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
};
