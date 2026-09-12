import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { COMPLIANCE, NAV, PERMISSION_ROWS, type Role } from "./data";
import { Shot } from "./product/Shot";
import { ShotCarousel } from "./product/ShotCarousel";

type Theme = "light" | "dark";

function BrandMark() {
  return <span className="brand-mark" aria-hidden />;
}

function PageRail({ hash }: { hash: string }) {
  const current = hash === "" ? "#top" : hash;
  const index = Math.max(
    0,
    NAV.findIndex((item) => item.href === current),
  );
  const fill = ((index + 1) / NAV.length) * 100;
  const prev = NAV[Math.max(0, index - 1)];
  const next = NAV[Math.min(NAV.length - 1, index + 1)];

  return (
    <nav className="page-rail" aria-label="Jump between pages">
      <a className="page-rail__up" href={prev.href} title={`Back to ${prev.label}`}>
        ↑
      </a>
      <div className="page-rail__body">
        <div className="page-rail__progress" aria-hidden>
          <div className="page-rail__fill" style={{ height: `${fill}%` }} />
        </div>
        <ol className="page-rail__list">
          {NAV.map((item, step) => (
            <li key={item.href}>
              <a
                className={`page-rail__step${item.href === current ? " is-on" : ""}`}
                href={item.href}
                title={item.label}
              >
                <span className="page-rail__num">{step + 1}</span>
                <span className="page-rail__tip">{item.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
      <a className="page-rail__up" href={next.href} title={`Go to ${next.label}`}>
        ↓
      </a>
    </nav>
  );
}

const BACKENDS = [
  {
    id: "desktop",
    title: "One practice computer",
    profile: "A single chair",
    stack: "MeDoc runs on that machine. The charts stay there.",
    gain: "Nothing has to be online for the day to work.",
    lose: "A second chair needs its own way in — the practice network, or a paired laptop.",
  },
  {
    id: "lan",
    title: "One host, several chairs",
    profile: "A dedicated practice computer plus extra screens",
    stack: "The records live on the main computer. Other chairs open them over your own network.",
    gain: "One shared book for the whole floor.",
    lose: "The main computer has to be on. The link is for the practice, not the public web.",
  },
  {
    id: "peer",
    title: "Main chair and a laptop",
    profile: "Take a full copy with you",
    stack: "The laptop keeps its own encrypted copy and catches up when it can reach the main chair.",
    gain: "You can work away from the host, then meet again.",
    lose: "If both change the same thing, the later save wins. You pair the machines first.",
  },
] as const;

const CLINIC_ASPECTS = [
  {
    title: "The tooth chart",
    body: "Findings sit on the patient, with the usual dental numbering. The diagram is not a separate product.",
    shot: "odontogram",
  },
  {
    title: "Examinations",
    body: "Clinical notes live on the same record as the teeth. A physician signs off what is waiting.",
    shot: "examinations",
  },
  {
    title: "Treatments",
    body: "Each line names the service, the teeth, and whether it is ready to bill. A new treatment opens the same mouth.",
    shot: "treatments",
  },
  {
    title: "Prescriptions",
    body: "Scripts are written on the patient. Only a physician creates or changes them, unless extra rights were granted.",
    shot: "prescriptions",
  },
  {
    title: "Certificates",
    body: "Medical papers are issued from the same record. They are not a side program on another computer.",
    shot: "certificate-new",
  },
  {
    title: "Patient records",
    body: "Names, addresses, and the clinical pages share one person. Reception sees identity; the chart stays medical.",
    shot: "patient-records",
  },
  {
    title: "A new patient",
    body: "The desk can open a new file without borrowing a physician login.",
    shot: "patient-new",
  },
  {
    title: "Practice tasks",
    body: "Handoffs between the desk and the chair stay in the same menu as the morning board.",
    shot: "practice-tasks",
  },
  {
    title: "Orders",
    body: "Stock orders sit with the practice. Open one for the supplier, the status, and what is late.",
    shot: "orders",
  },
  {
    title: "Cash at the desk",
    body: "Reception collects cash. That is the money screen the desk is built to use.",
    shot: "cash-entries",
  },
  {
    title: "The money overview",
    body: "Physicians see the full picture. Finished work can become a payment. Invoices are a separate path.",
    shot: "finance",
  },
  {
    title: "Billing",
    body: "Released treatment can become a booking the cash desk already knows how to collect.",
    shot: "billing",
  },
  {
    title: "Sign-in",
    body: "Physician or reception — not one shared password for the floor.",
    shot: "sign-in",
  },
  {
    title: "Settings and language",
    body: "Appearance, language, and how the chair feels. English, German, French, and Arabic. Arabic reads right to left.",
    shot: "settings",
  },
  {
    title: "Administration",
    body: "Practice administration stays a physician screen on a normal login. Staff records and hours live here too.",
    shot: "administration",
  },
] as const;

function FeatureBand({
  id,
  alt,
  flip,
  kicker,
  title,
  mech,
  after,
  children,
}: {
  id?: string;
  alt?: boolean;
  flip?: boolean;
  kicker: string;
  title: string;
  mech: string;
  after: string;
  children: ReactNode;
}) {
  return (
    <section className={`band feature-band${alt ? " band--alt" : ""}${flip ? " feature-band--flip" : ""}`} id={id}>
      <div className="band-copy">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="lede">{mech}</p>
        <p className="after">{after}</p>
      </div>
      <div className="band-stage">{children}</div>
    </section>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [backend, setBackend] = useState<(typeof BACKENDS)[number]["id"]>("desktop");
  const [role, setRole] = useState<Role>("PHYSICIAN");
  const [sent, setSent] = useState(false);
  const [hash, setHash] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setMenu(false);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const nodes = NAV.map((item) => document.getElementById(item.href.slice(1))).filter(
      (el): el is HTMLElement => el != null,
    );
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setHash(`#${visible.target.id}`);
      },
      { threshold: 0.45 },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const selected = useMemo(() => BACKENDS.find((b) => b.id === backend) ?? BACKENDS[0], [backend]);

  function onContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const email = String(fd.get("email") ?? "");
    const note = String(fd.get("note") ?? "");
    const subject = encodeURIComponent("MeDoc walkthrough request");
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${note}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <>
      <a className="skip-link" href="#top">
        Skip to homepage
      </a>
      <PageRail hash={hash === "" ? "#top" : hash} />
      <div className="site-bg" aria-hidden />
      <div className="site-frame">
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="MeDoc home">
          <BrandMark />
          MeDoc
        </a>
        <nav className="nav-links" aria-label="Site">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className={
                n.href === "#top"
                  ? hash === "" || hash === "#top"
                    ? "active"
                    : ""
                  : hash === n.href
                    ? "active"
                    : ""
              }
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button type="button" className="btn btn-ghost nav-menu" onClick={() => setMenu((m) => !m)}>
            Open menu
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "Dark appearance" : "Light appearance"}
          </button>
          <a className="btn btn-accent" href="#contact">
            Request a practice walkthrough
          </a>
        </div>
      </header>
      {menu ? (
        <div className="nav-drawer">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </div>
      ) : null}

      <header className="hero-band" id="top">
        <div className="hero-copy">
          <p className="kicker">
            <span className="dot-accent" aria-hidden />
            Clinic software for dental practices
          </p>
          <h1>The chart stays in the clinic.</h1>
          <p className="hero-sub">
            Reception books the day's list. Physicians open the medical record. Files live on the practice
            computers — not on a public patient cloud.
          </p>
        </div>
        <div className="hero-cta">
          <a className="btn btn-accent" href="#contact">
            Come sit with us — ask for a walkthrough
          </a>
          <a className="btn btn-subtle" href="#story">
            Meet the team
          </a>
        </div>
        <div className="hero-stage">
          <Shot id="overview" alt="MeDoc overview of the practice day" />
        </div>
        <p className="hero-cue">
          Start with the headline, glance at the picture, then ask for a walkthrough. Below: who may see what,
          backups you hold, and a chart you can print.
        </p>
      </header>

      <section className="band band--navy" id="story">
        <div className="story-grid">
          <Shot id="overview" alt="The MeDoc morning board" />
          <div>
            <p className="kicker">Why we built it</p>
            <h2>We sat in practices. We watched the day break in three places.</h2>
            <p className="lede">
              The team behind MeDoc spent time at the chair, at the desk, and in the back office. The same
              morning lived in a paper folder, a calendar that did not know the chart, and a money tool that
              never saw the tooth. When the internet dropped, the hosted record dropped with it. People shared
              one login because the software treated the whole floor as one person.
            </p>
            <p className="lede">
              We treated those as the work, not as background noise. One menu for the day. Two honest jobs —
              physician and reception — so the medical chart is not an accident at the desk. Records that stay
              on the practice computers. A backup you can hold. A chart you can print. We are still closing the
              gaps we found. If that is the practice you want, sit with us for a walkthrough.
            </p>
            <p className="footnote">
              MeDoc helps licensed dental staff document the day. It is not a medical device. The screens on this
              page are the real product.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--alt" id="problem">
        <div className="band-copy">
          <p className="kicker">Why MeDoc</p>
          <h2>The chair, the desk, and the cabinet should not be three products.</h2>
          <p className="lede">
            A dental practice has to document treatment, collect fees, and keep health data off the wrong screen.
            Paper splits findings from the next appointment. A hosted system moves the chart off-site. MeDoc keeps
            those jobs on the practice computers — and keeps the medical chart off the reception screen.
          </p>
        </div>
        <div className="trio">
          <article>
            <h3>Paper charts</h3>
            <p>Findings in a folder. The next slot in a book. No tooth chart on the same patient.</p>
          </article>
          <article>
            <h3>One shared login</h3>
            <p>
              If reception can open the medical view, the wrong person sees health data. MeDoc gives reception the
              calendar and cash desk, and reserves the chart for the physician.
            </p>
          </article>
          <article>
            <h3>Records leaving the practice</h3>
            <p>
              Practice data stays on the practice computer or a paired replica. There is no patient-data cloud in
              this product.
            </p>
          </article>
        </div>
      </section>

      <section className="band" id="how">
        <div className="band-copy">
          <p className="kicker">How you run it</p>
          <h2>Install on the practice PC. Add chairs when you need them.</h2>
          <p className="lede">
            Start with one licensed computer. Add another chair on your practice network, or a laptop that keeps
            its own copy and catches up when it can.{" "}
            <a href="#backends">See one computer, several chairs, and a laptop side by side</a>.
          </p>
        </div>
        <div className="trio">
          <article>
            <h3>License or pair</h3>
            <p>The main PC uses a device license. Extra chairs join with a PIN pairing step.</p>
          </article>
          <article>
            <h3>Work the day</h3>
            <p>Reception books appointments and cash. Physicians validate charts. Tasks move between roles.</p>
          </article>
          <article>
            <h3>Close and prove</h3>
            <p>End-of-day close, signed activity log, backups, and a patient export or erase — on the practice network.</p>
          </article>
        </div>
      </section>

      <FeatureBand
        id="workspace"
        alt
        kicker="The menu"
        title="One quiet column. Every job that person is allowed to open."
        mech="The left side is grouped into the day, the clinic, and the practice. Overview and the book sit at the top. Patient records and tasks follow. A physician also sees statistics. Cash, orders, hours, administration, and settings sit with the practice. What you see depends on who signed in — and on any extra rights a physician granted."
        after="Click once. The page changes; the menu stays. Open a slot or an order on the side so you never feel thrown into another product."
      >
        <ShotCarousel
          slides={[
            {
              id: "overview",
              alt: "Physician overview with the full MeDoc sidebar",
              caption: "A physician sees the full menu: the day, the book, records, tasks, numbers, money, and settings.",
            },
            {
              id: "practice-tasks",
              alt: "Practice tasks with the physician sidebar still visible",
              caption: "Practice tasks stay one click from the morning board — same menu, same person.",
            },
          ]}
        />
      </FeatureBand>

      <section className="band" id="appointments">
        <div className="band-copy">
          <p className="kicker">The book</p>
          <h2>The week, the day, and the card are the same appointment.</h2>
          <p className="lede">
            Reception and physicians share one calendar. Drag a slot. Open the card on the side without leaving
            the grid. The clock will not let two things sit on the same chair at once.
          </p>
        </div>
        <div className="split-stage">
          <ShotCarousel
            slides={[
              {
                id: "schedule-week",
                alt: "MeDoc week schedule with appointment cards",
                caption: "The week: who is in the chair, and when.",
              },
              {
                id: "schedule-day",
                alt: "MeDoc day schedule",
                caption: "The day, snapped to the clock.",
              },
              {
                id: "appointment-detail",
                alt: "Appointment detail drawer over the calendar",
                caption: "The card opens on the side: how it is going, a note, the patient.",
              },
              {
                id: "appointment-new",
                alt: "New appointment on the calendar",
                caption: "A new slot without opening another product.",
              },
            ]}
          />
          <div className="fact-stack">
            <article>
              <h3>Week and day</h3>
              <p>Switch the view. The same people, the same chairs, the same rules against overlap.</p>
            </article>
            <article>
              <h3>The card stays put</h3>
              <p>Status, a note, and the patient open beside the grid. You do not jump into a second calendar.</p>
            </article>
            <article>
              <h3>From the slot to the chart</h3>
              <p>
                Open the person from the appointment when you are a physician. Reception stays on names and the
                book — not the tooth chart.
              </p>
            </article>
            <article>
              <h3>Tasks beside the day</h3>
              <p>
                Practice tasks sit in the same menu. A handoff does not need a sticky note on the monitor.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="band band--alt" id="clinic">
        <div className="band-copy">
          <p className="kicker">The whole clinic</p>
          <h2>What the product actually contains.</h2>
          <p className="lede">
            The book is one room. The rest of the floor is here too: the chart, the till, the orders, the papers,
            the lock on the door. Each card is a real screen.
          </p>
        </div>
        <div className="aspect-grid">
          {CLINIC_ASPECTS.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <Shot id={item.shot} alt={`MeDoc ${item.title}`} />
            </article>
          ))}
        </div>
      </section>

      <section className="band band--alt" id="security">
        <div className="band-copy">
          <p className="kicker">Who sees what</p>
          <h2>Two jobs. Not one shared password.</h2>
          <p className="lede">
            MeDoc ships with Physician and Reception. Other job titles are not live yet. Switch the button below.
            The table is the everyday default — not a promise of extra roles.
          </p>
        </div>
        <div className="role-switch">
          {(["PHYSICIAN", "RECEPTION"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={role === r ? "btn btn-accent" : "btn btn-subtle"}
              onClick={() => setRole(r)}
            >
              {r === "PHYSICIAN" ? "Physician" : "Reception"}
            </button>
          ))}
        </div>
        <div className="perm-wrap">
          <table className="perm-table">
            <thead>
              <tr>
                <th>What they can do</th>
                <th>This job</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map((row) => {
                const ok = role === "PHYSICIAN" ? row.physician : row.reception;
                return (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>
                      <span className={`pill ${ok ? "green" : "grey"}`}>{ok ? "Yes" : "No"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="footnote" style={{ marginTop: 20 }}>
          A physician can grant or take away extra rights on one staff member. That person’s menu grows or
          shrinks without inventing a third job. Statistics stay a physician screen. Practice administration stays
          closed to reception. Passwords are stored safely. The software itself enforces the same rules you see
          here.
        </p>
      </section>

      <FeatureBand
        id="reception"
        kicker="Reception"
        title="The desk sees the day, the book, and cash — not the clinical chart."
        mech="Signed in as reception, the menu hides statistics, the full money overview, charts waiting for a physician, and administration. What remains: the day, the book, patient names and details, tasks, cash, orders, hours, and settings. On a patient, medical tabs stay off. Prescriptions may be listed with a note that only medically cleared people create or change them."
        after="Need a wider desk login? A physician can grant extra rights to that person, one by one. The default is the quiet menu you see here — never a shared admin password."
      >
        <ShotCarousel
          slides={[
            {
              id: "reception-overview",
              alt: "Reception overview with a shorter sidebar",
              caption: "Reception’s morning — no statistics, no full money overview, no administration in the menu.",
            },
            {
              id: "reception-patient",
              alt: "Reception opening a patient record without medical chart tabs",
              caption: "A patient for reception: who they are, not the tooth chart.",
            },
            {
              id: "cash-entries",
              alt: "Reception cash receipts",
              caption: "Cash at the desk — the money screen reception is built to use.",
            },
          ]}
        />
      </FeatureBand>

      <FeatureBand
        id="chart"
        alt
        kicker="The chart"
        title="The mouth lives on the patient."
        mech="Open a patient and you have their details and the clinical pages together. Teeth use the usual dental numbering. Physicians sign off records that are waiting in the menu."
        after="Before: a paper diagram in a drawer. After: finding, treatment, and sign-off share the same person."
      >
        <Shot id="odontogram" alt="MeDoc patient record with the tooth chart" />
      </FeatureBand>

      <FeatureBand
        id="analytics"
        kicker="Numbers and help"
        title="Counts and trends — for the people who may see them."
        mech="Statistics sit in the menu for physicians. You pick a period and see patients, appointments, treatments, income, and open orders from your own practice — the figures on screen are yours, not a published average. Help is a quiet page: shortcuts, a way to send feedback, and a little about the app. It orients you. It does not advise on care."
        after="Reception does not get statistics in the everyday menu. Help is still there from settings and the menus of the app."
      >
        <Shot
          id="analytics"
          alt="MeDoc analytics overview with period filters and KPI tiles"
          caption="A physician looking at the practice numbers. What you see is this practice, not a public ranking."
        />
      </FeatureBand>

      <FeatureBand
        id="documents"
        alt
        flip
        kicker="Documents"
        title="Build a chart you can print. Tick the parts. Save a PDF."
        mech="From the patient, Export lets you choose the paper and which sections to include. A preview sits beside the list. Confirm writes a PDF into the practice documents folder. Invoices are a separate path from money. If required fields are empty, export can wait until they are filled."
        after="This is the paper you hand over or archive. A portable file for the patient is a different, quieter path."
      >
        <Shot
          id="export-chart"
          alt="Export patient chart dialog with section checkboxes and PDF preview"
        />
      </FeatureBand>

      <FeatureBand
        id="backup"
        kicker="Backups and security"
        title="Take a copy. See who signed in. Lock the idle chair."
        mech="A physician can make, check, and restore an encrypted backup. Reception cannot, on a normal login. Restore always asks you to confirm — it is a serious step. Nearby, security shows the signed activity log, who is signed in, and a lock after the chair sits idle."
        after="Backups stay on the practice computer, or on a disk you choose. There is no patient cloud of this book."
      >
        <Shot
          id="settings-security"
          alt="MeDoc settings security: audit log, sessions, and auto-lock"
          caption="Security: the log, the sessions, the idle lock. Backups live next door, for the same physician."
        />
      </FeatureBand>

      <section className="band band--ink" id="backends">
        <div className="band-copy">
          <p className="kicker">How you set it up</p>
          <h2>Choose the shape of the practice.</h2>
          <p className="lede">
            One computer. Several chairs on your network. Or a laptop that keeps a copy. The records stay in the
            clinic.
          </p>
        </div>
        <div className="backend-tabs" role="tablist">
          {BACKENDS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={backend === b.id}
              onClick={() => setBackend(b.id)}
            >
              {b.title}
            </button>
          ))}
        </div>
        <div className="stack-card">
          <span className="pill accent">{selected.profile}</span>
          <h3 style={{ margin: "16px 0 8px", fontSize: 28, letterSpacing: "-0.03em" }}>{selected.title}</h3>
          <p>
            <strong>How it works.</strong> {selected.stack}
          </p>
        </div>
        <div className="trade">
          <div>
            <strong>You gain.</strong>
            <br />
            {selected.gain}
          </div>
          <div>
            <strong>You give up.</strong>
            <br />
            {selected.lose}
          </div>
        </div>
      </section>

      <section className="band band--alt" id="compliance">
        <div className="band-copy">
          <p className="kicker">Care of the data</p>
          <h2>What we actually do. Not a badge on the wall.</h2>
          <p className="lede">
            We do not sell a GDPR stamp. Each line is something the product can do. The practice remains
            responsible for the people in the chair.
          </p>
        </div>
        <div className="comp-list">
          {COMPLIANCE.map((c) => (
            <article key={c.title} className="comp-item">
              <h3>{c.title}</h3>
              <p>{c.how}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="band" id="contact">
        <div className="band-copy">
          <p className="kicker">Next</p>
          <h2>Keep going with us. Ask for a walkthrough.</h2>
          <p>
              We still work on the weak spots we saw on the floor. This form opens a mail draft on your computer
              — we do not run a signup cloud.
            </p>
        </div>
        <div className="cta-box">
          <div>
            <p>
              There is no public signup. You start with a license, a pairing, or joining the practice network,
              then you sign in. This form only opens a letter on your computer.
            </p>
            <p className="footnote">
              For licensed dental staff. Documentation and practice work — not a medical device.
            </p>
          </div>
          <form onSubmit={onContact}>
            <label className="field">
              Name
              <input name="name" required autoComplete="name" />
            </label>
            <label className="field">
              Work email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field">
              Practice setup
              <textarea name="note" rows={3} placeholder="One computer, extra chairs, or a laptop that copies" />
            </label>
            <button type="submit" className="btn btn-accent">
              Open a walkthrough request in your mail app
            </button>
            {sent ? (
              <p className="footnote" style={{ marginTop: 10 }}>
                If nothing opened, set a default mail app. No server collected this form.
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <footer className="site-foot">
        <a href="#top">Home</a>
        {" · "}
        <a href="#contact">Request a practice walkthrough</a>
        {" · "}
        MeDoc · Made by a small team for the chair · Not legal advice · Not a medical device
      </footer>
      </div>
    </>
  );
}
