import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Fonts are bundled with the site: no request to a font CDN (visitor IPs stay with us).
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
// Styles, in cascade order (split to keep each file under 400 lines).
import "./styles/01-tokens-base-header.css";
import "./styles/02-hero-odontogram-sections.css";
import "./styles/03-morocco-prices-faq-contact.css";
import "./styles/04-responsive-product.css";
import "./styles/05-news-documents-legal.css";
import "./styles/06-mobile-cookie-pages.css";
import "./styles/07-subpages-security-digitalization.css";
import "./styles/08-pilot-goal-pages-header.css";
import "./styles/09-editions-features.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
