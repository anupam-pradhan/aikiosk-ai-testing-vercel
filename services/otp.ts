export async function sendSmsOtp(params: {
  phoneE164: string;
  domain: string;          // store domain
  otp: string;
}) {
  const token = (import.meta as any).env?.VITE_MEGAPOS_SMS_BEARER; // move token to env
  const res = await fetch("https://megapos.ltd.uk/twilio/sendsms.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      key: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: params.phoneE164,
      message: `Your MegaPOS code is ${params.otp}`,
      domain: params.domain,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success !== true) throw new Error(json?.error || "OTP_SEND_FAILED");
  return json;
}