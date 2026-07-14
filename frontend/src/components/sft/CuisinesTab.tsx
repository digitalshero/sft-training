import { useState } from "react";
import {
  uploadToStorage,
  getSignedUrl,
  uploadImageAndGetPath,
} from "@/lib/api/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { updateCourse } from "@/lib/learning/learning.functions";
import {
  listCuisines,
  upsertCuisine,
  deleteCuisine,
  type Cuisine,
} from "@/lib/learning/cuisines.functions";
import {
  listRecipesByCuisine,
  upsertCuisineRecipe,
  getSampleImageGuide,
  upsertSampleImageGuide,
  type Recipe as CuisineRecipe,
} from "@/lib/learning/recipes.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChefHat,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UtensilsCrossed,
  ImageIcon,
} from "lucide-react";

type Course = { id: string; title: string; max_cuisines?: number | null };

export function CuisinesTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fnList = listCuisines;
  const fnUpsert = upsertCuisine;
  const fnDelete = deleteCuisine;
  const [editing, setEditing] = useState<Cuisine | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["lp-cuisines", course.id],
    queryFn: () => fnList({ course_id: course.id }),
  });

  const upsert = useMutation({
    mutationFn: (p: {
      id?: string;
      course_id: string;
      name: string;
      sort_order: number;
      show_count: number;
      active: boolean;
    }) => fnUpsert(p),
    onSuccess: () => {
      toast.success("Cuisine saved");
      qc.invalidateQueries({ queryKey: ["lp-cuisines", course.id] });
      setAdding(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fnDelete({ id }),
    onSuccess: () => {
      toast.success("Cuisine deleted");
      qc.invalidateQueries({ queryKey: ["lp-cuisines", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <MaxCuisinesCard course={course} />
      <SampleImageGuideCard courseId={course.id} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" /> Cuisines & Products
              </CardTitle>
              <CardDescription>
                Group cooking products under cuisines. Each cuisine controls how
                many products partners are asked to cook.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Cuisine
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No cuisines yet. Add one to start.
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {q.data!.map((c) => (
                <AccordionItem
                  key={c.id}
                  value={c.id}
                  className="rounded-lg border border-border px-3"
                >
                  <div className="flex items-center gap-3">
                    <AccordionTrigger className="flex-1 hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        <ChefHat className="h-4 w-4 text-primary" />
                        <span className="font-medium">{c.name}</span>
                        <Badge variant="outline" className="ml-1">
                          Show {c.show_count === 0 ? "all" : c.show_count}
                        </Badge>
                        {!c.active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(c);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete cuisine "${c.name}"?`))
                          del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <AccordionContent>
                    <CuisineRecipesEditor course={course} cuisine={c} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <CuisineDialog
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        initial={editing}
        onSave={(payload) =>
          upsert.mutate({ course_id: course.id, ...payload })
        }
        saving={upsert.isPending}
      />
    </div>
  );
}

function MaxCuisinesCard({ course }: { course: Course }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>(
    course.max_cuisines != null ? String(course.max_cuisines) : "",
  );

  const save = useMutation({
    mutationFn: () =>
      updateCourse({
        course_id: course.id,
        max_cuisines: value.trim() === "" ? null : Number(value),
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Cuisines partners can choose
        </CardTitle>
        <CardDescription>
          How many cuisines can a partner select for this course? Leave blank
          to let partners pick as many as they like.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="w-40 space-y-1">
          <Label className="text-xs">Max cuisines</Label>
          <Input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function CuisineDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Cuisine | null;
  onSave: (p: {
    id?: string;
    name: string;
    sort_order: number;
    show_count: number;
    active: boolean;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [showCount, setShowCount] = useState(initial?.show_count ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);

  // reset when reopened
  if (open && initial && name === "" && initial.name) {
    setName(initial.name);
    setSortOrder(initial.sort_order);
    setShowCount(initial.show_count);
    setActive(initial.active);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setName("");
          setSortOrder(0);
          setShowCount(0);
          setActive(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit cuisine" : "Add cuisine"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Cuisine name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tamil Nadu"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Sort order</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Show how many products?</Label>
              <Select
                value={String(showCount)}
                onValueChange={(v) => setShowCount(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Show all</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="text-sm">Active</div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || !name.trim()}
            onClick={() =>
              onSave({
                id: initial?.id,
                name: name.trim(),
                sort_order: sortOrder,
                show_count: showCount,
                active,
              })
            }
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CuisineRecipesEditor({
  course,
  cuisine,
}: {
  course: Course;
  cuisine: Cuisine;
}) {
  const qc = useQueryClient();
  const fnList = listRecipesByCuisine;
  const fnUpsert = upsertCuisineRecipe;
  const [editing, setEditing] = useState<CuisineRecipe | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["lp-cuisine-recipes", cuisine.id],
    queryFn: () => fnList({ course_id: course.id, cuisine_id: cuisine.id }),
  });

  const upsert = useMutation({
    mutationFn: (p: {
      id?: string;
      food_name: string;
      ingredients_md: string;
      prep_steps_md: string;
      cook_steps_md: string;
      image_path: string | null;
      active: boolean;
      sort_order: number;
    }) => fnUpsert({ ...p, course_id: course.id, cuisine_id: cuisine.id }),
    onSuccess: () => {
      toast.success("Recipe saved");
      qc.invalidateQueries({ queryKey: ["lp-cuisine-recipes", cuisine.id] });
      setEditing(null);
      setAdding(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add product
        </Button>
      </div>
      {q.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          No products yet.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.data!.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-md border border-border p-2"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {r.food_name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.active ? "Active" : "Inactive"} · order {r.sort_order}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <RecipeDialog
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        initial={editing}
        onSave={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />
    </div>
  );
}

function RecipeDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: CuisineRecipe | null;
  onSave: (p: {
    id?: string;
    food_name: string;
    ingredients_md: string;
    prep_steps_md: string;
    cook_steps_md: string;
    image_path: string | null;
    active: boolean;
    sort_order: number;
  }) => void;
  saving: boolean;
}) {
  const [food, setFood] = useState(initial?.food_name ?? "");
  const [ings, setIngs] = useState(initial?.ingredients_md ?? "");
  const [prep, setPrep] = useState(initial?.prep_steps_md ?? "");
  const [cook, setCook] = useState(initial?.cook_steps_md ?? "");
  const [imagePath, setImagePath] = useState<string | null>(
    initial?.image_path ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial?.image_url ?? null,
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [order, setOrder] = useState(initial?.sort_order ?? 0);
  const [uploading, setUploading] = useState(false);

  if (open && initial && food === "" && initial.food_name) {
    setFood(initial.food_name);
    setIngs(initial.ingredients_md);
    setPrep(initial.prep_steps_md ?? "");
    setCook(initial.cook_steps_md ?? "");
    setImagePath(initial.image_path ?? null);
    setPreviewUrl(initial.image_url ?? null);
    setActive(initial.active);
    setOrder(initial.sort_order);
  }

  async function onPick(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `recipes/${crypto.randomUUID()}.${ext}`;
      const uploadErr = await uploadToStorage("learning-media", path, file);
      const error = uploadErr;
      if (error) throw error;
      setImagePath(path);
      const signedUrlRes = await api.post("/sft/storage/signed-url", {
        bucket: "learning-media",
        path: path,
      });
      const data = { signedUrl: signedUrlRes.data?.url };
      setPreviewUrl(data?.signedUrl ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setFood("");
          setIngs("");
          setPrep("");
          setCook("");
          setImagePath(null);
          setPreviewUrl(null);
          setActive(true);
          setOrder(0);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3 md:col-span-2">
            <div className="space-y-1">
              <Label className="text-xs">Product name</Label>
              <Input
                value={food}
                onChange={(e) => setFood(e.target.value)}
                placeholder="Rasam"
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Ingredients</Label>
            <Textarea
              rows={4}
              value={ings}
              onChange={(e) => setIngs(e.target.value)}
              placeholder={"- Tomato 2\n- Tamarind paste 1 tsp"}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preparation steps</Label>
            <Textarea
              rows={5}
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cooking instructions</Label>
            <Textarea
              rows={5}
              value={cook}
              onChange={(e) => setCook(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">
              Reference image (for learners to view)
            </Label>
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-md border border-border bg-muted">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) =>
                  e.target.files?.[0] && onPick(e.target.files[0])
                }
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sort order</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm">Active</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || !food.trim()}
            onClick={() =>
              onSave({
                id: initial?.id,
                food_name: food.trim(),
                ingredients_md: ings,
                prep_steps_md: prep,
                cook_steps_md: cook,
                image_path: imagePath,
                active,
                sort_order: order,
              })
            }
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SampleImageGuideCard({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const fnGet = getSampleImageGuide;
  const fnSave = upsertSampleImageGuide;
  const q = useQuery({
    queryKey: ["lp-sample-guide", courseId],
    queryFn: () => fnGet({ course_id: courseId }),
  });
  const [guidelines, setGuidelines] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (q.data && guidelines === null) {
    setGuidelines(q.data.guidelines_md);
    setImagePath(q.data.sample_image_path);
    setPreviewUrl(q.data.sample_image_url);
  }

  const save = useMutation({
    mutationFn: () =>
      fnSave({
        course_id: courseId,
        sample_image_path: imagePath,
        guidelines_md: guidelines ?? "",
      }),
    onSuccess: () => {
      toast.success("Sample image guide saved");
      qc.invalidateQueries({ queryKey: ["lp-sample-guide", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPick(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `sample-guide/${courseId}.${ext}`;
      const uploadErr = await uploadToStorage("learning-media", path, file);
      const error = uploadErr;
      if (error) throw error;
      setImagePath(path);
      const signedUrlRes = await api.post("/sft/storage/signed-url", {
        bucket: "learning-media",
        path: path,
      });
      const data = { signedUrl: signedUrlRes.data?.url };
      setPreviewUrl(data?.signedUrl ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Sample Food Image Guide
        </CardTitle>
        <CardDescription>
          Shown to partners as a popup before they upload product photos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[200px_1fr]">
        <div>
          <div className="grid h-44 w-44 place-items-center overflow-hidden rounded-md border border-border bg-muted">
            {previewUrl ? (
              <img src={previewUrl} className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <Input
            type="file"
            accept="image/*"
            className="mt-2"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Image capture guidelines (markdown)</Label>
          <Textarea
            rows={10}
            value={guidelines ?? ""}
            onChange={(e) => setGuidelines(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save guide
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
