import { WHATSAPP_NUMBER } from "./config";

/** A wa.me link that opens WhatsApp with the text ready. */
export function waLink(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
