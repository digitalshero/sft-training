import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  visitDate?: string;
  visitTime?: string;
  recipeName?: string;
}

const Email = ({ recipientName, visitDate, visitTime, recipeName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Shero physical kitchen visit has been rescheduled</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Physical Visit Rescheduled</Heading>
        <Text style={text}>Hi {recipientName ?? "there"},</Text>
        <Text style={text}>
          The physical kitchen visit has been rescheduled. Please make a note of the new date and
          time below.
        </Text>
        <Section style={box}>
          <Text style={row}>
            <strong>Recipe:</strong> {recipeName ?? "—"}
          </Text>
          <Text style={row}>
            <strong>New Visit Date:</strong> {visitDate ?? "—"}
          </Text>
          <Text style={row}>
            <strong>New Visit Time:</strong> {visitTime ?? "—"}
          </Text>
        </Section>
        <Text style={text}>— Shero Home Food</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your Shero physical kitchen visit has been rescheduled",
  displayName: "Physical Visit — Rescheduled",
  previewData: {
    recipientName: "Priya",
    recipeName: "Sambar",
    visitDate: "2026-07-03",
    visitTime: "10:30",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px", margin: "0 auto" };
const h1 = { color: "#0d9488", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const row = { color: "#374151", fontSize: "15px", lineHeight: "22px", margin: "4px 0" };
const box = {
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
};
