// Catalog of permission keys used across the app.
// `super_admin` users implicitly have everything (see has_permission() SQL).
export const PERMISSION_GROUPS: {
  group: string;
  items: { key: string; label: string; description: string }[];
}[] = [
  {
    group: "SFT Training",
    items: [
      {
        key: "sft_course_builder",
        label: "Course Builder",
        description: "Create & edit courses, modules, slide decks, quizzes, and other course data",
      },
      {
        key: "sft_invite_certify",
        label: "Invite & Certify",
        description: "Send partner invites and issue/revoke certificates",
      },
      {
        key: "sft_review",
        label: "SFT Review",
        description: "Review partner training submissions",
      },
      {
        key: "sft_physical_visit",
        label: "Physical Visit",
        description: "Track and manage physical kitchen visits",
      },
      {
        key: "sft_partner_payments",
        label: "Partner Payments",
        description: "Review payment records, accept/reject partner onboarding, and send invites",
      },
    ],
  },
  {
    group: "Food Cost",
    items: [
      {
        key: "foodcost_dashboard",
        label: "Food Cost Dashboard",
        description: "Cross-country overview",
      },
      {
        key: "foodcost_in",
        label: "India (INR) — all pages",
        description: "Brand master, menu costing, reports, audit",
      },
      {
        key: "foodcost_us",
        label: "USA (USD) — all pages",
        description: "Brand master, menu costing, reports, audit",
      },
    ],
  },
  {
    group: "Other",
    items: [{ key: "team_guide", label: "Team Guide", description: "Internal documentation" }],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
export type PermissionKey = string;
