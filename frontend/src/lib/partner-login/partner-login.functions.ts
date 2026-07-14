import api from "@/lib/api/client";

export const requestPartnerOtp = (d: { email: string }) =>
  api.post("/partner-login/request-otp", d).then((r) => r.data);

export const resendPartnerOtp = (d: { email: string }) =>
  api.post("/partner-login/resend-otp", d).then((r) => r.data);

export const verifyPartnerOtp = (d: { email: string; otp: string }) =>
  api
    .post<{ access_token: string; refresh_token: string }>(
      "/partner-login/verify-otp",
      d,
    )
    .then((r) => r.data);
