/**
 * Placeholder Accept.js integration
 * When API keys are added, this will tokenize cards client-side
 */

export interface CardData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface AcceptJsResponse {
  success: boolean;
  opaqueData?: {
    dataDescriptor: string;
    dataValue: string;
  };
  messages?: {
    resultCode: string;
    message: Array<{ code: string; text: string }>;
  };
}

/**
 * Placeholder tokenization (simulates Accept.js)
 * Replace with actual Accept.js when keys are available
 */
export const tokenizeCard = async (cardData: CardData): Promise<AcceptJsResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // TODO: Replace with actual Accept.js when API keys are available
  // const secureData = {
  //   authData: {
  //     clientKey: import.meta.env.VITE_AUTHORIZENET_PUBLIC_CLIENT_KEY,
  //     apiLoginID: import.meta.env.VITE_AUTHORIZENET_API_LOGIN_ID
  //   },
  //   cardData: {
  //     cardNumber: cardData.cardNumber,
  //     month: cardData.expiryMonth,
  //     year: cardData.expiryYear,
  //     cardCode: cardData.cvv
  //   }
  // };
  
  // return new Promise((resolve) => {
  //   (window as any).Accept.dispatchData(secureData, (response: any) => {
  //     resolve({
  //       success: response.messages.resultCode === "Ok",
  //       opaqueData: response.opaqueData,
  //       messages: response.messages
  //     });
  //   });
  // });
  
  // Placeholder: Return simulated nonce
  return {
    success: true,
    opaqueData: {
      dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
      dataValue: `placeholder_nonce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    messages: {
      resultCode: 'Ok',
      message: [{ code: 'I00001', text: 'Successful' }]
    }
  };
};

/**
 * Detect card type from card number (BIN lookup)
 * More permissive for test cards - allows any card starting with standard BINs
 */
export const detectCardType = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, '');
  
  // Test card patterns - be permissive
  if (/^4/.test(cleaned)) return 'Visa';
  if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
  if (/^2[2-7]/.test(cleaned)) return 'Mastercard'; // New Mastercard BINs
  if (/^3[47]/.test(cleaned)) return 'Amex';
  if (/^6(?:011|5|4[4-9]|22)/.test(cleaned)) return 'Discover';
  
  // For test cards without valid BIN, default to Visa
  if (cleaned.endsWith('0000') || cleaned.endsWith('1111')) {
    return 'Visa';
  }
  
  return 'Visa'; // Default to Visa for unknown cards to allow testing
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
  
  const expYear = parseInt(`20${expiryYear}`);
  const expMonth = parseInt(expiryMonth);
  
  if (expYear < currentYear) return true;
  if (expYear === currentYear && expMonth < currentMonth) return true;
  
  return false;
};

/**
 * Format card expiry for display (MM/YY)
 */
export const formatCardExpiry = (month: string, year: string): string => {
  return `${month.padStart(2, '0')}/${year.padStart(2, '0')}`;
};
