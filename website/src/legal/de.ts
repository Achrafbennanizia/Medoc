import type { LegalSet } from "./types";

const UPDATED = "2026-11-22";

export const LEGAL_DE: LegalSet = {
  jurisdictionLabel: "Verfasst nach deutschem Recht",
  reviewNote:
    "Entwurf: Diese Texte müssen vor der Veröffentlichung von einer Rechtsanwältin oder einem Rechtsanwalt geprüft werden.",
  docs: {
    /* ───────────────────────────── Impressum ───────────────────────────── */
    "legal-notice": {
      title: "Impressum",
      summary:
        "Anbieterkennzeichnung nach § 5 Digitale-Dienste-Gesetz (DDG) und § 18 Abs. 2 Medienstaatsvertrag (MStV).",
      updated: UPDATED,
      sections: [
        {
          id: "anbieter",
          title: "Anbieter",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Unternehmen", "{company}"],
                ["Rechtsform", "{legalForm}"],
                ["Anschrift", "{address}, {country}"],
                ["Vertreten durch", "{director}"],
              ],
            },
          ],
        },
        {
          id: "kontakt",
          title: "Kontakt",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["E-Mail", "{email}"],
                ["Telefon", "{phone}"],
              ],
            },
          ],
        },
        {
          id: "register",
          title: "Registereintrag und Umsatzsteuer",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Registergericht", "{registry}"],
                ["Registernummer", "{registryNumber}"],
                ["Umsatzsteuer-Identifikationsnummer nach § 27a UStG", "{vatId}"],
              ],
            },
          ],
        },
        {
          id: "verantwortlich",
          title: "Inhaltlich verantwortlich",
          blocks: [
            {
              kind: "p",
              text: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: {director}, {address}.",
            },
          ],
        },
        {
          id: "streitbeilegung",
          title: "Verbraucherstreitbeilegung",
          blocks: [
            {
              kind: "p",
              text: "Unser Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, insbesondere an Zahnarztpraxen. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Verbraucherstreitbeilegungsgesetz, VSBG).",
            },
          ],
        },
        {
          id: "haftung-inhalte",
          title: "Haftung für Inhalte",
          blocks: [
            {
              kind: "p",
              text: "Wir erstellen die Inhalte dieser Website mit Sorgfalt. Für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir dennoch keine Gewähr. Als Diensteanbieter sind wir nach den allgemeinen Gesetzen für eigene Inhalte verantwortlich. Wir sind nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen. Sobald wir von einer konkreten Rechtsverletzung erfahren, entfernen wir die betroffenen Inhalte umgehend.",
            },
          ],
        },
        {
          id: "haftung-links",
          title: "Haftung für Links",
          blocks: [
            {
              kind: "p",
              text: "Diese Website enthält Links zu Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese Inhalte ist stets der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Eine ständige Kontrolle verlinkter Seiten ist ohne konkrete Anhaltspunkte nicht zumutbar. Wenn wir von Rechtsverletzungen erfahren, entfernen wir den Link umgehend.",
            },
          ],
        },
        {
          id: "urheberrecht",
          title: "Urheberrecht",
          blocks: [
            {
              kind: "p",
              text: "Texte, Bilder, Grafiken und die Software MeDoc sind urheberrechtlich geschützt. Vervielfältigung, Bearbeitung, Verbreitung und jede Verwertung außerhalb der Grenzen des Urheberrechtsgesetzes bedürfen unserer vorherigen schriftlichen Zustimmung. Soweit Inhalte von Dritten stammen, beachten wir deren Urheberrechte und kennzeichnen sie entsprechend.",
            },
          ],
        },
      ],
    },

    /* ─────────────────────── Datenschutzhinweis (kurz) ─────────────────────── */
    "privacy-notice": {
      title: "Datenschutz auf einen Blick",
      summary:
        "Kurzfassung: welche Daten wir verarbeiten, wenn Sie diese Website besuchen oder MeDoc nutzen. Die vollständige Datenschutzerklärung gilt ergänzend.",
      updated: UPDATED,
      sections: [
        {
          id: "wer",
          title: "Wer verantwortlich ist",
          blocks: [
            {
              kind: "p",
              text: "Verantwortlich für die Datenverarbeitung auf dieser Website und für Ihre Kunden- und Vertragsdaten ist {company}, {address}. Sie erreichen uns unter {email}.",
            },
          ],
        },
        {
          id: "website",
          title: "Website: nur notwendige Cookies, kein Tracking",
          blocks: [
            {
              kind: "p",
              text: "Diese Website verwendet kein Tracking und keine Analysewerkzeuge. Schriften werden von unserem eigenen Server geladen. Ihre Sprache, die Hell-/Dunkel-Einstellung und Ihr Land werden nur dann in notwendigen Cookies gespeichert, wenn Sie sie auswählen. Unser Hoster {hostingProvider} protokolliert beim Aufruf kurzzeitig technische Daten wie IP-Adresse, Uhrzeit und aufgerufene Seite, um die Website sicher auszuliefern.",
            },
          ],
        },
        {
          id: "kontakt",
          title: "Demo-Anfrage und Kontakt",
          blocks: [
            {
              kind: "p",
              text: "Das Demo-Formular überträgt Ihre Eingaben (Name, Praxis, Ort, Telefon, E-Mail, Nachricht) verschlüsselt an unseren Server unter sifralabs.com, betrieben bei Cloudflare, der sie per E-Mail an {email} weiterleitet; unser Postfach liegt bei Zoho. Die Website speichert keine Kopie. Ist unser Server nicht erreichbar, öffnet sich stattdessen Ihr E-Mail-Programm mit einer vorbereiteten Nachricht. Wenn Sie den WhatsApp-Link nutzen, gelten zusätzlich die Datenschutzbestimmungen von WhatsApp (Meta); dabei können Daten in Drittländer übermittelt werden.",
            },
          ],
        },
        {
          id: "software",
          title: "Software MeDoc: Patientendaten bleiben in der Praxis",
          blocks: [
            {
              kind: "p",
              text: "MeDoc läuft auf den Rechnern Ihrer Praxis. Patientendaten werden dort verschlüsselt gespeichert (SQLCipher, AES-256) und nur zwischen den Geräten Ihrer Praxis im lokalen Netz abgeglichen. Wir hosten keine Patientendaten. Die Praxis ist für diese Daten Verantwortliche. Die Update-Prüfung übermittelt nur die App-Version an unseren Update-Server, keine Patientendaten.",
            },
          ],
        },
        {
          id: "support",
          title: "Support: nur auf Ihre Veranlassung",
          blocks: [
            {
              kind: "p",
              text: "Patientendaten sehen wir nur, wenn Sie uns in einer Support-Sitzung Ihren Bildschirm zeigen oder uns eine Sicherung zur Fehleranalyse übergeben. Dann handeln wir als Auftragsverarbeiter nach Art. 28 DSGVO auf Grundlage eines Auftragsverarbeitungsvertrags. Unsere Mitarbeitenden sind nach § 203 Abs. 4 StGB zur Verschwiegenheit verpflichtet.",
            },
          ],
        },
        {
          id: "rechte",
          title: "Ihre Rechte",
          blocks: [
            {
              kind: "p",
              text: "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO) sowie das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO). Schreiben Sie uns dazu an {email}. Einzelheiten finden Sie in der Datenschutzerklärung.",
            },
          ],
        },
      ],
    },

    /* ─────────────────── Datenschutzerklärung (vollständig) ─────────────────── */
    "privacy-policy": {
      title: "Datenschutzerklärung",
      summary:
        "Informationen nach Art. 13 und 14 DSGVO zur Verarbeitung personenbezogener Daten auf dieser Website, bei Vertrag und Support sowie beim Einsatz der Software MeDoc.",
      updated: UPDATED,
      sections: [
        {
          id: "verantwortlicher",
          title: "Verantwortlicher und Datenschutzkontakt",
          blocks: [
            {
              kind: "facts",
              rows: [
                ["Verantwortlicher", "{company}, {legalForm}"],
                ["Anschrift", "{address}, {country}"],
                ["Vertreten durch", "{director}"],
                ["E-Mail", "{email}"],
                ["Telefon", "{phone}"],
                ["Datenschutzkontakt", "{dpoContact}"],
              ],
            },
            {
              kind: "p",
              text: "Soweit wir nach Art. 37 DSGVO in Verbindung mit § 38 BDSG einen Datenschutzbeauftragten benannt haben, erreichen Sie ihn unter dem oben genannten Datenschutzkontakt.",
            },
          ],
        },
        {
          id: "website",
          title: "Besuch dieser Website",
          blocks: [
            {
              kind: "p",
              text: "Diese Website ist statisch aufgebaut. Sie verwendet weder Tracking- noch Analysewerkzeuge. Schriften werden lokal von unserem Server ausgeliefert; dabei entstehen keine Anfragen an Dritte.",
            },
            {
              kind: "p",
              text: "Hosting: Die Website wird bei {hostingProvider} gehostet. Beim Aufruf verarbeitet der Hoster in Server-Logfiles die IP-Adresse, Datum und Uhrzeit, die aufgerufene Seite sowie technisch übermittelte Angaben des Browsers. Das dient der sicheren und stabilen Auslieferung und der Abwehr von Angriffen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt im sicheren Betrieb der Website. Die Logfiles werden nur kurzzeitig gespeichert und danach gelöscht. Mit dem Hoster besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.",
            },
            {
              kind: "p",
              text: "Cookies: Wir setzen ausschließlich eigene, technisch notwendige Cookies, und nur, wenn Sie eine Auswahl treffen – nie voreingestellt. Sie werden an niemanden weitergegeben. Die Speicherung ist unbedingt erforderlich, um die von Ihnen gewünschte Darstellung bereitzustellen, und ohne Einwilligung zulässig (§ 25 Abs. 2 Nr. 2 TDDDG). Das Land wird zunächst aus Zeitzone und Sprache Ihres Browsers geschätzt, nur auf Ihrem Gerät; diese Schätzung wird nicht gespeichert. Sie können die Cookies jederzeit in Ihrem Browser löschen.",
            },
            {
              kind: "facts",
              rows: [
                ["medoc_lang", "Gewählte Sprache. 12 Monate."],
                ["medoc_theme", "Gewähltes helles oder dunkles Design. 12 Monate."],
                ["medoc_country", "Gewähltes Land (passt gezeigte Dokumente und Preise an). 12 Monate."],
                ["medoc_cookie_notice", "Merkt, dass Sie den Cookie-Hinweis geschlossen haben. 12 Monate."],
              ],
            },
          ],
        },
        {
          id: "kontakt",
          title: "Demo-Anfrage, E-Mail und WhatsApp",
          blocks: [
            {
              kind: "p",
              text: "Das Demo-Formular überträgt Ihre Eingaben verschlüsselt an unseren Server unter sifralabs.com (Cloudflare), der sie per E-Mail an {email} weiterleitet (Postfach bei Zoho). Der Server speichert keine Kopie. Ist er nicht erreichbar, öffnet sich stattdessen Ihr E-Mail-Programm mit einer vorbereiteten Nachricht. Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben (etwa Name, Praxis, Kontaktdaten, Inhalt der Anfrage), um die Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit die Anfrage auf einen Vertrag zielt, im Übrigen Art. 6 Abs. 1 lit. f DSGVO.",
            },
            {
              kind: "p",
              text: "Optional bieten wir einen Link zu WhatsApp an. WhatsApp wird in der EU von Meta Platforms Ireland Limited betrieben, das eigene Datenschutzbestimmungen hat. Wenn Sie den Link nutzen, verarbeitet Meta Ihre Daten in eigener Verantwortung; eine Übermittlung in Drittländer, insbesondere in die USA, ist dabei möglich. Ohne Klick auf den Link werden keine Daten an Meta übertragen. Wenn Sie das nicht möchten, schreiben Sie uns bitte per E-Mail oder rufen Sie an.",
            },
          ],
        },
        {
          id: "kunden",
          title: "Kunden- und Vertragsdaten",
          blocks: [
            {
              kind: "p",
              text: "Für Angebot, Vertrag, Installation, Abrechnung und Support verarbeiten wir die Daten unserer Kunden und ihrer Ansprechpersonen:",
            },
            {
              kind: "list",
              items: [
                "Stammdaten: Name der Praxis, Ansprechpersonen, Anschrift, E-Mail, Telefon",
                "Vertragsdaten: gewählte Lizenzstufe, Arbeitsplatzzahl, Servicepaket, Installationstermine",
                "Abrechnungsdaten: Rechnungen, Zahlungseingänge, Umsatzsteuer-Identifikationsnummer",
                "Kommunikation: Support-Anfragen und Korrespondenz",
              ],
            },
            {
              kind: "p",
              text: "Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung und -erfüllung), Art. 6 Abs. 1 lit. c DSGVO (handels- und steuerrechtliche Pflichten) und Art. 6 Abs. 1 lit. f DSGVO (Durchsetzung und Abwehr von Ansprüchen, Kommunikation mit Ansprechpersonen unserer Kunden).",
            },
          ],
        },
        {
          id: "software",
          title: "Software MeDoc: Rollen und Datenflüsse",
          blocks: [
            {
              kind: "p",
              text: "MeDoc ist eine Verwaltungs- und Dokumentationssoftware für Zahnarztpraxen (Akte, Zahnschema, Termine, Rezepte, Bescheinigungen, Rechnungen nach GOZ, Kasse, Arbeitszeit). Sie läuft auf den eigenen Rechnern der Praxis. Patientendaten werden dort verschlüsselt (SQLCipher, AES-256) gespeichert und nur zwischen Geräten der Praxis im lokalen Netz abgeglichen. Wir hosten keine Patientendaten und haben im Normalbetrieb keinen Zugriff darauf.",
            },
            {
              kind: "p",
              text: "Für die Verarbeitung der Patienten- und Mitarbeiterdaten in MeDoc ist die Praxis Verantwortliche im Sinne des Art. 4 Nr. 7 DSGVO. Sie informiert ihre Patientinnen und Patienten selbst nach Art. 13 DSGVO.",
            },
            {
              kind: "p",
              text: "Update-Prüfung: MeDoc fragt bei unserem Update-Server an, ob eine neue Version verfügbar ist. Dabei werden die installierte App-Version und technisch bedingt die IP-Adresse der Praxis übermittelt, keine Patientendaten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung von Sicherheits- und Funktionsupdates) und Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb der Software).",
            },
          ],
        },
        {
          id: "support",
          title: "Support und Auftragsverarbeitung",
          blocks: [
            {
              kind: "p",
              text: "Patientendaten sehen wir nur in zwei Fällen, und nur auf Veranlassung der Praxis:",
            },
            {
              kind: "list",
              items: [
                "Die Praxis teilt in einer Support-Sitzung ihren Bildschirm mit uns.",
                "Die Praxis übergibt uns eine Sicherung zur Fehleranalyse.",
              ],
            },
            {
              kind: "p",
              text: "In diesen Fällen handeln wir als Auftragsverarbeiter nach Art. 28 DSGVO, ausschließlich nach Weisung der Praxis und auf Grundlage eines Auftragsverarbeitungsvertrags. Übergebene Sicherungen nutzen wir nur zur Fehleranalyse und löschen sie, sobald die Analyse abgeschlossen ist.",
            },
            {
              kind: "p",
              text: "Patientendaten unterliegen dem Berufsgeheimnis nach § 203 StGB. Unsere Mitarbeitenden, die an Support oder Fehleranalyse mitwirken, verpflichten wir schriftlich zur Verschwiegenheit und belehren sie über die strafrechtlichen Folgen einer Verletzung (§ 203 Abs. 4 StGB).",
            },
          ],
        },
        {
          id: "sicherheit",
          title: "Technische und organisatorische Maßnahmen",
          blocks: [
            {
              kind: "p",
              text: "Nach Art. 32 DSGVO treffen wir angemessene Maßnahmen zum Schutz personenbezogener Daten. Dazu gehören insbesondere:",
            },
            {
              kind: "list",
              items: [
                "Verschlüsselte Speicherung der Praxisdatenbank auf den Rechnern der Praxis (SQLCipher, AES-256)",
                "Abgleich zwischen Geräten nur im lokalen Netz der Praxis, keine Speicherung von Patientendaten bei uns",
                "Zugriff auf Patientendaten nur auf Veranlassung der Praxis und nur für die Dauer der Support-Sitzung oder Fehleranalyse",
                "Verpflichtung der Mitarbeitenden auf Vertraulichkeit und Verschwiegenheit",
                "Löschung übergebener Sicherungen nach Abschluss der Fehleranalyse",
                "Update-Prüfung ohne Übermittlung von Patientendaten",
              ],
            },
          ],
        },
        {
          id: "empfaenger",
          title: "Empfänger und Unterauftragsverarbeiter",
          blocks: [
            {
              kind: "p",
              text: "Wir geben personenbezogene Daten nur weiter, soweit es für die genannten Zwecke erforderlich ist oder eine gesetzliche Pflicht besteht. Empfänger können sein:",
            },
            {
              kind: "list",
              items: [
                "unser Website-Hoster {hostingProvider} (als Auftragsverarbeiter)",
                "Dienstleister für E-Mail, Fernwartung und Bildschirmfreigabe (als Auftragsverarbeiter)",
                "Steuerberatung und Kreditinstitute für Buchhaltung und Zahlungsverkehr",
                "Behörden und Gerichte, soweit eine gesetzliche Pflicht besteht",
              ],
            },
            {
              kind: "p",
              text: "Setzen wir bei Support-Leistungen für die Praxis weitere Auftragsverarbeiter ein, nennen wir diese im Auftragsverarbeitungsvertrag und holen die dort vereinbarte Genehmigung der Praxis ein (Art. 28 Abs. 2 und 4 DSGVO).",
            },
          ],
        },
        {
          id: "drittland",
          title: "Übermittlung in Drittländer",
          blocks: [
            {
              kind: "p",
              text: "Standardmäßig übermitteln wir keine personenbezogenen Daten in Länder außerhalb der Europäischen Union oder des Europäischen Wirtschaftsraums. Eine Ausnahme kann entstehen, wenn Sie selbst WhatsApp nutzen. Sollten wir künftig Dienstleister in Drittländern einsetzen, geschieht das nur unter den Voraussetzungen der Art. 44 ff. DSGVO, etwa auf Grundlage eines Angemessenheitsbeschlusses oder von Standardvertragsklauseln.",
            },
          ],
        },
        {
          id: "speicherdauer",
          title: "Speicherdauer",
          blocks: [
            {
              kind: "p",
              text: "Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist. Im Einzelnen:",
            },
            {
              kind: "list",
              items: [
                "Server-Logfiles: nur kurzzeitig, danach Löschung",
                "Anfragen ohne Vertragsschluss: Löschung, sobald die Anfrage erledigt ist und keine weitere Kommunikation zu erwarten ist",
                "Vertrags- und Kundendaten: für die Dauer der Geschäftsbeziehung und bis zum Ablauf der Verjährungsfristen für vertragliche Ansprüche",
                "Handels- und steuerrechtlich relevante Unterlagen: nach § 147 AO und § 257 HGB bis zu zehn Jahre (Bücher, Jahresabschlüsse), acht Jahre (Buchungsbelege wie Rechnungen) bzw. sechs Jahre (Handels- und Geschäftsbriefe)",
                "Zur Fehleranalyse übergebene Sicherungen: Löschung nach Abschluss der Analyse",
              ],
            },
          ],
        },
        {
          id: "rechte",
          title: "Ihre Rechte",
          blocks: [
            {
              kind: "p",
              text: "Sie haben nach der DSGVO folgende Rechte gegenüber uns:",
            },
            {
              kind: "list",
              items: [
                "Auskunft über Ihre bei uns gespeicherten Daten (Art. 15 DSGVO)",
                "Berichtigung unrichtiger Daten (Art. 16 DSGVO)",
                "Löschung (Art. 17 DSGVO), soweit keine gesetzliche Aufbewahrungspflicht entgegensteht",
                "Einschränkung der Verarbeitung (Art. 18 DSGVO)",
                "Datenübertragbarkeit (Art. 20 DSGVO)",
                "Widerspruch gegen die Verarbeitung (Art. 21 DSGVO, siehe unten)",
              ],
            },
            {
              kind: "p",
              text: "Für Patientendaten in MeDoc ist die jeweilige Praxis Verantwortliche. Patientinnen und Patienten wenden sich mit ihren Anliegen bitte an ihre Praxis; wir unterstützen die Praxis dabei als Auftragsverarbeiter, soweit wir beteiligt sind.",
            },
          ],
        },
        {
          id: "widerspruch",
          title: "Ihr Widerspruchsrecht nach Art. 21 DSGVO",
          blocks: [
            {
              kind: "p",
              text: "Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung Sie betreffender personenbezogener Daten Widerspruch einzulegen, die auf Art. 6 Abs. 1 lit. f DSGVO beruht. Wir verarbeiten diese Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.",
            },
            {
              kind: "p",
              text: "Verarbeiten wir Ihre Daten für Direktwerbung, können Sie dem jederzeit ohne Angabe von Gründen widersprechen. Den Widerspruch richten Sie formlos an {email}.",
            },
          ],
        },
        {
          id: "beschwerde",
          title: "Beschwerde bei einer Aufsichtsbehörde",
          blocks: [
            {
              kind: "p",
              text: "Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Für uns zuständig ist die Landesdatenschutzbehörde des Bundeslandes, in dem wir unseren Sitz haben.",
            },
          ],
        },
        {
          id: "pflicht-entscheidung",
          title: "Bereitstellung der Daten und automatisierte Entscheidungen",
          blocks: [
            {
              kind: "p",
              text: "Für den Besuch der Website müssen Sie keine personenbezogenen Daten angeben. Für einen Vertragsschluss benötigen wir die Stamm-, Vertrags- und Abrechnungsdaten; ohne sie können wir keinen Vertrag schließen. Eine automatisierte Entscheidungsfindung einschließlich Profiling nach Art. 22 DSGVO findet nicht statt.",
            },
          ],
        },
        {
          id: "aenderungen",
          title: "Änderungen dieser Datenschutzerklärung",
          blocks: [
            {
              kind: "p",
              text: "Wir passen diese Datenschutzerklärung an, wenn sich unsere Verarbeitung oder die Rechtslage ändert. Es gilt jeweils die auf dieser Website veröffentlichte Fassung mit dem oben angegebenen Stand.",
            },
          ],
        },
      ],
    },

    /* ─────────────────────────────── AGB ─────────────────────────────── */
    terms: {
      title: "Allgemeine Geschäftsbedingungen",
      summary:
        "Bedingungen für den Erwerb von MeDoc-Lizenzen und die Servicepakete. Sie gelten ausschließlich gegenüber Unternehmern im Sinne des § 14 BGB.",
      updated: UPDATED,
      sections: [
        {
          id: "geltung",
          title: "1. Geltungsbereich",
          blocks: [
            {
              kind: "p",
              text: "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen {company} (nachfolgend „Anbieter“) und seinen Kunden über den Erwerb von Lizenzen für die Software MeDoc, deren Installation und die Servicepakete.",
            },
            {
              kind: "p",
              text: "Unser Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, insbesondere Zahnarztpraxen. Verträge mit Verbrauchern schließen wir nicht. Für die Einbeziehung dieser AGB gilt § 310 Abs. 1 BGB.",
            },
            {
              kind: "p",
              text: "Abweichende oder ergänzende Geschäftsbedingungen des Kunden werden nicht Vertragsbestandteil, auch wenn der Anbieter ihnen nicht ausdrücklich widerspricht. Individuelle Vereinbarungen im Angebot haben Vorrang vor diesen AGB (§ 305b BGB).",
            },
          ],
        },
        {
          id: "vertragsschluss",
          title: "2. Vertragsschluss",
          blocks: [
            {
              kind: "p",
              text: "Darstellungen auf der Website und Vorführungen sind kein verbindliches Angebot. Der Anbieter erstellt dem Kunden ein schriftliches Angebot mit Lizenzstufe, Arbeitsplatzzahl, Installationsumfang und gegebenenfalls Servicepaket. Der Vertrag kommt mit Unterzeichnung dieses Angebots durch beide Parteien zustande.",
            },
          ],
        },
        {
          id: "lizenz",
          title: "3. Lizenz und Nutzungsrechte",
          blocks: [
            {
              kind: "p",
              text: "Der Kunde erhält gegen einmalige Vergütung ein zeitlich unbefristetes, einfaches (nicht ausschließliches) und nicht übertragbares Recht, MeDoc für den Betrieb seiner Praxis zu nutzen. Das Recht gilt für eine Praxis und die im Angebot genannte Zahl von Arbeitsplätzen. Die Lizenz wird in drei Stufen angeboten:",
            },
            {
              kind: "list",
              items: [
                "Essentiel: 2.500 € netto, einschließlich 3 Monaten Service",
                "Cabinet: 2.900 € netto, einschließlich 6 Monaten Service",
                "Clinique: 3.500 € netto, einschließlich 12 Monaten Service",
              ],
            },
            {
              kind: "p",
              text: "Der Kunde darf die Software nicht vermieten, unterlizenzieren, an Dritte weitergeben oder außerhalb seiner Praxis einsetzen. Bearbeitung, Dekompilierung und Rückübersetzung sind nur in den Grenzen der §§ 69d und 69e UrhG zulässig. Urheberrechtsvermerke dürfen nicht entfernt werden.",
            },
            {
              kind: "p",
              text: "Alle Rechte an MeDoc, die nicht ausdrücklich eingeräumt werden, verbleiben beim Anbieter. Die Nutzungsrechte gehen erst mit vollständiger Zahlung der Lizenzvergütung endgültig auf den Kunden über; bis dahin ist die Nutzung vorläufig gestattet.",
            },
          ],
        },
        {
          id: "installation",
          title: "4. Lieferung und Installation",
          blocks: [
            {
              kind: "p",
              text: "Der Anbieter installiert MeDoc zu einem gemeinsam vereinbarten Termin auf den Rechnern der Praxis und richtet den Abgleich zwischen den Arbeitsplätzen im lokalen Netz ein. Die Installation gilt als abgeschlossen, wenn MeDoc auf den vereinbarten Arbeitsplätzen betriebsbereit ist. Verzögert sich die Installation aus Gründen, die der Kunde zu vertreten hat, gilt der ursprünglich vereinbarte Termin als Installationstermin im Sinne der Zahlungsregelung.",
            },
          ],
        },
        {
          id: "service",
          title: "5. Servicepakete",
          blocks: [
            {
              kind: "p",
              text: "Nach Ablauf der in der Lizenz enthaltenen Servicezeit kann der Kunde eines der folgenden monatlichen Servicepakete buchen:",
            },
            {
              kind: "list",
              items: [
                "Sécurité, 10 € netto pro Monat: Sicherheits- und Rechtsupdates, Zugang zum Hilfe-Center",
                "Confort, 25 € netto pro Monat: Leistungen von Sécurité, zusätzlich Funktionsupdates, Support per Telefon und WhatsApp zu Bürozeiten und eine monatliche Prüfung der Datensicherung",
                "Premium, 50 € netto pro Monat: Leistungen von Confort, zusätzlich vorrangiger Support mit Reaktion binnen 4 Stunden während der Bürozeiten sowie ein jährlicher Besuch mit Schulung",
              ],
            },
            {
              kind: "p",
              text: "Ein Servicepaket hat eine Laufzeit von einem Kalendermonat und verlängert sich jeweils um einen weiteren Monat, wenn es nicht mit einer Frist von einem Monat zum Ende eines Kalendermonats gekündigt wird. Die Kündigung bedarf der Textform (z. B. E-Mail an {email}).",
            },
            {
              kind: "p",
              text: "Ohne Servicepaket bleibt die Lizenz unbefristet nutzbar. Sicherheitskorrekturen stellt der Anbieter unabhängig von einem Servicepaket für 12 Monate ab Kauf kostenlos bereit. Funktionsupdates, Support und weitere Leistungen sind danach nur mit einem Servicepaket enthalten.",
            },
          ],
        },
        {
          id: "zahlung",
          title: "6. Preise und Zahlung",
          blocks: [
            {
              kind: "p",
              text: "Alle Preise sind Nettopreise zuzüglich der gesetzlichen Umsatzsteuer. Die Lizenzvergütung ist in drei Raten fällig:",
            },
            {
              kind: "list",
              items: [
                "40 % bei Unterzeichnung des Vertrags",
                "30 % bei Abschluss der Installation",
                "30 % 30 Tage nach Abschluss der Installation",
              ],
            },
            {
              kind: "p",
              text: "Rechnungen sind innerhalb von 14 Tagen nach Zugang ohne Abzug zahlbar. Servicepakete werden monatlich im Voraus abgerechnet.",
            },
            {
              kind: "p",
              text: "Gerät der Kunde in Verzug, schuldet er Verzugszinsen in Höhe von neun Prozentpunkten über dem Basiszinssatz (§ 288 Abs. 2 BGB) sowie eine Pauschale von 40 € (§ 288 Abs. 5 BGB). Die Geltendmachung eines weiteren Schadens bleibt vorbehalten. Ist der Kunde mit Zahlungen für ein Servicepaket mehr als 30 Tage in Verzug, kann der Anbieter die Leistungen des Servicepakets bis zum Ausgleich aussetzen; die Nutzung der Lizenz bleibt davon unberührt.",
            },
            {
              kind: "p",
              text: "Der Kunde kann nur mit unbestrittenen oder rechtskräftig festgestellten Forderungen aufrechnen.",
            },
          ],
        },
        {
          id: "pflichten",
          title: "7. Pflichten des Kunden",
          blocks: [
            {
              kind: "list",
              items: [
                "Hardware und Netz: Der Kunde stellt Rechner, Betriebssystem und lokales Netz bereit, die den vom Anbieter genannten Systemanforderungen entsprechen.",
                "Datensicherung: Der Kunde sichert seine Daten regelmäßig und dem Stand der Technik entsprechend, mindestens täglich, und bewahrt Sicherungen getrennt von den Arbeitsrechnern auf.",
                "Zugänge: Der Kunde hält Passwörter und Zugangsdaten geheim, vergibt Berechtigungen nur an befugtes Personal und gewährt dem Anbieter für Installation und Support den erforderlichen Zugang.",
                "Datenschutz: Der Kunde ist für die Verarbeitung von Patienten- und Mitarbeiterdaten in MeDoc Verantwortlicher im Sinne der DSGVO und erfüllt die damit verbundenen Pflichten, insbesondere die Information der Patientinnen und Patienten und die Wahrung der ärztlichen Schweigepflicht.",
                "Mitwirkung: Der Kunde meldet Störungen und Mängel unverzüglich in Textform mit einer nachvollziehbaren Beschreibung.",
              ],
            },
          ],
        },
        {
          id: "datenschutz",
          title: "8. Datenschutz und Auftragsverarbeitung",
          blocks: [
            {
              kind: "p",
              text: "Patientendaten werden ausschließlich auf den Rechnern der Praxis gespeichert. Der Anbieter erhält nur Zugang zu Patientendaten, wenn der Kunde in einer Support-Sitzung seinen Bildschirm teilt oder eine Sicherung zur Fehleranalyse übergibt. Vor einem solchen Zugriff schließen die Parteien einen Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.",
            },
            {
              kind: "p",
              text: "Der Anbieter verpflichtet alle mitwirkenden Personen zur Verschwiegenheit und belehrt sie über die strafrechtlichen Folgen einer Pflichtverletzung (§ 203 Abs. 4 StGB). Im Übrigen gilt die Datenschutzerklärung des Anbieters.",
            },
          ],
        },
        {
          id: "medizin",
          title: "9. Kein Medizinprodukt",
          blocks: [
            {
              kind: "p",
              text: "MeDoc ist eine Verwaltungs- und Dokumentationssoftware für zahnärztliches Personal und kein Medizinprodukt. Sie stellt keine Diagnosen und gibt keine Therapieempfehlungen. Hinweise der Software sind Hilfsmittel und ersetzen keine fachliche Prüfung. Alle klinischen Entscheidungen trifft und verantwortet die behandelnde Zahnärztin oder der behandelnde Zahnarzt.",
            },
          ],
        },
        {
          id: "maengel",
          title: "10. Mängelhaftung",
          blocks: [
            {
              kind: "p",
              text: "Der Anbieter gewährleistet, dass MeDoc bei Installation im Wesentlichen der Leistungsbeschreibung entspricht. Unerhebliche Abweichungen begründen keinen Mangel. Keine Mängel sind Störungen, die auf ungeeigneter Hardware, Eingriffen des Kunden oder Dritter in die Software, Bedienfehlern oder Schadsoftware beruhen.",
            },
            {
              kind: "p",
              text: "Bei Mängeln leistet der Anbieter nach seiner Wahl Nacherfüllung durch Beseitigung des Mangels, Bereitstellung eines Updates oder einer zumutbaren Umgehungslösung. Schlägt die Nacherfüllung fehl, kann der Kunde nach den gesetzlichen Vorschriften mindern oder vom Vertrag zurücktreten. Schadensersatz richtet sich nach Ziffer 11.",
            },
            {
              kind: "p",
              text: "Mängelansprüche verjähren in 12 Monaten ab Abschluss der Installation. Das gilt nicht bei Vorsatz, Arglist, Verletzung von Leben, Körper oder Gesundheit, Ansprüchen nach dem Produkthaftungsgesetz und Schadensersatzansprüchen wegen grober Fahrlässigkeit; insoweit gelten die gesetzlichen Fristen.",
            },
          ],
        },
        {
          id: "haftung",
          title: "11. Haftung",
          blocks: [
            {
              kind: "p",
              text: "Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz sowie im Umfang einer übernommenen Garantie.",
            },
            {
              kind: "p",
              text: "Bei einfacher Fahrlässigkeit haftet der Anbieter nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht). Das sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Kunde regelmäßig vertrauen darf. In diesem Fall ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.",
            },
            {
              kind: "p",
              text: "Für den Verlust von Daten haftet der Anbieter im Rahmen der vorstehenden Absätze nur in Höhe des Aufwands, der bei ordnungsgemäßer Datensicherung durch den Kunden (Ziffer 7) zur Wiederherstellung erforderlich gewesen wäre.",
            },
            {
              kind: "p",
              text: "Die vorstehenden Beschränkungen gelten auch für die persönliche Haftung der Mitarbeitenden, Vertreter und Erfüllungsgehilfen des Anbieters.",
            },
          ],
        },
        {
          id: "vertraulichkeit",
          title: "12. Vertraulichkeit",
          blocks: [
            {
              kind: "p",
              text: "Die Parteien behandeln alle vertraulichen Informationen, die sie im Rahmen der Zusammenarbeit erhalten, vertraulich und nutzen sie nur für die Durchführung des Vertrags. Dazu gehören insbesondere Patientendaten, Geschäftsinterna der Praxis sowie nicht öffentliche Informationen über die Software. Die Pflicht gilt über das Vertragsende hinaus. Gesetzliche Offenlegungspflichten bleiben unberührt.",
            },
          ],
        },
        {
          id: "laufzeit",
          title: "13. Laufzeit und Kündigung",
          blocks: [
            {
              kind: "p",
              text: "Die Lizenz ist unbefristet und kann nicht ordentlich gekündigt werden. Für Servicepakete gilt Ziffer 5. Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund (§ 314 BGB) bleibt unberührt. Ein wichtiger Grund liegt für den Anbieter insbesondere vor, wenn der Kunde die Software in erheblichem Umfang über die eingeräumten Nutzungsrechte hinaus nutzt und dies trotz Abmahnung nicht abstellt.",
            },
          ],
        },
        {
          id: "recht",
          title: "14. Anwendbares Recht und Gerichtsstand",
          blocks: [
            {
              kind: "p",
              text: "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG). Ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist {court}, soweit der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist oder keinen allgemeinen Gerichtsstand in Deutschland hat. Der Anbieter darf den Kunden auch an dessen allgemeinem Gerichtsstand verklagen.",
            },
          ],
        },
        {
          id: "schluss",
          title: "15. Schlussbestimmungen",
          blocks: [
            {
              kind: "p",
              text: "Änderungen und Ergänzungen des Vertrags bedürfen der Textform. Sollte eine Bestimmung dieser AGB ganz oder teilweise unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung (§ 306 Abs. 2 BGB).",
            },
          ],
        },
      ],
    },
  },
};
