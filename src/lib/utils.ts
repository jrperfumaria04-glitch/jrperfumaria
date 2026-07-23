import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWhatsAppNumber(num: string): string {
  if (!num) return "";
  // Remove all non-digit characters
  const cleaned = num.replace(/\D/g, "");
  
  // Standard Brazilian phone number with country code (e.g., 5554991407378)
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    const ddd = cleaned.substring(2, 4);
    const numberPart = cleaned.substring(4);
    if (numberPart.length === 9) {
      return `+55 (${ddd}) ${numberPart.substring(0, 5)}-${numberPart.substring(5)}`;
    } else if (numberPart.length === 8) {
      return `+55 (${ddd}) ${numberPart.substring(0, 4)}-${numberPart.substring(4)}`;
    }
  }
  
  // Brazilian phone number without country code (e.g., 54991407378)
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  
  // Generic fallback if it's already formatted or another country
  if (num.includes("(") || num.includes("-") || num.includes(" ")) {
    return num;
  }
  
  // If it's just numbers but doesn't match above, return a generic spaced format
  if (cleaned.length > 4) {
    return `+${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
  }
  
  return num;
}
