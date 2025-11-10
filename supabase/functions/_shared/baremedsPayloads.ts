/**
 * Standardized BareMeds API payload builders
 * Ensures consistent payload structure across all BareMeds API calls
 */

export interface BaremedsPrescriptionPayload {
  site_id?: string;
  patient: {
    patient_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
    phone: string;
    email: string;
    address: {
      line1: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  prescriber: {
    npi: string;
    first_name: string;
    last_name: string;
    dea?: string;
  };
  medication: {
    name: string;
    strength: string;
    quantity: number;
    directions: string;
    refills: number;
  };
  shipping: {
    method: string;
    address: {
      line1: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  external_order_id: string;
  notes?: string;
}

/**
 * Creates a test order payload for API validation
 * DO NOT PROCESS - For testing pharmacy API connectivity only
 */
export function createTestOrderPayload(siteId?: string): BaremedsPrescriptionPayload {
  const testPatientId = `TEST-PAT-${Date.now()}`;
  
  return {
    ...(siteId ? { site_id: String(siteId) } : {}),
    patient: {
      patient_id: testPatientId,
      first_name: "Test",
      last_name: "Patient (Do Not Process)",
      date_of_birth: "1990-01-01",
      gender: "M",
      phone: "5550100",
      email: "test@example.com",
      address: {
        line1: "123 Test Street",
        city: "Test City",
        state: "CA",
        zip: "90001"
      }
    },
    prescriber: {
      npi: "1234567890",
      first_name: "Test",
      last_name: "Provider",
      dea: "AT1234567"
    },
    medication: {
      name: "TEST PRODUCT - PLEASE IGNORE",
      strength: "1mg",
      quantity: 1,
      directions: "Test instructions - DO NOT PROCESS THIS ORDER",
      refills: 0
    },
    shipping: {
      method: "Ground",
      address: {
        line1: "123 Test Street",
        city: "Test City",
        state: "CA",
        zip: "90001"
      }
    },
    external_order_id: `TEST-${Date.now()}`,
    notes: "THIS IS A TEST ORDER - DO NOT FULFILL. Sent via API configuration test."
  };
}

/**
 * Creates a production order payload from order data
 */
export function createProductionOrderPayload(
  orderData: any,
  orderLineData: any,
  siteId?: string
): BaremedsPrescriptionPayload {
  return {
    ...(siteId ? { site_id: String(siteId) } : {}),
    patient: {
      patient_id: orderData.patient_id || orderData.id,
      first_name: orderData.patient_first_name || "Unknown",
      last_name: orderData.patient_last_name || "Patient",
      date_of_birth: orderData.patient_dob || "1990-01-01",
      gender: orderData.patient_gender || "U",
      phone: orderData.shipping_phone || orderData.patient_phone || "5550100",
      email: orderData.patient_email || "noreply@example.com",
      address: {
        line1: orderData.shipping_address_line1 || "",
        city: orderData.shipping_city || "",
        state: orderData.shipping_state || "",
        zip: orderData.shipping_zip || ""
      }
    },
    prescriber: {
      npi: orderData.prescriber_npi || "",
      first_name: orderData.prescriber_first_name || "Unknown",
      last_name: orderData.prescriber_last_name || "Provider",
      dea: orderData.prescriber_dea
    },
    medication: {
      name: orderLineData.product_name || "Unknown Medication",
      strength: orderLineData.product_strength || "",
      quantity: orderLineData.quantity || 1,
      directions: orderLineData.directions || "As directed",
      refills: orderLineData.refills || 0
    },
    shipping: {
      method: orderData.shipping_method || "Ground",
      address: {
        line1: orderData.shipping_address_line1 || "",
        city: orderData.shipping_city || "",
        state: orderData.shipping_state || "",
        zip: orderData.shipping_zip || ""
      }
    },
    external_order_id: orderData.order_number || orderData.id,
    notes: orderData.order_notes
  };
}
