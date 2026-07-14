import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { StageShell } from "@/components/partner/stage-shell";
import {
  listPartnerResources,
  listPartnerVideos,
} from "@/lib/partner/partner.functions";
import { formatDateET } from "@/lib/datetime-et";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Award,
  Download,
  FileText,
  Loader2,
  Play,
  PlayCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadCertificatePdf } from "@/lib/partner/certificate-pdf";
import { downloadComposedCertificate } from "@/lib/partner/certificate-design";
import type {
  PartnerInviteSummary,
  PartnerDashboard,
  PartnerCertificate,
  PartnerExtraCertificate,
} from "@/lib/partner/partner.functions";

async function downloadCertificateFor(
  c: PartnerCertificate | PartnerExtraCertificate,
  recipientName: string,
  title?: string,
) {
  if (c.design?.background_path) {
    try {
      await downloadComposedCertificate(
        c.design,
        { partner_name: recipientName, certificate_id: c.code, date: formatDateET(c.issued_at) },
        `certificate-${c.code}`,
      );
      return;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to render certificate");
      return;
    }
  }
  downloadCertificatePdf({
    course_title: c.course_title,
    code: c.code,
    issued_at: c.issued_at,
    recipient_name: recipientName,
    title,
  });
}

export const Route = createFileRoute("/_authenticated/partner/downloads")({
  component: () => (
    <StageShell
      stage="downloads"
      title="Download"
      subtitle="Your resources and certificates in one place."
    >
      {({ invite, data }) => <DownloadsTabs invite={invite} data={data} />}
    </StageShell>
  ),
});

function DownloadsTabs({
  invite,
  data,
}: {
  invite: PartnerInviteSummary;
  data: PartnerDashboard;
}) {
  return (
    <Tabs defaultValue="resources" className="space-y-4">
      <TabsList>
        <TabsTrigger value="resources">
          <FileText className="h-3 w-3" /> My Resources
        </TabsTrigger>
        <TabsTrigger value="certificate">
          <Award className="h-3 w-3" /> My Certificate
        </TabsTrigger>
      </TabsList>
      <TabsContent value="resources">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <ResourcesBody courseId={invite.course_id} />
        </motion.div>
      </TabsContent>
      <TabsContent value="certificate">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <CertificateBody invite={invite} data={data} />
        </motion.div>
      </TabsContent>
    </Tabs>
  );
}

function ResourcesBody({ courseId }: { courseId: string }) {
  const fnR = listPartnerResources;
  const fnV = listPartnerVideos;
  const resQ = useQuery({
    queryKey: ["partner-resources", courseId],
    queryFn: () => fnR({ course_id: courseId }),
  });
  const vidQ = useQuery({
    queryKey: ["partner-videos", courseId],
    queryFn: () => fnV({ course_id: courseId }),
  });
  const [playing, setPlaying] = useState<string | null>(null);

  if (resQ.isLoading || vidQ.isLoading)
    return <Loader2 className="h-5 w-5 animate-spin text-accent" />;

  const resources = resQ.data ?? [];
  const videos = vidQ.data ?? [];

  const resByCat = new Map<string, typeof resources>();
  for (const r of resources) {
    const k = r.category || "General";
    if (!resByCat.has(k)) resByCat.set(k, []);
    resByCat.get(k)!.push(r);
  }
  const vidByCat = new Map<string, typeof videos>();
  for (const v of videos) {
    const k = v.category || "Videos";
    if (!vidByCat.has(k)) vidByCat.set(k, []);
    vidByCat.get(k)!.push(v);
  }

  return (
    <div className="space-y-6">
      {resources.length === 0 && videos.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-xs text-muted-foreground">
            Your trainer hasn&apos;t shared any files or videos yet.
          </CardContent>
        </Card>
      )}

      {Array.from(resByCat.entries()).map(([cat, items]) => (
        <Card key={`r-${cat}`}>
          <CardHeader>
            <CardTitle className="text-base">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((r) => (
              <motion.div
                key={r.id}
                whileHover={{ y: -2 }}
                className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 truncate font-medium text-sm">
                  {r.title}
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  disabled={!r.signed_url}
                >
                  <a
                    href={r.signed_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    download
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                </Button>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      ))}

      {Array.from(vidByCat.entries()).map(([cat, items]) => (
        <Card key={`v-${cat}`} className="overflow-hidden rounded-3xl border border-white/40 bg-white/60 shadow-lg backdrop-blur-xl">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-base capitalize text-primary">{cat}</CardTitle>
            <CardDescription>Watch trainer-shared videos.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((v) => (
                <motion.div key={v.id} whileHover={{ y: -4 }} className="group flex flex-col rounded-2xl border border-white/40 bg-white/80 p-4 shadow-sm backdrop-blur-md transition-all hover:border-primary/30 hover:shadow-lg">
                  <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-muted relative">
                    {playing === v.id && v.signed_url ? (
                      <video
                        src={v.signed_url}
                        controls
                        autoPlay
                        className="h-full w-full"
                      />
                    ) : v.thumbnail_url ? (
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Play className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mb-2 text-sm font-medium">{v.title}</div>
                  {v.description && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      {v.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlaying(v.id)}
                      disabled={!v.signed_url}
                    >
                      <Play className="h-3 w-3" /> Play
                    </Button>
                    {v.signed_url && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={v.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          download
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CertificateBody({
  invite,
  data,
}: {
  invite: PartnerInviteSummary;
  data: PartnerDashboard;
}) {
  const certs = data.certificates.filter(
    (c) => c.course_id === invite.course_id,
  );
  const extraCerts = (data.extra_certificates ?? []).filter(
    (c) => c.course_id === invite.course_id,
  );
  if (certs.length === 0 && extraCerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Your certificate will appear here once your trainer issues it.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {extraCerts.map((c) => (
        <motion.div key={c.id} whileHover={{ y: -2 }} className="transition-transform">
          <Card className="overflow-hidden rounded-3xl border border-white/40 bg-white/60 shadow-lg backdrop-blur-xl transition-shadow hover:shadow-xl">
            <CardHeader className="bg-shero-gold/10">
              <CardTitle className="flex items-center gap-2 text-base text-shero-gold">
                <Award className="h-5 w-5" /> {c.title}
              </CardTitle>
              <CardDescription>
                Certificate ID {c.code} · Issued {formatDateET(c.issued_at)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 pt-5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadCertificateFor(c, invite.recipient_name, c.title)}
              >
                <Download className="h-4 w-4" /> Download
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
      {certs.map((c) => (
        <motion.div key={c.id} whileHover={{ y: -2 }} className="transition-transform">
          <Card className="overflow-hidden rounded-3xl border border-white/40 bg-white/60 shadow-lg backdrop-blur-xl transition-shadow hover:shadow-xl">
            <CardHeader className="bg-shero-gold/10">
              <CardTitle className="flex items-center gap-2 text-base text-shero-gold">
                <Award className="h-5 w-5" /> {c.course_title}
              </CardTitle>
              <CardDescription>
                Code {c.code} · Issued{" "}
                {formatDateET(c.issued_at)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 pt-5">
            <Button asChild size="sm">
              <Link to="/learn/$courseId" params={{ courseId: c.course_id }}>
                <PlayCircle className="h-4 w-4" /> Open course
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCertificateFor(c, invite.recipient_name)}
            >
              <Download className="h-4 w-4" /> Download
            </Button>
          </CardContent>
        </Card>
        </motion.div>
      ))}
    </div>
  );
}
