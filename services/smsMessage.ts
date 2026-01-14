// src/services/smsMessage.ts
export async function sendSmsMessage(params: {
  phoneE164: string;
  domain: string;     // store domain/name
  message: string;
}) {
  const token = (import.meta as any).env?.VITE_MEGAPOS_SMS_BEARER;
  const res = await fetch("https://megapos.ltd.uk/twilio/sendsms.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      key: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: params.phoneE164,
      message: params.message,
      domain: params.domain,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success !== true) {
    throw new Error(json?.error || "SMS_SEND_FAILED");
  }
  return json;
}