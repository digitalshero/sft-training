import { Link } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Download, Play, FileText, ArrowRight } from "lucide-react";
import type {
  PartnerResource,
  PartnerVideo,
} from "@/lib/partner/partner.functions";

const FILE_TYPE_STYLE: Record<
  string,
  { icon: typeof FileText; bg: string; fg: string; label: string }
> = {
  pdf: { icon: FileText, bg: "bg-red-100", fg: "text-red-600", label: "PDF" },
  video: {
    icon: Play,
    bg: "bg-purple-100",
    fg: "text-purple-600",
    label: "Video",
  },
  sheet: {
    icon: FileText,
    bg: "bg-emerald-100",
    fg: "text-emerald-600",
    label: "Sheet",
  },
  file: {
    icon: FileText,
    bg: "bg-accent/15",
    fg: "text-accent",
    label: "File",
  },
};

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function fileTypeFor(kind: "file" | "video", path: string | null | undefined) {
  if (kind === "video") return FILE_TYPE_STYLE.video;
  const ext = (path ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return FILE_TYPE_STYLE.pdf;
  if (["xlsx", "xls", "csv"].includes(ext)) return FILE_TYPE_STYLE.sheet;
  return FILE_TYPE_STYLE.file;
}

export function DownloadsSection({
  resources,
  videos,
  loading,
}: {
  resources: PartnerResource[];
  videos: PartnerVideo[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (resources.length === 0 && videos.length === 0) return null;

  type Item = {
    id: string;
    title: string;
    url: string | null;
    kind: "file" | "video";
    path: string | null | undefined;
    subtitle?: string;
  };
  const items: Item[] = [
    ...resources.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.signed_url ?? null,
      kind: "file" as const,
      path: r.file_path,
    })),
    ...videos.map((v) => ({
      id: v.id,
      title: v.title,
      url: v.signed_url ?? null,
      kind: "video" as const,
      path: v.video_path ?? v.external_url ?? "",
      subtitle: v.description ?? undefined,
    })),
  ];

  return (
    <Card key="downloads">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Downloads & Resources
          </CardTitle>
          <CardDescription>
            Charts, references and videos shared by your trainer.
          </CardDescription>
        </div>
        <Link
          to="/partner/downloads"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          View all resources <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="divide-y divide-border rounded-md border border-border"
      >
        {items.map((it) => {
          const type = fileTypeFor(it.kind, it.path);
          const Icon = type.icon;
          return (
            <motion.a
              key={it.id}
              variants={rowVariants}
              whileHover={it.url ? { x: 2 } : undefined}
              href={it.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              download={it.kind === "file"}
              aria-disabled={!it.url}
              className={`flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/40 ${!it.url ? "pointer-events-none opacity-60" : ""}`}
            >
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${type.bg} ${type.fg}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{it.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {type.label}
                  {it.subtitle ? ` · ${it.subtitle}` : ""}
                </div>
              </div>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
                {it.kind === "video" ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </div>
            </motion.a>
          );
        })}
      </motion.div>
    </Card>
  );
}
