/* eslint-disable react-refresh/only-export-components */
import type { FC, SVGProps } from "react";

/** Shared icon sizes — use in buttons, nav, and toolbars for consistency. */
export const ICON_SIZE_SM = 14;
export const ICON_SIZE_MD = 16;
export const ICON_SIZE_LG = 18;
export const ICON_SIZE_XL = 20;

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = ICON_SIZE_MD, children, className, style, ...props }: IconProps) {
  const dim = size ?? ICON_SIZE_MD;
  return (
    <svg
      {...props}
      className={className ? `ui-icon ${className}` : "ui-icon"}
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: dim,
        height: dim,
        minWidth: dim,
        minHeight: dim,
        maxWidth: dim,
        maxHeight: dim,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </svg>
  );
}

export const CheckIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M5 12l4 4 10-10" /></IconBase>;
export const XIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M6 6l12 12M18 6L6 18" /></IconBase>;
export const SearchIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></IconBase>;
export const EyeIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" /></IconBase>;
export const EyeOffIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M6.7 6.7C4.2 8.2 2.7 10.8 2 12c1.5 2.6 4.6 6 10 6 2.3 0 4.1-.6 5.6-1.5" /><path d="M14.7 9.3A3 3 0 009 14.7" /><path d="M9.8 4.2A11 11 0 0112 4c5.4 0 8.5 3.4 10 6-.6 1.1-1.6 2.6-3.1 3.9" /></IconBase>;
export const PinIcon: FC<{ size?: number }> = ({ size = 18 }) => <IconBase size={size}><path d="M14 3l7 7-3 1-4 4-1 5-2-2 1-4-4-4-5-1 2-2 5 1 4-4z" /></IconBase>;
export const BellIcon: FC<{ size?: number }> = ({ size = 18 }) => <IconBase size={size}><path d="M15 18H9" /><path d="M18 16H6l1.5-2V10a4.5 4.5 0 019 0v4L18 16z" /></IconBase>;
export const WifiIcon: FC<{ size?: number }> = ({ size = 12 }) => <IconBase size={size}><path d="M2 9a14 14 0 0120 0" /><path d="M5 12a9 9 0 0114 0" /><path d="M8.5 15.5a4 4 0 017 0" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></IconBase>;
export const ChevronRightIcon: FC<{ size?: number }> = ({ size = 12 }) => <IconBase size={size}><path d="M9 6l6 6-6 6" /></IconBase>;
export const ChevronLeftIcon: FC<{ size?: number }> = ({ size = 12 }) => <IconBase size={size}><path d="M15 6l-6 6 6 6" /></IconBase>;
export const ChevronDownIcon: FC<{ size?: number }> = ({ size = 12 }) => <IconBase size={size}><path d="M6 9l6 6 6-6" /></IconBase>;
export const MoreIcon: FC<{ size?: number }> = ({ size = 16 }) => <IconBase size={size}><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></IconBase>;
export const PlusIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M12 5v14M5 12h14" /></IconBase>;
export const MenuIcon: FC<{ size?: number }> = ({ size = 18 }) => <IconBase size={size}><path d="M4 6h16M4 12h16M4 18h16" /></IconBase>;
export const FilterIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M4 6h16M7 12h10M10 18h4" /></IconBase>;
/** Zwei Balken — Pause / Unterbrechung */
export const PauseIcon: FC<{ size?: number }> = ({ size = 14 }) => (
    <IconBase size={size}>
        <rect x="7" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
        <rect x="14" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
    </IconBase>
);
export const SparkleIcon: FC<{ size?: number }> = ({ size = 16 }) => <IconBase size={size}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /></IconBase>;
export const ShieldCheckIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M12 3l7 3v6c0 4.5-3.2 7.8-7 9-3.8-1.2-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></IconBase>;
export const EditIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M4 20l4-.7 9-9-3.3-3.3-9 9L4 20z" /><path d="M13.7 7l3.3 3.3" /></IconBase>;
export const TrashIcon: FC<{ size?: number }> = ({ size = 14 }) => (
    <IconBase size={size}>
        <path d="M4 7h16" />
        <path d="M10 11v6M14 11v6" />
        <path d="M6 7l1 14h10l1-14M9 7V4h6v3" />
    </IconBase>
);
export const CalendarIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 9h18M8 3v4M16 3v4" /></IconBase>;
export const ClockIcon: FC<{ size?: number }> = ({ size = 14 }) => (
    <IconBase size={size}>
        <circle cx="12" cy="12" r="8.25" />
        <path d="M12 8v4l3 2" />
    </IconBase>
);
export const PhoneIcon: FC<{ size?: number }> = ({ size = 12 }) => <IconBase size={size}><path d="M6 4h3l1 4-2 1a12 12 0 006 6l1-2 4 1v3a2 2 0 01-2 2C9 19 5 15 5 7a2 2 0 012-2z" /></IconBase>;
export const MailIcon: FC<{ size?: number }> = ({ size = 12 }) => <IconBase size={size}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></IconBase>;
export const ExportIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 14v5h14v-5" /></IconBase>;
/** Caps Lock — password field hint (replaces stretched WebKit native indicator). */
export const CapsLockIcon: FC<{ size?: number }> = ({ size = 14 }) => (
    <IconBase size={size}>
        <path d="M7 10.5V8.2L12 4.5l5 3.7v2.3" />
        <path d="M6 10.5h12" />
        <rect x="6" y="12.5" width="12" height="4.5" rx="1" fill="currentColor" stroke="none" />
    </IconBase>
);
/** Up arrow in circle — upload zone (`currentColor`, dark-mode friendly). */
export const UploadCircleIcon: FC<{ size?: number }> = ({ size = 44 }) => (
    <IconBase size={size} aria-hidden>
        <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth="1.25" />
        <path d="M12 8.5v6.5M9.2 11.2L12 8.5l2.8 2.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
);
export const BoltIcon: FC<{ size?: number }> = ({ size = 16 }) => (
    <IconBase size={size}>
        <path d="M13 2L3 14h7l-1 8 11-12h-7l3-8z" />
    </IconBase>
);
/** Sonne — Darstellung / Theme. */
export const SunIcon: FC<{ size?: number }> = ({ size = 18 }) => (
    <IconBase size={size}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77" />
    </IconBase>
);
/** Einstellungen slider — workflows. */
export const SlidersHorizontalIcon: FC<{ size?: number }> = ({ size = 18 }) => (
    <IconBase size={size}>
        <path d="M4 21v-6.5M4 10V3M12 21v-3M12 14V3M20 21v-9M20 8V3M9 10h6M14 17h7M7 17H5" />
    </IconBase>
);
/** Stethoskop — Praxis (an Lucide angelehnt). */
export const StethoscopeIcon: FC<{ size?: number }> = ({ size = 18 }) => (
    <IconBase size={size}>
        <path d="M6 20v-2a4 4 0 014-4h1" />
        <path d="M6 4a2 2 0 114 0v7a3 3 0 006 0V5a2 2 0 114 0v6" />
        <path d="M12 11V9" />
    </IconBase>
);
/** Key — license & subscription. */
export const KeyRoundIcon: FC<{ size?: number }> = ({ size = 18 }) => (
    <IconBase size={size}>
        <path d="M3 14l9.5 9.5a3 3 0 004.24-4.24L10.5 12.5" />
        <path d="M8 8l4 4" />
        <circle cx="14.5" cy="9.5" r="3.5" />
    </IconBase>
);
export const DownloadIcon: FC<{ size?: number }> = ({ size = 14 }) => <IconBase size={size}><path d="M12 4v10" /><path d="M8 10l4 4 4-4" /><path d="M5 19h14" /></IconBase>;
/** Rahmenlos-Fenster: minimieren (Tauri-Desktop). */
export const WindowChromeMinimizeIcon: FC<{ size?: number }> = ({ size = 12 }) => (
    <IconBase size={size}>
        <path d="M5 16h14" />
    </IconBase>
);
/** Rahmenlos-Fenster: maximieren. */
export const WindowChromeMaximizeIcon: FC<{ size?: number }> = ({ size = 12 }) => (
    <IconBase size={size}>
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </IconBase>
);
/** Rahmenlos-Fenster: wiederherstellen (maximiert). */
export const WindowChromeRestoreIcon: FC<{ size?: number }> = ({ size = 12 }) => (
    <IconBase size={size}>
        <path d="M8 5v11h11V5H8z" />
        <path d="M5 8h11v11H5V8z" />
    </IconBase>
);
/** Emergency / Notfall — von Lucide „ambulance“ inspiriert. Lizenz: `third_party/LICENSES.md` (ISC, Lucide). */
export const AmbulanceIcon: FC<IconProps> = ({ size = 20, ...props }) => (
    <IconBase size={size} {...props}>
        <path d="M10 10H6" />
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14" />
        <path d="M8 8v4" />
        <path d="M9 18h6" />
        <circle cx="17" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
    </IconBase>
);

const DashboardIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M5 19V9M12 19V5M19 19v-8" /></IconBase>;
export const UsersIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><path d="M17 11a3 3 0 110-6M18 19c0-2.2-1.3-3.8-3.3-4.6" /></IconBase>;
const WalletIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M15 12h6M17 12h.01" /></IconBase>;
export const PackageIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M12 3l8 4-8 4-8-4 8-4z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></IconBase>;
const ChartIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M4 19V9M10 19V5M16 19v-7M22 19v-3" /></IconBase>;
export const PillIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><rect x="4" y="8" width="16" height="8" rx="4" /><path d="M12 8v8" /></IconBase>;
const DocIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></IconBase>;
/** Verwaltung / building — inspired by Lucide "building"; license see `third_party/LICENSES.md`. */
const BuildingIcon: FC<{ size?: number }> = ({ size = 17 }) => (
    <IconBase size={size}>
        <path d="M6 22V10l6-4 6 4v12" />
        <path d="M9 22v-4h6v4" />
        <path d="M10 14h4M10 18h4" />
    </IconBase>
);
export const ToothIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M12 3c3 0 5 2 5 5 0 6-1 12-3 12-1.2 0-1.3-2-2-3-.7 1-1 3-2 3-2 0-3-6-3-12 0-3 2-5 5-5z" /></IconBase>;
export const ClipboardIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4.5h6" /></IconBase>;
const ScrollIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M6 4h12v14a3 3 0 01-3 3H8a3 3 0 01-3-3V7a3 3 0 013-3z" /><path d="M9 9h6M9 13h6" /></IconBase>;
export const SettingsIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></IconBase>;
/** Schild — Einstellungen › Sicherheit (Outline). */
export const ShieldIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><path d="M12 3l7 3v6c0 4.5-3.2 7.8-7 9-3.8-1.2-7-4.5-7-9V6l7-3z" /></IconBase>;
const LockIcon: FC<{ size?: number }> = ({ size = 17 }) => <IconBase size={size}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 118 0v3" /></IconBase>;
const TruckIcon: FC<{ size?: number }> = ({ size = 17 }) => (
    <IconBase size={size}>
        <path d="M14 18V6a2 2 0 00-2-2H4a2 2 0 00-2 2v11a1 1 0 001 1h1" />
        <path d="M15 18h2a1 1 0 001-1v-3.28a1 1 0 00-.684-.948l-1.923-.641a1 1 0 01-.578-.502l-1.539-3.076A1 1 0 0012.382 8H14" />
        <path d="M2 18h12" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
    </IconBase>
);
const HelpCircleIconImpl: FC<{ size?: number }> = ({ size = 17 }) => (
    <IconBase size={size}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </IconBase>
);

