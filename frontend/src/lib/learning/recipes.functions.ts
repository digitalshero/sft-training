import api from "@/lib/api/client";

export interface Recipe {
  id: string;
  course_id: string;
  cuisine_id: string | null;
  food_name: string;
  ingredients_md: string;
  prep_steps_md: string | null;
  cook_steps_md: string | null;
  image_path: string | null;
  active: boolean;
  sort_order: number;
  status: string;
  image_url?: string | null;
  cuisine_name?: string | null;
}

export const listCourseRecipes = (d: { course_id: string }): Promise<Recipe[]> =>
  api.get(`/learning/courses/${d.course_id}/recipes`).then((r) => r.data);
export const listRecipesByCuisine = (d: {
  course_id: string;
  cuisine_id?: string;
}): Promise<Recipe[]> =>
  api
    .get(`/learning/courses/${d.course_id}/recipes`, { params: { cuisine_id: d.cuisine_id } })
    .then((r) => r.data);
export const upsertRecipe = (d: Partial<Recipe> & { course_id: string }) =>
  api.post("/learning/recipes", d).then((r) => r.data);
export const upsertCuisineRecipe = upsertRecipe;
export const deleteRecipe = (d: { id: string }) =>
  api.delete(`/learning/recipes/${d.id}`).then((r) => r.data);
export const getAssignedRecipe = (d: { course_id: string }) =>
  api.get(`/partner/courses/${d.course_id}/my-cook-assignments`).then((r) => r.data?.[0] ?? null);
export const listRecipeAssignments = (d: { course_id: string }) =>
  api.get(`/partner/courses/${d.course_id}/my-cook-assignments`).then((r) => r.data);
export const assignRecipe = (d: { course_id: string; recipe_id: string }) =>
  api.post(`/partner/courses/${d.course_id}/choose-cuisine`, d).then((r) => r.data);
export const autoAssignRecipes = assignRecipe;
export const getSampleImageGuide = (d: { course_id: string }) =>
  api.get(`/learning/courses/${d.course_id}/sample-guide`).then((r) => r.data);
export const upsertSampleImageGuide = (d: { course_id: string } & Record<string, unknown>) =>
  api.post(`/learning/courses/${d.course_id}/sample-guide`, d).then((r) => r.data);
