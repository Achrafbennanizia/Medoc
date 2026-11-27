import type { LegalSet } from "./types";
import { EN_PRIVACY_POLICY } from "./en-privacy-policy";
import { EN_TERMS } from "./en-terms";
import { UPDATED } from "./updated";


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

    "privacy-policy": EN_PRIVACY_POLICY,

    terms: EN_TERMS,
  },
};
