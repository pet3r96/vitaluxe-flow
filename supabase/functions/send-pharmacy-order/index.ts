import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PharmacyOrderRequest {
  order_id: string;
  pharmacy_email: string;
  pharmacy_name: string;
  payment_status: string;
  site_id?: string;
}

interface BareMedsAuthResponse {
  token: string;
  expiresIn?: number;
}

type JsonLike = Record<string, unknown>;

const TEST_PHARMACY_EMAIL = "dsporn00@yahoo.com";
const TEST_PHARMACY_NAME = "Demo Pharmacy 1";
const BAREMEDS_AUTH_URL = "https://staging-rxorders.baremeds.com/api/auth/login";
const BAREMEDS_ORDERS_URL = `https://staging-rxorders.baremeds.com/api/v1/rx-orders/${Deno.env.get("BAREMEDS_SITE_ID")}`;

function sanitizeForLog(data: unknown): unknown {
  if (data === null || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLog(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowered = key.toLowerCase();
    if (lowered.includes("token") || lowered.includes("password")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function logSanitized(label: string, payload: unknown) {
  console.log(`${label}:`, JSON.stringify(sanitizeForLog(payload)));
}

function getEnvOrThrow(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: PharmacyOrderRequest;
  try {
    payload = (await req.json()) as PharmacyOrderRequest;
  } catch (error) {
    console.error("Failed to parse request body", error);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  logSanitized("Received request", payload);

  const { order_id, pharmacy_email, pharmacy_name, payment_status, site_id } = payload;

  if (!order_id || typeof order_id !== "string") {
    return new Response(JSON.stringify({ error: "order_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isPaid = payment_status === "paid";
  const isTestPharmacy =
    pharmacy_email.toLowerCase() === TEST_PHARMACY_EMAIL.toLowerCase() && 
    pharmacy_name === TEST_PHARMACY_NAME;

  if (!isPaid || !isTestPharmacy) {
    const reason = !isPaid
      ? "payment_status is not paid"
      : "pharmacy does not match the allowed test pharmacy";
    logSanitized("Skipping request", { order_id, reason });
    return new Response(
      JSON.stringify({
        success: true,
        sent: false,
        reason,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const bareMedsEmail = getEnvOrThrow("BAREMEDS_EMAIL");
    const bareMedsPassword = getEnvOrThrow("BAREMEDS_PASSWORD");
    const bareMedsSiteId = getEnvOrThrow("BAREMEDS_SITE_ID");

    const authBody = {
      email: bareMedsEmail,
      password: bareMedsPassword,
      site_id: bareMedsSiteId,
    };

    logSanitized("Authenticating with BareMeds", {
      email: authBody.email,
      site_id: authBody.site_id,
    });

    const authResponse = await fetch(BAREMEDS_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authBody),
    });

    let authJson: BareMedsAuthResponse | JsonLike | null = null;
    try {
      authJson = (await authResponse.json()) as BareMedsAuthResponse | JsonLike;
    } catch {
      authJson = null;
    }

    logSanitized("BareMeds auth response", {
      status: authResponse.status,
      body: authJson,
    });

    if (!authResponse.ok || !authJson || typeof authJson !== "object") {
      throw new Error(
        `BareMeds authentication failed (${authResponse.status}): ${
          authJson ? JSON.stringify(sanitizeForLog(authJson)) : "No response body"
        }`
      );
    }

    // BareMeds returns token in data.token, not directly in response
    const token = (authJson as any)?.data?.token || (authJson as BareMedsAuthResponse).token;
    if (!token) {
      throw new Error("BareMeds authentication succeeded without a token");
    }

    const orderPayload = {
      site_id: site_id || bareMedsSiteId,
      external_order_id: order_id,
      patient: {
        first_name: "Test",
        last_name: "Patient",
        dob: "1990-01-01",
        gender: "M",
        phone: "555-123-4567",
        email: "test@example.com",
        address: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zip: "10001",
        },
      },
      prescriber: {
        first_name: "John",
        last_name: "Doe",
        npi: "1234567890",
      },
      medication: {
        name: "Amoxicillin",
        strength: "500mg",
        quantity: 30,
        instructions: "Take one tablet twice a day",
      },
      shipping: {
        method: "standard",
      },
      dry_run: true,
      dryRun: true,
    };

    logSanitized("Sending BareMeds order payload", orderPayload);

    const orderResponse = await fetch(BAREMEDS_ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    // Clone response before reading to allow fallback to text if JSON parsing fails
    const orderResponseClone = orderResponse.clone();
    let orderJson: JsonLike | null = null;
    try {
      orderJson = (await orderResponse.json()) as JsonLike;
    } catch {
      const text = await orderResponseClone.text();
      orderJson = { message: text };
    }

    logSanitized("BareMeds order response", {
      status: orderResponse.status,
      body: orderJson,
    });

    if (!orderResponse.ok) {
      throw new Error(
        `BareMeds order creation failed (${orderResponse.status}): ${JSON.stringify(
          sanitizeForLog(orderJson)
        )}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        response: orderJson,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-pharmacy-order:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        sent: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

