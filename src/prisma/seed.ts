import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding MeDoc Datenbank...\n");

    // Personal anlegen
    const arzt = await prisma.personal.upsert({
        where: { email: "ahmed@praxis.de" },
        update: {},
        create: {
            name: "Dr. Ahmed R.",
            email: "ahmed@praxis.de",
            passwort: await bcrypt.hash("passwort123", 12),
            rolle: "ARZT",
            fachrichtung: "Zahnmedizin",
            taetigkeitsbereich: "Allgemeine Zahnheilkunde",
            telefon: "+49 261 12345",
        },
    });
    console.log(`✓ Arzt: ${arzt.name} (${arzt.email})`);

    const rezeption = await prisma.personal.upsert({
        where: { email: "aya@praxis.de" },
        update: {},
        create: {
            name: "Aya M.",
            email: "aya@praxis.de",
            passwort: await bcrypt.hash("passwort123", 12),
            rolle: "REZEPTION",
            taetigkeitsbereich: "Rezeption",
            telefon: "+49 261 12346",
        },
    });
    console.log(`✓ Rezeption: ${rezeption.name} (${rezeption.email})`);

    const arzt2 = await prisma.personal.upsert({
        where: { email: "naima@praxis.de" },
        update: {},
        create: {
            name: "Dr. Naima K.",
            email: "naima@praxis.de",
            passwort: await bcrypt.hash("passwort123", 12),
            rolle: "ARZT",
            fachrichtung: "Kieferorthopädie",
            taetigkeitsbereich: "Kieferorthopädie",
            telefon: "+49 261 12347",
        },
    });
    console.log(`✓ Arzt: ${arzt2.name} (${arzt2.email})`);

    // Patienten
    const patienten = [
        {
            name: "Max Mustermann",
            geburtsdatum: new Date("1985-03-15"),
            geschlecht: "MAENNLICH" as const,
            versicherungsnummer: "A123456789",
            telefon: "+49 170 1234567",
            email: "max@example.de",
        },
        {
            name: "Erika Muster",
            geburtsdatum: new Date("1990-07-22"),
            geschlecht: "WEIBLICH" as const,
            versicherungsnummer: "B987654321",
            telefon: "+49 170 9876543",
        },
        {
            name: "Hans Schmidt",
            geburtsdatum: new Date("1978-11-30"),
            geschlecht: "MAENNLICH" as const,
            versicherungsnummer: "C456789123",
            telefon: "+49 171 4567891",
        },
        {
            name: "Anna Bauer",
            geburtsdatum: new Date("1995-01-10"),
            geschlecht: "WEIBLICH" as const,
            versicherungsnummer: "D321654987",
            email: "anna.bauer@example.de",
        },
        {
            name: "Ali Yilmaz",
            geburtsdatum: new Date("1982-06-05"),
            geschlecht: "MAENNLICH" as const,
            versicherungsnummer: "E789123456",
            telefon: "+49 172 7891234",
        },
    ];

    const createdPatienten = [];
    for (const p of patienten) {
        const patient = await prisma.patient.create({
            data: {
                ...p,
                status: "AKTIV",
                akte: { create: {} },
            },
        });
        createdPatienten.push(patient);
        console.log(`✓ Patient: ${patient.name}`);
    }

    // Leistungen
    const leistungen = [
        { name: "Professionelle Zahnreinigung", kategorie: "Prophylaxe", preis: 80 },
        { name: "Kontrolluntersuchung", kategorie: "Diagnostik", preis: 35 },
        { name: "Röntgenaufnahme", kategorie: "Diagnostik", preis: 25 },
        { name: "Kompositfüllung", kategorie: "Konservierende", preis: 120 },
        { name: "Wurzelbehandlung", kategorie: "Endodontie", preis: 350 },
        { name: "Zahnextraktion", kategorie: "Chirurgie", preis: 85 },
        { name: "Keramikkrone", kategorie: "Prothetik", preis: 750 },
        { name: "Bleaching", kategorie: "Ästhetik", preis: 300 },
    ];

    const createdLeistungen = [];
    for (const l of leistungen) {
        const leistung = await prisma.leistung.create({ data: l });
        createdLeistungen.push(leistung);
    }
    console.log(`✓ ${leistungen.length} Leistungen angelegt`);

    // Termine
    const heute = new Date();
    const termine = [
        {
            datum: heute,
            uhrzeit: "09:00",
            art: "UNTERSUCHUNG" as const,
            status: "BESTAETIGT" as const,
            patientId: createdPatienten[0].id,
            arztId: arzt.id,
            beschwerden: "Kontrolltermin",
        },
        {
            datum: heute,
            uhrzeit: "10:00",
            art: "BEHANDLUNG" as const,
            status: "ANGEFRAGT" as const,
            patientId: createdPatienten[1].id,
            arztId: arzt.id,
            beschwerden: "Zahnschmerzen rechts unten",
        },
        {
            datum: heute,
            uhrzeit: "11:00",
            art: "UNTERSUCHUNG" as const,
            status: "BESTAETIGT" as const,
            patientId: createdPatienten[2].id,
            arztId: arzt2.id,
        },
        {
            datum: new Date(heute.getTime() + 86400000),
            uhrzeit: "09:30",
            art: "BEHANDLUNG" as const,
            status: "ANGEFRAGT" as const,
            patientId: createdPatienten[3].id,
            arztId: arzt.id,
            beschwerden: "Füllung ersetzen",
        },
        {
            datum: new Date(heute.getTime() + 86400000),
            uhrzeit: "14:00",
            art: "NOTFALL" as const,
            status: "BESTAETIGT" as const,
            patientId: createdPatienten[4].id,
            arztId: arzt2.id,
            beschwerden: "Starke akute Zahnschmerzen",
        },
    ];

    for (const t of termine) {
        await prisma.termin.create({ data: t });
    }
    console.log(`✓ ${termine.length} Termine angelegt`);

    // Zahlungen
    const zahlungen = [
        {
            patientId: createdPatienten[0].id,
            betrag: 80,
            zahlungsart: "KARTE" as const,
            status: "BEZAHLT" as const,
            leistungId: createdLeistungen[0].id,
        },
        {
            patientId: createdPatienten[1].id,
            betrag: 120,
            zahlungsart: "BAR" as const,
            status: "OFFEN" as const,
            leistungId: createdLeistungen[3].id,
        },
        {
            patientId: createdPatienten[2].id,
            betrag: 35,
            zahlungsart: "KARTE" as const,
            status: "BEZAHLT" as const,
            leistungId: createdLeistungen[1].id,
        },
    ];

    for (const z of zahlungen) {
        await prisma.zahlung.create({ data: z });
    }
    console.log(`✓ ${zahlungen.length} Zahlungen angelegt`);

    // Produkte
    await prisma.produkt.createMany({
        data: [
            { name: "Komposit A2", lieferant: "VOCO GmbH", menge: 50, hersteller: "VOCO", preis: 25, lieferstatus: "GELIEFERT" },
            { name: "Einmalhandschuhe (L)", lieferant: "Henry Schein", menge: 500, hersteller: "Unigloves", preis: 12, lieferstatus: "GELIEFERT" },
            { name: "Anästhesie Ultracain", lieferant: "Sanofi", menge: 100, hersteller: "Sanofi", preis: 45, lieferstatus: "BESTELLT" },
        ],
    });
    console.log("✓ 3 Produkte angelegt");

    console.log("\n✅ Seed abgeschlossen!");
    console.log("\nAnmeldedaten:");
    console.log("  Arzt:      ahmed@praxis.de / passwort123");
    console.log("  Rezeption: aya@praxis.de / passwort123");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
