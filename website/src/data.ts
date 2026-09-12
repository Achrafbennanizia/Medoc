export const NAV = [
  { href: "#top", label: "Welcome" },
  { href: "#story", label: "The team" },
  { href: "#problem", label: "Why MeDoc" },
  { href: "#how", label: "How it runs" },
  { href: "#workspace", label: "The menu" },
  { href: "#appointments", label: "The book" },
  { href: "#clinic", label: "The clinic" },
  { href: "#security", label: "Who sees what" },
  { href: "#reception", label: "Reception" },
  { href: "#chart", label: "The chart" },
  { href: "#analytics", label: "Numbers" },
  { href: "#documents", label: "Print" },
  { href: "#backup", label: "Safety" },
  { href: "#backends", label: "Setup" },
  { href: "#compliance", label: "Patient data" },
  { href: "#contact", label: "Talk to us" },
] as const;

export type Role = "PHYSICIAN" | "RECEPTION";

export const PERMISSION_ROWS: {
  id: string;
  label: string;
  physician: boolean;
  reception: boolean;
}[] = [
  { id: "master", label: "Patient names, addresses, and contact details", physician: true, reception: true },
  { id: "medical", label: "The medical chart and tooth findings", physician: true, reception: false },
  { id: "cal", label: "The appointment book", physician: true, reception: true },
  { id: "fin", label: "The full money overview", physician: true, reception: false },
  { id: "cash", label: "The cash desk", physician: false, reception: true },
  { id: "staff", label: "Staff records", physician: true, reception: false },
  { id: "audit", label: "Who did what, and when", physician: true, reception: false },
  { id: "ops", label: "Backups and erasing a patient file", physician: true, reception: false },
  { id: "stats", label: "Practice statistics", physician: true, reception: false },
  { id: "time", label: "Clocking your own hours", physician: true, reception: true },
  { id: "dash", label: "Today’s overview", physician: true, reception: true },
];

export const COMPLIANCE = [
  {
    title: "The records stay with you",
    how: "Charts live on the practice computer, or on a laptop you pair with it. We do not run a public cloud of patient files.",
  },
  {
    title: "Locked while it sits on the disk",
    how: "The practice database is encrypted. The key stays with the machine, not on a website.",
  },
  {
    title: "Locked on the way between chairs",
    how: "If extra chairs join over the practice network, that link is encrypted. It is your network, not the open internet.",
  },
  {
    title: "A trail you can check",
    how: "Important actions are signed into a log. A physician can see whether that trail is intact.",
  },
  {
    title: "Backups you hold",
    how: "A physician can make, check, and restore an encrypted copy. Reception cannot do that on a normal login. Restore always asks for confirmation.",
  },
  {
    title: "A copy for the patient",
    how: "A physician can hand over one patient’s records as a portable file. That is separate from the print-ready chart you might give at the desk.",
  },
  {
    title: "A request to be forgotten",
    how: "A physician can erase a patient’s medical rows. A thin anonymous stub can remain so the legal log still makes sense. Copies in backups are cleaned as far as the product allows.",
  },
  {
    title: "A starting note for your files",
    how: "The app can draft processing notes for the practice. You remain the one responsible. It is a beginning, not a certificate.",
  },
  {
    title: "Passwords treated carefully",
    how: "Sign-in stores a one-way hash of the password, not the password itself.",
  },
  {
    title: "Not a medical device",
    how: "MeDoc is for documentation and practice work by licensed dental staff. It is not sold as a diagnostic medical device.",
  },
];
