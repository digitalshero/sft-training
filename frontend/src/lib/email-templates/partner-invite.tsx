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
  recipientName?: string;
  courseTitle?: string;
  loginUrl: string;
  bodyHtml?: string;
}

const Email = ({ recipientName, courseTitle, loginUrl, bodyHtml }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {courseTitle
        ? `Your access to ${courseTitle} is ready`
        : "Your Shero training access is ready"}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Shero Training</Heading>
        {bodyHtml ? (
          <div style={text} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <>
            <Text style={text}>{recipientName ? `Hi ${recipientName},` : "Hi there,"}</Text>
            <Text style={text}>
              {courseTitle
                ? `You've been invited to access "${courseTitle}" on the Shero partner hub.`
                : `You've been invited to access the Shero partner hub.`}{" "}
              Click the button below to securely sign in — no password needed.
            </Text>
          </>
        )}
        <Section style={{ textAlign: "center", margin: "32px 0" }}>
          <Button href={loginUrl} style={button}>
            Open Partner Hub
          </Button>
        </Section>
        <Text style={muted}>
          Or paste this link into your browser:
          <br />
          <Link href={loginUrl} style={link}>
            {loginUrl}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={muted}>
          This link will sign you in directly. If you didn't expect this email, you can safely
          ignore it.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: ({ courseTitle }: { courseTitle?: string }) =>
    courseTitle ? `Your access to ${courseTitle} is ready` : "Your Shero training access is ready",
  displayName: "Partner Invite",
  previewData: {
    recipientName: "Jane",
    courseTitle: "Knife Skills 101",
    loginUrl: "${process.env.PUBLIC_SITE_URL || 'https://training.shero.in'}/partner",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px", margin: "0 auto" };
const h1 = { color: "#111827", fontSize: "24px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", margin: "0 0 14px" };
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px", margin: "0 0 10px" };
const link = { color: "#0d9488", wordBreak: "break-all" as const };
const button = {
  backgroundColor: "#0d9488",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
};
const hr = { borderColor: "#e5e7eb", margin: "28px 0" };
