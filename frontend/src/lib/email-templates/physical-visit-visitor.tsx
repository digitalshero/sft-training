import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  visitorName?: string;
  partnerName?: string;
  partnerEmail?: string;
  partnerPhone?: string;
  partnerAddress?: string;
  partnerLocation?: string;
  partnerState?: string;
  partnerCountry?: string;
  cuisineName?: string;
  assignedProducts?: string[];
  visitDate?: string;
  visitTime?: string;
  remarks?: string;
  portalUrl: string;
}

const Email = ({
  visitorName,
  partnerName,
  partnerEmail,
  partnerPhone,
  partnerAddress,
  partnerLocation,
  partnerState,
  partnerCountry,
  cuisineName,
  assignedProducts = [],
  visitDate,
  visitTime,
  remarks,
  portalUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Physical Kitchen Visit Assigned — Shero Home Food</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Physical Kitchen Visit Assigned</Heading>
        <Text style={text}>Hi {visitorName ?? "there"},</Text>
        <Text style={text}>
          You have been assigned to inspect a Shero Home Food partner kitchen. Please review the
          details below and complete the inspection through the Visitor Portal.
        </Text>

        <Section style={box}>
          <Heading as="h3" style={h3}>
            Partner Details
          </Heading>
          <Row label="Name" value={partnerName ?? "—"} />
          <Row label="Email" value={partnerEmail ?? "—"} />
          <Row label="Phone" value={partnerPhone ?? "—"} />
          <Row label="Address" value={partnerAddress ?? partnerLocation ?? "—"} />
          <Row label="State" value={partnerState ?? "—"} />
          <Row label="Country" value={partnerCountry ?? "—"} />
        </Section>

        <Section style={box}>
          <Heading as="h3" style={h3}>
            Assigned Cooking
          </Heading>
          <Row label="Cuisine" value={cuisineName ?? "—"} />
          <Text style={{ ...text, margin: "8px 0 4px" }}>
            <strong>Assigned Products:</strong>
          </Text>
          {assignedProducts.length === 0 ? (
            <Text style={text}>—</Text>
          ) : (
            <ul style={{ margin: "4px 0 0 20px", padding: 0, color: "#374151" }}>
              {assignedProducts.map((p) => (
                <li key={p} style={{ marginBottom: 4 }}>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section style={box}>
          <Heading as="h3" style={h3}>
            Visit Details
          </Heading>
          <Row label="Visit Date" value={visitDate ?? "—"} />
          <Row label="Visit Time" value={visitTime ?? "—"} />
          {remarks ? <Row label="Remarks" value={remarks} /> : null}
        </Section>

        <Section style={{ textAlign: "center", margin: "28px 0" }}>
          <Button href={portalUrl} style={button}>
            Start Physical Visit
          </Button>
        </Section>
        <Text style={muted}>
          Or open this link:
          <br />
          <Link href={portalUrl} style={link}>
            {portalUrl}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={muted}>Thank you for supporting Shero Home Food quality standards.</Text>
      </Container>
    </Body>
  </Html>
);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ ...text, margin: "4px 0" }}>
      <strong>{label}:</strong> {value}
    </Text>
  );
}

export const template = {
  component: Email,
  subject: "Physical Kitchen Visit Assigned – Shero Home Food",
  displayName: "Physical Visit — Visitor",
  previewData: {
    visitorName: "Anita",
    partnerName: "Priya",
    partnerEmail: "priya@example.com",
    partnerPhone: "+91 98765 43210",
    partnerAddress: "12 Anna Salai",
    partnerLocation: "Chennai",
    partnerState: "Tamil Nadu",
    partnerCountry: "India",
    cuisineName: "Tamil Nadu",
    assignedProducts: ["Rasam", "Sambar", "Poriyal"],
    visitDate: "2026-07-01",
    visitTime: "11:00",
    remarks: "Arrive 15 min before cooking time.",
    portalUrl:
      "${process.env.PUBLIC_SITE_URL || 'https://training.shero.in'}/visitor/physical-visit?token=abc",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "600px", margin: "0 auto" };
const h1 = { color: "#0d9488", fontSize: "24px", fontWeight: 700, margin: "0 0 16px" };
const h3 = { color: "#0d9488", fontSize: "15px", fontWeight: 700, margin: "0 0 8px" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px", margin: "0 0 10px" };
const link = { color: "#0d9488", wordBreak: "break-all" as const };
const box = {
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "8px",
  padding: "14px 18px",
  margin: "16px 0",
};
const button = {
  backgroundColor: "#0d9488",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
};
const hr = { borderColor: "#e5e7eb", margin: "28px 0" };
