import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCourseRecipes,
  upsertRecipe,
  deleteRecipe,
  listRecipeAssignments,
  assignRecipe,
  autoAssignRecipes,
  type Recipe,
} from "@/lib/learning/recipes.functions";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Wand2, ChefHat } from "lucide-react";

type Course = { id: string; title: string };
type AssignmentRow = {
  user_id: string;
  display_name: string;
  email: string;
  modules_done: number;
  modules_total: number;
  eligible: boolean;
  recipe_id: string | null;
  assigned_method: string | null;
};

export function RecipesTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fnList = listCourseRecipes;
  const fnDelete = deleteRecipe;
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["lp-recipes", course.id],
    queryFn: () => fnList({ course_id: course.id }),
  });

  const del = useMutation({
    mutationFn: (id: string) => fnDelete({ id }),
    onSuccess: () => {
      toast.success("Recipe deleted");
      qc.invalidateQueries({ queryKey: ["lp-recipes", course.id] });
      qc.invalidateQueries({ queryKey: ["lp-recipe-assignments", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ChefHat className="h-4 w-4" /> Recipe Management
              </CardTitle>
              <CardDescription>
                Upload as many recipes as you like. Each partner receives
                exactly one after completing the course.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Recipe
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading recipes…
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              No recipes yet. Click{" "}
              <span className="font-medium">Add Recipe</span> to upload your
              first dish.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(q.data ?? []).map((r) => (
                <div
                  key={r.id}
                  className="overflow-hidden rounded-md border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.cuisine_name ?? "No cuisine"}
                    </Badge>
                    <Badge
                      variant={r.status === "active" ? "default" : "secondary"}
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="font-medium text-sm">{r.food_name}</div>
                  <pre className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground font-sans">
                    {r.ingredients_md || "—"}
                  </pre>
                  <div className="flex justify-end gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`Delete "${r.food_name}"?`))
                          del.mutate(r.id);
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
      </Card>

      <AssignmentsCard courseId={course.id} />

      {(adding || editing) && (
        <RecipeDialog
          courseId={course.id}
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RecipeDialog({
  courseId,
  initial,
  onClose,
}: {
  courseId: string;
  initial: Recipe | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fnUpsert = upsertRecipe;
  const fnCuisines = listCuisines;
  const [cuisineId, setCuisineId] = useState<string>(initial?.cuisine_id ?? "");
  const [foodName, setFoodName] = useState(initial?.food_name ?? "");
  const [ingredients, setIngredients] = useState(initial?.ingredients_md ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(() =>
    initial?.status === "inactive" ? "inactive" : "active",
  );

  const cQ = useQuery({
    queryKey: ["lp-cuisines", courseId],
    queryFn: () => fnCuisines({ course_id: courseId }),
  });
  const cuisines = (cQ.data ?? []).filter((c) => c.active);

  const save = useMutation({
    mutationFn: () => {
      if (!cuisineId) throw new Error("Select a cuisine");
      if (!foodName.trim()) throw new Error("Food name is required");
      if (!ingredients.trim()) throw new Error("Ingredients are required");
      return fnUpsert({
        id: initial?.id,
        course_id: courseId,
        cuisine_id: cuisineId,
        food_name: foodName.trim(),
        ingredients_md: ingredients,
        image_path: initial?.image_path ?? null,
        status,
      });
    },
    onSuccess: () => {
      toast.success(initial ? "Recipe updated" : "Recipe saved");
      qc.invalidateQueries({ queryKey: ["lp-recipes", courseId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noCuisines = !cQ.isLoading && cuisines.length === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit recipe" : "Add recipe"}</DialogTitle>
          <DialogDescription>
            Group every recipe under a cuisine so partners see them organized
            during cooking.
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
            <label className="text-xs font-medium">Food name</label>
            <Input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="Pepper Garlic Rasam Rice"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Recipe ingredients</label>
            <Textarea
              rows={8}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder={
                "• Cooked Rice – 200 g\n• Rasam – 150 ml\n• Garlic – 5 cloves\n• Pepper – 1 tsp\n• Ghee – 1 tsp\n• Coriander Leaves"
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={status === "active"}
              onCheckedChange={(v) => setStatus(v ? "active" : "inactive")}
            />
            <span className="text-sm">Active (available for assignment)</span>
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
            Save Recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentsCard({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const fnList = listRecipeAssignments;
  const fnRecipes = listCourseRecipes;
  const fnAssign = assignRecipe;
  const fnAuto = autoAssignRecipes;

  const aQ = useQuery({
    queryKey: ["lp-recipe-assignments", courseId],
    queryFn: () => fnList({ course_id: courseId }),
  });
  const rQ = useQuery({
    queryKey: ["lp-recipes", courseId],
    queryFn: () => fnRecipes({ course_id: courseId }),
  });

  const activeRecipes = useMemo(
    () => (rQ.data ?? []).filter((r) => r.status === "active"),
    [rQ.data],
  );

  const assign = useMutation({
    mutationFn: (vars: {
      partnerId: string;
      recipeId: string;
      force?: boolean;
    }) =>
      fnAssign({
        course_id: courseId,
        recipe_id: vars.recipeId,
      }),
    onSuccess: () => {
      toast.success("Assignment saved");
      qc.invalidateQueries({ queryKey: ["lp-recipe-assignments", courseId] });
    },
    onError: (_e: Error, vars) => {
      if (
        confirm(
          "This partner already submitted under another recipe. Reassign anyway?",
        )
      ) {
        assign.mutate({ ...vars, force: true });
      }
    },
  });

  const auto = useMutation({
    mutationFn: () => fnAuto({ course_id: courseId, recipe_id: "" }),
    onSuccess: (r: { assigned: number }) => {
      toast.success(
        `Auto-assigned ${r.assigned} partner${r.assigned === 1 ? "" : "s"}`,
      );
      qc.invalidateQueries({ queryKey: ["lp-recipe-assignments", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Recipe assignments</CardTitle>
            <CardDescription>
              Partners appear here once they have completed every published
              module. Assign manually or use auto-assign.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={auto.isPending || activeRecipes.length === 0}
            onClick={() => auto.mutate()}
          >
            {auto.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Auto-assign unassigned
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {aQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading partners…
          </div>
        ) : (aQ.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No invited partners yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Assigned recipe</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(aQ.data ?? []).map((row: AssignmentRow) => (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <div className="font-medium">{row.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {row.modules_done}/{row.modules_total}
                    </TableCell>
                    <TableCell>
                      {row.eligible ? (
                        <Badge variant="default">Eligible</Badge>
                      ) : (
                        <Badge variant="secondary">In progress</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.recipe_id ?? ""}
                        onValueChange={(v) =>
                          assign.mutate({ partnerId: row.user_id, recipeId: v })
                        }
                        disabled={!row.eligible || activeRecipes.length === 0}
                      >
                        <SelectTrigger className="h-8 w-56">
                          <SelectValue placeholder="— Select recipe —" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeRecipes.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.cuisine_name
                                ? `${r.cuisine_name} · ${r.food_name}`
                                : r.food_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {row.assigned_method ? (
                        <Badge variant="outline" className="capitalize">
                          {row.assigned_method}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