/** Help circle (question mark) — e.g. Hilfe route. */
export const HelpCircleIcon = HelpCircleIconImpl;

/** Topbar info — same glyph as {@link HelpCircleIcon}. */
export const InfoIcon = HelpCircleIconImpl;

/** Route paths only (`href`), consistent with sidebar. Name aliases see {@link NAV_ICON_ALIASES}. */
export const NAV_ROUTE_ICONS: Record<string, FC<{ size?: number }>> = {
  "/": DashboardIcon,
  "/termine": CalendarIcon,
  "/patienten": UsersIcon,
  "/akten/zu-validieren": ShieldCheckIcon,
  "/posteingang": MailIcon,
  "/tickets": ClipboardIcon,
  "/finanzen": WalletIcon,
  "/bilanz": ChartIcon,
  "/rezepte": PillIcon,
  "/atteste": DocIcon,
  "/leistungen": ToothIcon,
  "/produkte": PackageIcon,
  "/personal": UsersIcon,
  "/statistik": ChartIcon,
  "/audit": ClipboardIcon,
  "/logs": ScrollIcon,
  "/ops": SettingsIcon,
  "/compliance": ShieldIcon,
  "/datenschutz": LockIcon,
    "/einstellungen": SettingsIcon,
    "/bestellungen": TruckIcon,
    "/hilfe": HelpCircleIconImpl,
    "/verwaltung": BuildingIcon,
};

/** Legacy keys from Verwaltung tiles / embedded modules — do not mix with route paths. */
export const NAV_ICON_ALIASES: Record<string, FC<{ size?: number }>> = {
    Users: UsersIcon,
    Wallet: WalletIcon,
    Package: PackageIcon,
    Calendar: CalendarIcon,
    Clock: ClockIcon,
    Sparkle: SparkleIcon,
};

/** Sidebar + Verwaltung: routes + optional name aliases. */
export const NAV_ICONS: Record<string, FC<{ size?: number }>> = {
    ...NAV_ROUTE_ICONS,
    ...NAV_ICON_ALIASES,
};
