import { useState, useRef } from "react";
import { uploadToStorage } from "@/lib/api/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  sendPartnerLoginLink,
  listAllPartnerResources,
  upsertPartnerResource,
  deletePartnerResource,
  listAllPartnerVideos,
  upsertPartnerVideo,
  deletePartnerVideo,
  createPartnerTask,
  deletePartnerTask,
  listInviteTasks,
  type PartnerResource,
  type PartnerTask,
  type PartnerVideo,
} from "@/lib/partner/partner.functions";
import {
  listAllInvites,
  getCourse,
  updateCourse,
  type Course,
  type PartnerInvite,
} from "@/lib/learning/learning.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Copy,
  FileUp,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Tag,
  Trash2,
  Video as VideoIcon,
  ClipboardList,
} from "lucide-react";

function useCategories(
  courseId: string,
  kind: "resource_categories" | "video_categories",
) {
  const qc = useQueryClient();
  const fnGet = getCourse;
  const fnUpdate = updateCourse;
  const q = useQuery({
    queryKey: ["lp-course", courseId],
    queryFn: () => fnGet({ course_id: courseId }),
  });
  const course = q.data?.course as Course | undefined;
  const cats: string[] = course?.[kind] ?? [];
  const save = useMutation({
    mutationFn: (next: string[]) => {
      const payload: Partial<Course> = { [kind]: next };
      return fnUpdate({ course_id: courseId, ...payload });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-course", courseId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return { cats, save };
}

function CategoryManager({
  courseId,
  kind,
  label,
}: {
  courseId: string;
  kind: "resource_categories" | "video_categories";
  label: string;
}) {
  const { cats, save } = useCategories(courseId, kind);
  const [next, setNext] = useState("");
  return (
    <div className="rounded-md border border-dashed border-border p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Tag className="h-3 w-3" /> {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {cats.length === 0 && (
          <span className="text-xs text-muted-foreground">
            No categories yet — add one below.
          </span>
        )}
        {cats.map((c) => (
          <Badge key={c} variant="secondary" className="gap-1">
            {c}
            <button
              type="button"
              className="ml-1 opacity-60 hover:opacity-100"
              onClick={() => save.mutate(cats.filter((x) => x !== c))}
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="e.g. Chart, Pre-Prep Video"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              next.trim() &&
              !cats.includes(next.trim())
            ) {
              save.mutate([...cats, next.trim()]);
              setNext("");
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={
            !next.trim() || cats.includes(next.trim()) || save.isPending
          }
          onClick={() => {
            save.mutate([...cats, next.trim()]);
            setNext("");
          }}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}

export function PartnerHubAdmin({ courseId }: { courseId: string }) {
  return (
    <div className="space-y-6">
      <SendLoginPanel courseId={courseId} />
      <TasksPanel courseId={courseId} />
      <ResourcesPanel courseId={courseId} />
      <VideosPanel courseId={courseId} />
    </div>
  );
}

// ---------- Send login link ----------
function SendLoginPanel({ courseId }: { courseId: string }) {
  const fnList = listAllInvites;
  const fnSend = sendPartnerLoginLink;
  const q = useQuery<PartnerInvite[]>({
    queryKey: ["lp-all-invites", courseId],
    queryFn: () => fnList(),
  });
  const send = useMutation({
    mutationFn: fnSend,
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.link);
      toast.success(`Invite email sent to ${data.email}; magic link copied`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Partner login links
        </CardTitle>
        <CardDescription>
          Generate a one-click magic link for a partner. They land on their
          Partner Hub already signed in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {q.data?.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            Invite partners first in the Invite tab.
          </div>
        )}
        {q.data
          ?.filter((i) => !i.revoked_at)
          .map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {inv.recipient_name}{" "}
                  <span className="text-muted-foreground">
                    · {inv.recipient_email}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {inv.user_id
                    ? "Linked to login account"
                    : "No login account yet"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={send.isPending}
                onClick={() => send.mutate({ invite_id: inv.id })}
              >
                {send.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Send email &amp; copy link
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

// ---------- Tasks ----------
function TasksPanel({ courseId }: { courseId: string }) {
  const fnInvites = listAllInvites;
  const invitesQ = useQuery<PartnerInvite[]>({
    queryKey: ["lp-all-invites", courseId],
    queryFn: () => fnInvites(),
  });
  const [selectedInvite, setSelectedInvite] = useState<string>("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Tasks (redo list / day's
          message)
        </CardTitle>
        <CardDescription>
          Push a task to a partner's dashboard. They see it the moment they open
          Partner Hub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Partner</Label>
          <select
            value={selectedInvite}
            onChange={(e) => setSelectedInvite(e.target.value)}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="">Pick a partner…</option>
            {(invitesQ.data ?? [])
              .filter((i) => !i.revoked_at)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.recipient_name} · {i.recipient_email}
                </option>
              ))}
          </select>
        </div>
        {selectedInvite && <TaskEditor inviteId={selectedInvite} />}
      </CardContent>
    </Card>
  );
}

function TaskEditor({ inviteId }: { inviteId: string }) {
  const qc = useQueryClient();
  const fnList = listInviteTasks;
  const fnCreate = createPartnerTask;
  const fnDelete = deletePartnerTask;
  const q = useQuery<PartnerTask[]>({
    queryKey: ["invite-tasks", inviteId],
    queryFn: () => fnList({ invite_id: inviteId }),
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: fnCreate,
    onSuccess: () => {
      toast.success("Task sent");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["invite-tasks", inviteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: fnDelete,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["invite-tasks", inviteId] }),
  });
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input
          placeholder="e.g. Redo dosa #2 photo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          disabled={!title || create.isPending}
          onClick={() =>
            create.mutate({ invite_id: inviteId, title, body: body || null })
          }
        >
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>
      <Textarea
        placeholder="Optional details / instructions"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="space-y-1">
        {q.data?.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            No tasks yet for this partner.
          </div>
        )}
        {q.data?.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
          >
            <Badge variant={t.status === "done" ? "default" : "outline"}>
              {t.status}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t.title}</div>
              {t.body && (
                <div className="text-xs text-muted-foreground">{t.body}</div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => del.mutate({ id: t.id })}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Resources ----------
export function ResourcesPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const fnList = listAllPartnerResources;
  const fnUpsert = upsertPartnerResource;
  const fnDel = deletePartnerResource;
  const q = useQuery<PartnerResource[]>({
    queryKey: ["admin-resources", courseId],
    queryFn: () => fnList({ course_id: courseId }),
  });
  const { cats } = useCategories(courseId, "resource_categories");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    file: null as File | null,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const upsert = useMutation({
    mutationFn: fnUpsert,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-resources", courseId] }),
  });
  const del = useMutation({
    mutationFn: fnDel,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-resources", courseId] }),
  });
  const [uploading, setUploading] = useState(false);

  const openDialog = () => {
    if (cats.length === 0) {
      toast.error("Create a category first");
      return;
    }
    setForm({ title: "", category: cats[0], file: null });
    setOpen(true);
  };

  const handleUpload = async () => {
    if (!form.file || !form.title || !form.category) return;
    setUploading(true);
    try {
      const safe = form.file.name.replace(/[^\w.-]+/g, "_");
      const path = `partner-resources/${courseId}/${Date.now()}-${safe}`;
      const uploadErr = await uploadToStorage("sft-decks", path, form.file);
      const error = uploadErr;
      if (error) throw error;
      await upsert.mutateAsync({
        course_id: courseId,
        title: form.title,
        category: form.category,
        file_path: path,
        bucket: "sft-decks",
        sort_order: 0,
      });
      toast.success("Resource added");
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const grouped = new Map<string, PartnerResource[]>();
  (q.data ?? []).forEach((r) => {
    const k = r.category || "Uncategorised";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Partner downloads
          </CardTitle>
          <CardDescription>
            Create categories first (e.g. Chart, Pre-Prep Video), then add items
            to each.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={openDialog}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add download</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                >
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title (e.g. CRC Chart)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">File</Label>
                <Input
                  type="file"
                  ref={fileRef}
                  onChange={(e) =>
                    setForm({ ...form, file: e.target.files?.[0] ?? null })
                  }
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={
                  !form.file || !form.title || !form.category || uploading
                }
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}{" "}
                Upload
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        <CategoryManager
          courseId={courseId}
          kind="resource_categories"
          label="Download categories"
        />
        {grouped.size === 0 && (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No downloads added yet.
          </div>
        )}
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat} className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {cat}
            </div>
            {items.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-md border border-border p-2 text-sm"
              >
                <div className="min-w-0 flex-1 truncate font-medium">
                  {r.title}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => del.mutate({ id: r.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------- Videos ----------
export function VideosPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const fnList = listAllPartnerVideos;
  const fnUpsert = upsertPartnerVideo;
  const fnDel = deletePartnerVideo;
  const q = useQuery<PartnerVideo[]>({
    queryKey: ["admin-videos", courseId],
    queryFn: () => fnList({ course_id: courseId }),
  });
  const { cats } = useCategories(courseId, "video_categories");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("link");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    url: "",
    file: null as File | null,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const upsert = useMutation({
    mutationFn: fnUpsert,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-videos", courseId] }),
  });
  const del = useMutation({
    mutationFn: fnDel,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-videos", courseId] }),
  });
  const [busy, setBusy] = useState(false);

  const openDialog = () => {
    if (cats.length === 0) {
      toast.error("Create a video category first");
      return;
    }
    setForm({
      title: "",
      description: "",
      category: cats[0],
      url: "",
      file: null,
    });
    setMode("link");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.category) return;
    setBusy(true);
    try {
      if (mode === "file") {
        if (!form.file) return;
        const safe = form.file.name.replace(/[^\w.-]+/g, "_");
        const path = `partner-videos/${courseId}/${Date.now()}-${safe}`;
        const uploadErr = await uploadToStorage("sft-videos", path, form.file);
        const error = uploadErr;
        if (error) throw error;
        await upsert.mutateAsync({
          course_id: courseId,
          title: form.title,
          description: form.description || null,
          category: form.category,
          video_path: path,
          bucket: "sft-videos",
          sort_order: 0,
        });
      } else {
        if (!form.url.trim()) return;
        await upsert.mutateAsync({
          course_id: courseId,
          title: form.title,
          description: form.description || null,
          category: form.category,
          external_url: form.url.trim(),
          bucket: "sft-videos",
          sort_order: 0,
        });
      }
      toast.success("Video added");
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const grouped = new Map<string, PartnerVideo[]>();
  (q.data ?? []).forEach((v) => {
    const k = v.category || "Uncategorised";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(v);
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <VideoIcon className="h-4 w-4" /> Video library
          </CardTitle>
          <CardDescription>
            Create categories first (e.g. OTM Base, Pre-Prep Video), then upload
            a file or paste a video link.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={openDialog}>
            <Plus className="h-4 w-4" /> Add video
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add video</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "link" ? "default" : "outline"}
                  onClick={() => setMode("link")}
                >
                  <Link2 className="h-3 w-3" /> Paste link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "file" ? "default" : "outline"}
                  onClick={() => setMode("file")}
                >
                  <FileUp className="h-3 w-3" /> Upload file
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                >
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              {mode === "link" ? (
                <div className="space-y-1">
                  <Label className="text-xs">
                    Video link (YouTube, Vimeo, .mp4 URL…)
                  </Label>
                  <Input
                    type="url"
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Video file</Label>
                  <Input
                    type="file"
                    accept="video/*"
                    ref={fileRef}
                    onChange={(e) =>
                      setForm({ ...form, file: e.target.files?.[0] ?? null })
                    }
                  />
                </div>
              )}
              <Button
                onClick={handleSubmit}
                disabled={
                  busy ||
                  !form.title ||
                  !form.category ||
                  (mode === "file" ? !form.file : !form.url.trim())
                }
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "link" ? (
                  <Link2 className="h-4 w-4" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}{" "}
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        <CategoryManager
          courseId={courseId}
          kind="video_categories"
          label="Video categories"
        />
        {grouped.size === 0 && (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No videos added yet.
          </div>
        )}
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat} className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {cat}
            </div>
            {items.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-md border border-border p-2 text-sm"
              >
                {v.external_url ? (
                  <Badge variant="outline">
                    <Link2 className="mr-1 h-3 w-3" /> Link
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <FileUp className="mr-1 h-3 w-3" /> File
                  </Badge>
                )}
                <div className="min-w-0 flex-1 truncate font-medium">
                  {v.title}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => del.mutate({ id: v.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
