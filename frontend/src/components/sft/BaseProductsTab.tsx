import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCourseBaseProducts,
  upsertBaseProduct,
  deleteBaseProduct,
  type BaseProduct,
} from "@/lib/learning/base-products.functions";
import { listCuisines } from "@/lib/learning/cuisines.functions";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Plus, Pencil, Trash2, Loader2, Layers } from "lucide-react";

type Course = { id: string; title: string };

const DEFAULT_DESCRIPTION =
  "Prepare the below listed bases, refer to HDM 2 Chart in downloads - post in app - get approval - start preparing the items under Product to cook";

export function BaseProductsTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BaseProduct | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["lp-base-products", course.id],
    queryFn: () => listCourseBaseProducts({ course_id: course.id }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteBaseProduct({ id }),
    onSuccess: () => {
      toast.success("Base product deleted");
      qc.invalidateQueries({ queryKey: ["lp-base-products", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Base Products
            </CardTitle>
            <CardDescription>
              Mandatory preparations a partner must complete for a cuisine
              before its Product To Cook items unlock. Each cuisine keeps its
              own separate list.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Base Product
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading base
            products…
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No base products yet. Click{" "}
            <span className="font-medium">Add Base Product</span> to create
            one for a cuisine.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((b) => (
              <div
                key={b.id}
                className="overflow-hidden rounded-md border bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {b.cuisine_name ?? "No cuisine"}
                  </Badge>
                  <Badge variant={b.active ? "default" : "secondary"}>
                    {b.active ? "active" : "inactive"}
                  </Badge>
                </div>
                <div className="font-medium text-sm">{b.name}</div>
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {b.description || "—"}
                </p>
                <div className="flex justify-end gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(b)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${b.name}"?`)) del.mutate(b.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {(adding || editing) && (
        <BaseProductDialog
          courseId={course.id}
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function BaseProductDialog({
  courseId,
  initial,
  onClose,
}: {
  courseId: string;
  initial: BaseProduct | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [cuisineId, setCuisineId] = useState<string>(initial?.cuisine_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(
    initial?.description ?? DEFAULT_DESCRIPTION,
  );
  const [active, setActive] = useState(initial?.active ?? true);

  const cQ = useQuery({
    queryKey: ["lp-cuisines", courseId],
    queryFn: () => listCuisines({ course_id: courseId }),
  });
  const cuisines = (cQ.data ?? []).filter((c) => c.active);

  const save = useMutation({
    mutationFn: () => {
      if (!cuisineId) throw new Error("Select a cuisine");
      if (!name.trim()) throw new Error("Base product name is required");
      return upsertBaseProduct({
        id: initial?.id,
        course_id: courseId,
        cuisine_id: cuisineId,
        name: name.trim(),
        description,
        active,
      });
    },
    onSuccess: () => {
      toast.success(initial ? "Base product updated" : "Base product saved");
      qc.invalidateQueries({ queryKey: ["lp-base-products", courseId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noCuisines = !cQ.isLoading && cuisines.length === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit base product" : "Add base product"}
          </DialogTitle>
          <DialogDescription>
            Every partner who selects this cuisine will get this base product
            to prepare before their Product To Cook items unlock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Cuisine</label>
            <Select
              value={cuisineId}
              onValueChange={setCuisineId}
              disabled={noCuisines}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    noCuisines ? "No cuisines available" : "Select cuisine"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {cuisines.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {noCuisines && (
              <p className="text-xs text-muted-foreground">
                Create a cuisine first in the Cuisines tab.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Base product name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Toor Dal Base"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">Active (assigned to partners)</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || noCuisines}
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{" "}
            Save Base Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
