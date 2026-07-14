import type { ComponentType } from "react";
import { template as partnerInviteTemplate } from "./partner-invite";
import { template as pvVisitorTemplate } from "./physical-visit-visitor";
import { template as pvPartnerTemplate } from "./physical-visit-partner";
import { template as pvRescheduledTemplate } from "./physical-visit-rescheduled";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  "partner-invite": partnerInviteTemplate,
  "physical-visit-visitor": pvVisitorTemplate,
  "physical-visit-partner": pvPartnerTemplate,
  "physical-visit-rescheduled": pvRescheduledTemplate,
};
