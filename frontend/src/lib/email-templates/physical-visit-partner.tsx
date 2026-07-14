import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  partnerName?: string;
  visitorName?: string;
  recipeName?: string;
  visitDate?: string;
  visitTime?: string;
}

const Email = ({ partnerName, visitorName, recipeName, visitDate, visitTime }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Physical Kitchen Visit has been scheduled</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your Physical Kitchen Visit Has Been Scheduled</Heading>
        <Text style={text}>Hi {partnerName ?? "there"},</Text>
        <Text style={text}>
          Congratulations! Your Learn &amp; Cook submission has been approved. Your physical kitchen
          visit has been scheduled. Please get ready with your assigned dish before the visitor
          arrives.
        </Text>
        <Section style={box}>
          <Text style={row}>
            <strong>Visitor:</strong> {visitorName ?? "—"}
          </Text>
          <Text style={row}>
            <strong>Assigned Recipe:</strong> {recipeName ?? "—"}
          </Text>
          <Text style={row}>
            <strong>Visit Date:</strong> {visitDate ?? "—"}
          </Text>
          <Text style={row}>
            <strong>Visit Time:</strong> {visitTime ?? "—"}
          </Text>
        </Section>
        <Text style={text}>
          Ensure your kitchen is clean and ready for inspection. Keep all ingredients and equipment
          for the assigned recipe prepared.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>— Shero Home Food</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your Physical Kitchen Visit Has Been Scheduled",
  displayName: "Physical Visit — Partner",
  previewData: {
    partnerName: "Priya",
    visitorName: "Anita",
    recipeName: "Sambar",
    visitDate: "2026-07-01",
    visitTime: "11:00",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px", margin: "0 auto" };
const h1 = { color: "#0d9488", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px", margin: "0 0 10px" };
const row = { color: "#374151", fontSize: "15px", lineHeight: "22px", margin: "4px 0" };
const box = {
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
};
const hr = { borderColor: "#e5e7eb", margin: "28px 0" };
