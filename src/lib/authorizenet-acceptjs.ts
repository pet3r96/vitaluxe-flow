/**
 * Authorize.Net Accept.js Integration
 * Securely tokenizes card data client-side before sending to server
 */

import type { CardData, AcceptJsResponse } from "@/types/domain/payments";

export type { CardData, AcceptJsResponse };

// Public keys (safe for browser)
const AUTHORIZENET_API_LOGIN_ID = '5RHaf53LDc3';
const AUTHORIZENET_PUBLIC_CLIENT_KEY = '4SdAK3f4YaL5P89MM94UDcz7j8mGMG8DDy9HC2W3nDr88uS6pCP9Phzvf4ARGDUN';

// Accept.js types
interface AcceptJsSecureData {
  authData: {
    clientKey: string;
    apiLoginID: string;
  };
  cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  };
}

interface AcceptJsNativeResponse {
  messages: {
    resultCode: string;
    message: Array<{ code: string; text: string }>;
  };
  opaqueData?: {
    dataDescriptor: string;
    dataValue: string;
  };
}

declare global {
  interface Window {
    Accept: {
      dispatchData: (
        secureData: AcceptJsSecureData,
        callback: (response: AcceptJsNativeResponse) => void
      ) => void;
    };
  }
}

/**
 * Tokenize card data using Accept.js
 * Card numbers are securely tokenized in the browser and never touch our servers
 */
export const tokenizeCard = async (cardData: CardData): Promise<AcceptJsResponse> => {
  // Ensure Accept.js is loaded
  if (typeof window === 'undefined' || !window.Accept) {
    console.error('Accept.js not loaded');
    return {
      success: false,
      messages: {
        resultCode: 'Error',
        message: [{ code: 'E00001', text: 'Accept.js is not loaded. Please refresh the page.' }]
      }
    };
  }

  const secureData: AcceptJsSecureData = {
    authData: {
      clientKey: AUTHORIZENET_PUBLIC_CLIENT_KEY,
      apiLoginID: AUTHORIZENET_API_LOGIN_ID
    },
    cardData: {
      cardNumber: cardData.cardNumber.replace(/\s/g, ''),
      month: cardData.expiryMonth.padStart(2, '0'),
      year: cardData.expiryYear.length === 2 ? cardData.expiryYear : cardData.expiryYear.slice(-2),
      cardCode: cardData.cvv
    }
  };

  return new Promise((resolve) => {
    window.Accept.dispatchData(secureData, (response: AcceptJsNativeResponse) => {
      const isSuccess = response.messages.resultCode === 'Ok';
      
      if (!isSuccess) {
        console.error('Accept.js tokenization failed:', response.messages);
      }
      
      resolve({
        success: isSuccess,
        opaqueData: response.opaqueData,
        messages: response.messages
      });
    });
  });
};

/**
 * Detect card type from card number (BIN lookup)
 */
export const detectCardType = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(cleaned)) return 'Visa';
  if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
  if (/^2[2-7]/.test(cleaned)) return 'Mastercard'; // New Mastercard BINs
  if (/^3[47]/.test(cleaned)) return 'Amex';
  if (/^6(?:011|5|4[4-9]|22)/.test(cleaned)) return 'Discover';
  
  return 'Unknown';
};

/**
 * Format card number for display (•••• 1234)
 */
export const formatCardDisplay = (cardType: string, lastFive: string): string => {
  return `${cardType} •••• ${lastFive}`;
};

/**
 * Validate card expiry date
 */
export const isCardExpired = (expiryMonth: string, expiryYear: string): boolean => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const expYear = parseInt(expiryYear.length === 2 ? `20${expiryYear}` : expiryYear);
  const expMonth = parseInt(expiryMonth);
  
  if (expYear < currentYear) return true;
  if (expYear === currentYear && expMonth < currentMonth) return true;
  
  return false;
};

/**
 * Format card expiry for display (MM/YY)
 */
export const formatCardExpiry = (month: string, year: string): string => {
  const formattedYear = year.length === 4 ? year.slice(-2) : year;
  return `${month.padStart(2, '0')}/${formattedYear.padStart(2, '0')}`;
};

/**
 * Validate card number using Luhn algorithm
 */
export const isValidCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

/**
 * Validate CVV
 */
export const isValidCVV = (cvv: string, cardType: string): boolean => {
  const cleaned = cvv.replace(/\D/g, '');
  if (cardType === 'Amex') {
    return /^\d{4}$/.test(cleaned);
  }
  return /^\d{3}$/.test(cleaned);
};
