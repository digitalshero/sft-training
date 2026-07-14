-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('super_admin', 'admin', 'trainer', 'partner_lead', 'pse', 'kitchen_partner', 'inspector', 'partner');

-- CreateEnum
CREATE TYPE "FcStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "FcCurrency" AS ENUM ('inr', 'usd');

-- CreateEnum
CREATE TYPE "FcCurrencyMode" AS ENUM ('inr', 'usd', 'both');

-- CreateEnum
CREATE TYPE "FcIngredientCategory" AS ENUM ('grocery', 'vegetable', 'spice', 'oil', 'dairy', 'packing', 'other');

-- CreateEnum
CREATE TYPE "FcPrepType" AS ENUM ('base', 'paste', 'extract', 'seasoning', 'masala_mix', 'other', 'gravy_base', 'boiled_cooked', 'fried_roasted');

-- CreateEnum
CREATE TYPE "FcRecipeStatus" AS ENUM ('draft', 'submitted', 'change_pending_approval', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "FcVersionStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "FcVegMode" AS ENUM ('single', 'multi', 'mix', 'none');

-- CreateEnum
CREATE TYPE "LpBookingStatus" AS ENUM ('booked', 'passed', 'failed', 'reschedule', 'cancelled');

-- CreateEnum
CREATE TYPE "LpEmailStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "LpEnrolmentStatus" AS ENUM ('active', 'completed', 'withdrawn');

-- CreateEnum
CREATE TYPE "LpFinalDecision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "LpFormStatus" AS ENUM ('not_sent', 'pending', 'submitted');

-- CreateEnum
CREATE TYPE "LpModuleType" AS ENUM ('slides', 'video', 'reading', 'mixed');

-- CreateEnum
CREATE TYPE "LpQuestionType" AS ENUM ('single', 'multi', 'tf');

-- CreateEnum
CREATE TYPE "LpSubmissionStatus" AS ENUM ('pending', 'approved', 'redo', 'rejected');

-- CreateEnum
CREATE TYPE "LpVisitStatus" AS ENUM ('eligible', 'visitor_assigned', 'visit_scheduled', 'email_sent', 'visit_completed', 'approved', 'certified', 'rejected', 'waiting_admin_reschedule', 'rescheduled');

-- CreateEnum
CREATE TYPE "KobStatus" AS ENUM ('new_lead', 'language_assigned', 'first_call_pending', 'first_call_completed', 'webinar_invited', 'webinar_attended', 'webinar_missed', 'faq_pending', 'interested', 'not_interested', 'documents_pending', 'payment_pending', 'agreement_pending', 'agreement_signed', 'onboarding_approved', 'transferred_to_sft', 'hold', 'dropped', 'rejected');

-- CreateEnum
CREATE TYPE "KobSource" AS ENUM ('marketing', 'social_media', 'referral', 'website', 'field_team', 'whatsapp', 'inbound_call', 'other');

-- CreateEnum
CREATE TYPE "BusinessModel" AS ENUM ('branded', 'unbranded');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('individual', 'commercial');

-- CreateEnum
CREATE TYPE "FaqAudience" AS ENUM ('kob_lead', 'sft_partner');

-- CreateEnum
CREATE TYPE "LeCourseStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LeCertStatus" AS ENUM ('not_started', 'in_progress', 'checkpoint_failed', 'quiz_pending', 'practical_pending', 'approval_pending', 'certified', 'expired', 'retraining_required', 'revoked');

-- CreateEnum
CREATE TYPE "LeQuestionKind" AS ENUM ('single_choice', 'multi_choice', 'true_false', 'short_answer', 'image_choice', 'checklist');

-- CreateEnum
CREATE TYPE "LeScopeType" AS ENUM ('user', 'role', 'department', 'country', 'vertical', 'brand');

-- CreateEnum
CREATE TYPE "LeSectionKind" AS ENUM ('intro', 'text', 'graphic', 'screenshot', 'video', 'in_lesson_question', 'mini_quiz', 'practical_task', 'final_assessment');

-- CreateEnum
CREATE TYPE "LeTaxonomyType" AS ENUM ('country', 'vertical', 'department', 'sub_team', 'role', 'brand', 'language', 'training_level', 'trainer_type');

-- CreateEnum
CREATE TYPE "LeVertical" AS ENUM ('partner_academy', 'pse_academy', 'internal_ops', 'compliance');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_sign_in_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "phone" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "app_permissions" (
    "user_id" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_permissions_pkey" PRIMARY KEY ("user_id","permission_key")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_send_log" (
    "id" TEXT NOT NULL,
    "message_id" TEXT,
    "template_name" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_unsubscribe_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_unsubscribe_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressed_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "suppressed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "process_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_programs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "cover_url" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_courses" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "duration_label" TEXT,
    "cover_url" TEXT,
    "pass_pct" INTEGER NOT NULL DEFAULT 70,
    "max_attempts" INTEGER,
    "day5_gate_days" INTEGER NOT NULL DEFAULT 0,
    "requires_product_upload" BOOLEAN NOT NULL DEFAULT false,
    "requires_inspection" BOOLEAN NOT NULL DEFAULT false,
    "issues_certificate" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "product_brief" JSONB NOT NULL DEFAULT '{}',
    "inspection_rubric" JSONB NOT NULL DEFAULT '{}',
    "certificate_template" JSONB NOT NULL DEFAULT '{}',
    "welcome_letter" JSONB NOT NULL DEFAULT '{}',
    "supported_languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "journey_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "section_order" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resource_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "video_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_course_days" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "day_no" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "unlock_after_days" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_course_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_modules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "type" "LpModuleType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "est_minutes" INTEGER,
    "deck_id" TEXT,
    "video_url" TEXT,
    "reading_md" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "slide_overrides" JSONB NOT NULL DEFAULT '{}',
    "voice" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "autoplay_advance" BOOLEAN NOT NULL DEFAULT true,
    "default_slide_seconds" INTEGER NOT NULL DEFAULT 5,
    "quiz_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiz_pass_pct" INTEGER NOT NULL DEFAULT 70,
    "quiz_questions" JSONB NOT NULL DEFAULT '[]',
    "day_id" TEXT,
    "quiz_placement" TEXT NOT NULL DEFAULT 'topic',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_enrolments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" "LpEnrolmentStatus" NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_module_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_module_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_module_quiz_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'topic',
    "question_ids" TEXT[],
    "answers" JSONB NOT NULL,
    "score_pct" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_module_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sft_deck_setup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "pdf_path" TEXT,
    "voice" TEXT NOT NULL DEFAULT 'alloy',
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "autoplay_advance" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sft_deck_setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_partner_invites" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "kitchen_location" TEXT,
    "message" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "invited_by" TEXT,
    "user_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_partner_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_partner_events" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "invite_id" TEXT,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_partner_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_product_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "files" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" "LpSubmissionStatus" NOT NULL DEFAULT 'pending',
    "feedback" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_product_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_certificates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_path" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "lp_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_quizzes" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "module_id" TEXT,
    "title" TEXT NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "shuffle" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_questions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "LpQuestionType" NOT NULL DEFAULT 'single',
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct" JSONB NOT NULL DEFAULT '[]',
    "explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_quiz_questions" (
    "quiz_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lp_quiz_questions_pkey" PRIMARY KEY ("quiz_id","question_id")
);

-- CreateTable
CREATE TABLE "lp_cuisines" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "show_count" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_cuisines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_recipes" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "cuisine_id" TEXT,
    "food_name" TEXT NOT NULL,
    "ingredients_md" TEXT NOT NULL DEFAULT '',
    "prep_steps_md" TEXT,
    "cook_steps_md" TEXT,
    "image_path" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_sample_image_guide" (
    "course_id" TEXT NOT NULL,
    "sample_image_path" TEXT,
    "guidelines_md" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_sample_image_guide_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "lp_product_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "cuisine_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_product_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_recipe_assignments" (
    "partner_user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_method" TEXT NOT NULL DEFAULT 'manual',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_recipe_assignments_pkey" PRIMARY KEY ("partner_user_id","course_id")
);

-- CreateTable
CREATE TABLE "lp_physical_visits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "submission_id" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "partner_location" TEXT,
    "partner_state" TEXT,
    "partner_country" TEXT,
    "partner_phone" TEXT,
    "partner_address" TEXT,
    "cuisine_id" TEXT,
    "visitor_name" TEXT,
    "visitor_email" TEXT,
    "visitor_phone" TEXT,
    "visit_date" TEXT,
    "visit_time" TEXT,
    "remarks" TEXT,
    "status" "LpVisitStatus" NOT NULL DEFAULT 'eligible',
    "email_status" "LpEmailStatus" NOT NULL DEFAULT 'pending',
    "last_email_kind" TEXT,
    "visitor_email_sent_at" TIMESTAMP(3),
    "partner_email_sent_at" TIMESTAMP(3),
    "form_status" "LpFormStatus" NOT NULL DEFAULT 'not_sent',
    "google_form_url" TEXT,
    "form_submitted_at" TIMESTAMP(3),
    "final_decision" "LpFinalDecision",
    "decision_comments" TEXT,
    "submitted_at" TIMESTAMP(3),
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_physical_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_physical_visit_photos" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "image_path" TEXT NOT NULL,
    "caption" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_physical_visit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_physical_visit_history" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "visitor_name" TEXT,
    "visitor_email" TEXT,
    "visitor_phone" TEXT,
    "visit_date" TEXT,
    "visit_time" TEXT,
    "decision" TEXT,
    "comments" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_physical_visit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_physical_visit_tokens" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_physical_visit_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_inspection_slots" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_inspection_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lp_inspection_bookings" (
    "id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "LpBookingStatus" NOT NULL DEFAULT 'booked',
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_inspection_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sft_partner_resources" (
    "id" TEXT NOT NULL,
    "course_id" TEXT,
    "brand_id" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'sft-decks',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sft_partner_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sft_videos" (
    "id" TEXT NOT NULL,
    "course_id" TEXT,
    "brand_id" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "video_path" TEXT,
    "external_url" TEXT,
    "bucket" TEXT NOT NULL DEFAULT 'sft-videos',
    "thumbnail_path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sft_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sft_partner_tasks" (
    "id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sft_partner_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "fc_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "code_prefix" TEXT,
    "description" TEXT,
    "brand_since" TIMESTAMP(3),
    "active_in" BOOLEAN NOT NULL DEFAULT true,
    "active_us" BOOLEAN NOT NULL DEFAULT true,
    "status" "FcStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_categories" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hero_image_url" TEXT,
    "vcr_image_url" TEXT,
    "packing_image_url" TEXT,
    "video_url" TEXT,
    "active_in" BOOLEAN NOT NULL DEFAULT true,
    "active_us" BOOLEAN NOT NULL DEFAULT true,
    "status" "FcStatus" NOT NULL DEFAULT 'active',
    "veg_slot_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "veg_slot_unit_id" TEXT,
    "serves_min" DOUBLE PRECISION,
    "serves_max" DOUBLE PRECISION,
    "colour_note" TEXT,
    "consistency_note" TEXT,
    "taste_note" TEXT,
    "crc_recipe_id" TEXT,
    "packing_container_id" TEXT,
    "packing_container_id_in" TEXT,
    "packing_container_id_us" TEXT,
    "mrp_mode" TEXT NOT NULL DEFAULT 'multiplier',
    "mrp_multiplier_inr" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mrp_multiplier_usd" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mrp_flat_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mrp_flat_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppp_mode" TEXT NOT NULL DEFAULT 'multiplier',
    "ppp_multiplier_inr" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ppp_multiplier_usd" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ppp_flat_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppp_flat_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptr_mode" TEXT NOT NULL DEFAULT 'multiplier',
    "ptr_multiplier_inr" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ptr_multiplier_usd" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ptr_flat_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptr_flat_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FcIngredientCategory" NOT NULL DEFAULT 'grocery',
    "base_unit_id" TEXT NOT NULL,
    "price_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kcal_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protein_g_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs_g_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat_g_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fibre_g_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_animal_origin" BOOLEAN NOT NULL DEFAULT false,
    "is_dairy" BOOLEAN NOT NULL DEFAULT false,
    "active_in" BOOLEAN NOT NULL DEFAULT true,
    "active_us" BOOLEAN NOT NULL DEFAULT true,
    "manually_used" BOOLEAN NOT NULL DEFAULT false,
    "status" "FcStatus" NOT NULL DEFAULT 'active',
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_ingredient_price_history" (
    "id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "currency" "FcCurrency" NOT NULL,
    "old_price" DOUBLE PRECISION NOT NULL,
    "new_price" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fc_ingredient_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_packing_containers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "size_unit_id" TEXT,
    "image_url" TEXT,
    "price_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active_in" BOOLEAN NOT NULL DEFAULT true,
    "active_us" BOOLEAN NOT NULL DEFAULT true,
    "status" "FcStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_packing_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_preps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "FcPrepType" NOT NULL DEFAULT 'base',
    "base_unit_id" TEXT NOT NULL,
    "brand_id" TEXT,
    "category_id" TEXT,
    "cuisine" TEXT,
    "description" TEXT,
    "preparation_notes" TEXT,
    "storage_notes" TEXT,
    "shelf_life_days" INTEGER,
    "shelf_life_condition" TEXT,
    "default_batch_size" DOUBLE PRECISION,
    "default_yield_qty" DOUBLE PRECISION,
    "default_yield_unit_id" TEXT,
    "default_wastage_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lump_weight_g" DOUBLE PRECISION,
    "currency_mode" "FcCurrencyMode" NOT NULL DEFAULT 'both',
    "active_in" BOOLEAN NOT NULL DEFAULT true,
    "active_us" BOOLEAN NOT NULL DEFAULT true,
    "manually_used" BOOLEAN NOT NULL DEFAULT false,
    "status" "FcStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_preps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT,
    "menu_description" TEXT,
    "menu_position" INTEGER NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "spice_level" INTEGER NOT NULL DEFAULT 0,
    "veg_mode" "FcVegMode" NOT NULL DEFAULT 'none',
    "veg_ingredient_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "veg_qty_override" DOUBLE PRECISION,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serves_label" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "currency_mode" "FcCurrencyMode" NOT NULL DEFAULT 'both',
    "active_in" BOOLEAN NOT NULL DEFAULT true,
    "active_us" BOOLEAN NOT NULL DEFAULT true,
    "status" "FcStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_recipes" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "prep_id" TEXT,
    "category_id" TEXT,
    "status" "FcRecipeStatus" NOT NULL DEFAULT 'draft',
    "current_version_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_recipe_versions" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "currency" "FcCurrency" NOT NULL,
    "wastage_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yield_qty" DOUBLE PRECISION,
    "yield_unit_id" TEXT,
    "change_summary" TEXT,
    "notes" TEXT,
    "mrp_mode" TEXT,
    "mrp_multiplier" DOUBLE PRECISION,
    "mrp_flat" DOUBLE PRECISION,
    "ppp_mode" TEXT,
    "ppp_multiplier" DOUBLE PRECISION,
    "ppp_flat" DOUBLE PRECISION,
    "status" "FcVersionStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_recipe_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_recipe_items" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "ingredient_id" TEXT,
    "prep_id" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit_id" TEXT NOT NULL,
    "wastage_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_veg_slot" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fc_recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_approval_log" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "version_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "role" TEXT,
    "comment" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fc_approval_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_price_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "FcCurrency" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fc_price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_price_list_items" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_code" TEXT,
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packing_price" DOUBLE PRECISION,
    "mrp_price" DOUBLE PRECISION,
    "ppp_price" DOUBLE PRECISION,
    "total_price" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "fc_price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fc_price_list_log" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "role" TEXT,
    "comment" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fc_price_list_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_entries" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "country" TEXT,
    "language" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer_md" TEXT NOT NULL,
    "audience" "FaqAudience" NOT NULL,
    "category" TEXT,
    "country" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_unsubscribe_tokens_email_key" ON "email_unsubscribe_tokens"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_unsubscribe_tokens_token_key" ON "email_unsubscribe_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "suppressed_emails_email_key" ON "suppressed_emails"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_queue_message_id_key" ON "email_queue"("message_id");

-- CreateIndex
CREATE INDEX "email_queue_status_process_after_idx" ON "email_queue"("status", "process_after");

-- CreateIndex
CREATE UNIQUE INDEX "lp_programs_slug_key" ON "lp_programs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lp_courses_slug_key" ON "lp_courses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lp_course_days_course_id_day_no_key" ON "lp_course_days"("course_id", "day_no");

-- CreateIndex
CREATE UNIQUE INDEX "lp_enrolments_user_id_course_id_key" ON "lp_enrolments"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lp_module_progress_user_id_module_id_key" ON "lp_module_progress"("user_id", "module_id");

-- CreateIndex
CREATE INDEX "lp_module_quiz_attempts_user_id_module_id_idx" ON "lp_module_quiz_attempts"("user_id", "module_id");

-- CreateIndex
CREATE INDEX "lp_partner_invites_course_id_idx" ON "lp_partner_invites"("course_id");

-- CreateIndex
CREATE INDEX "lp_partner_invites_user_id_idx" ON "lp_partner_invites"("user_id");

-- CreateIndex
CREATE INDEX "lp_product_submissions_user_id_course_id_idx" ON "lp_product_submissions"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lp_certificates_code_key" ON "lp_certificates"("code");

-- CreateIndex
CREATE INDEX "lp_certificates_user_id_idx" ON "lp_certificates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lp_certificates_user_id_course_id_key" ON "lp_certificates"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "lp_quizzes_course_id_module_id_idx" ON "lp_quizzes"("course_id", "module_id");

-- CreateIndex
CREATE INDEX "lp_product_assignments_user_id_course_id_idx" ON "lp_product_assignments"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "lp_physical_visits_user_id_idx" ON "lp_physical_visits"("user_id");

-- CreateIndex
CREATE INDEX "lp_physical_visit_photos_visit_id_attempt_no_idx" ON "lp_physical_visit_photos"("visit_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "lp_physical_visit_tokens_visit_id_key" ON "lp_physical_visit_tokens"("visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "lp_physical_visit_tokens_token_key" ON "lp_physical_visit_tokens"("token");

-- CreateIndex
CREATE INDEX "lp_inspection_bookings_user_id_idx" ON "lp_inspection_bookings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fc_units_code_key" ON "fc_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fc_brands_code_key" ON "fc_brands"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fc_preps_code_key" ON "fc_preps"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fc_products_code_key" ON "fc_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fc_recipes_product_id_key" ON "fc_recipes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "fc_recipe_versions_recipe_id_version_no_key" ON "fc_recipe_versions"("recipe_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "config_entries_section_key_key" ON "config_entries"("section", "key");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_permissions" ADD CONSTRAINT "app_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_courses" ADD CONSTRAINT "lp_courses_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "lp_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_course_days" ADD CONSTRAINT "lp_course_days_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_modules" ADD CONSTRAINT "lp_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_modules" ADD CONSTRAINT "lp_modules_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "lp_course_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_modules" ADD CONSTRAINT "lp_modules_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "sft_deck_setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_enrolments" ADD CONSTRAINT "lp_enrolments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_module_progress" ADD CONSTRAINT "lp_module_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "lp_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_module_quiz_attempts" ADD CONSTRAINT "lp_module_quiz_attempts_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "lp_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_partner_invites" ADD CONSTRAINT "lp_partner_invites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_partner_events" ADD CONSTRAINT "lp_partner_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_partner_events" ADD CONSTRAINT "lp_partner_events_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "lp_partner_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_product_submissions" ADD CONSTRAINT "lp_product_submissions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_certificates" ADD CONSTRAINT "lp_certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_quizzes" ADD CONSTRAINT "lp_quizzes_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "lp_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_quiz_questions" ADD CONSTRAINT "lp_quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "lp_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_quiz_questions" ADD CONSTRAINT "lp_quiz_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "lp_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_cuisines" ADD CONSTRAINT "lp_cuisines_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_recipes" ADD CONSTRAINT "lp_recipes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_recipes" ADD CONSTRAINT "lp_recipes_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "lp_cuisines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_sample_image_guide" ADD CONSTRAINT "lp_sample_image_guide_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_physical_visits" ADD CONSTRAINT "lp_physical_visits_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_physical_visit_photos" ADD CONSTRAINT "lp_physical_visit_photos_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "lp_physical_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_physical_visit_history" ADD CONSTRAINT "lp_physical_visit_history_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "lp_physical_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_physical_visit_tokens" ADD CONSTRAINT "lp_physical_visit_tokens_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "lp_physical_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_inspection_slots" ADD CONSTRAINT "lp_inspection_slots_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lp_inspection_bookings" ADD CONSTRAINT "lp_inspection_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "lp_inspection_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sft_partner_resources" ADD CONSTRAINT "sft_partner_resources_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sft_videos" ADD CONSTRAINT "sft_videos_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sft_partner_tasks" ADD CONSTRAINT "sft_partner_tasks_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "lp_partner_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_categories" ADD CONSTRAINT "fc_categories_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "fc_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_ingredients" ADD CONSTRAINT "fc_ingredients_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "fc_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_ingredient_price_history" ADD CONSTRAINT "fc_ingredient_price_history_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "fc_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_packing_containers" ADD CONSTRAINT "fc_packing_containers_size_unit_id_fkey" FOREIGN KEY ("size_unit_id") REFERENCES "fc_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_preps" ADD CONSTRAINT "fc_preps_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "fc_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_preps" ADD CONSTRAINT "fc_preps_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "fc_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_products" ADD CONSTRAINT "fc_products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "fc_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_products" ADD CONSTRAINT "fc_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fc_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipes" ADD CONSTRAINT "fc_recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "fc_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipes" ADD CONSTRAINT "fc_recipes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fc_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipe_versions" ADD CONSTRAINT "fc_recipe_versions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "fc_recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipe_versions" ADD CONSTRAINT "fc_recipe_versions_yield_unit_id_fkey" FOREIGN KEY ("yield_unit_id") REFERENCES "fc_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipe_items" ADD CONSTRAINT "fc_recipe_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "fc_recipe_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipe_items" ADD CONSTRAINT "fc_recipe_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "fc_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipe_items" ADD CONSTRAINT "fc_recipe_items_prep_id_fkey" FOREIGN KEY ("prep_id") REFERENCES "fc_preps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_recipe_items" ADD CONSTRAINT "fc_recipe_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "fc_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_approval_log" ADD CONSTRAINT "fc_approval_log_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "fc_recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_price_list_items" ADD CONSTRAINT "fc_price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "fc_price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fc_price_list_log" ADD CONSTRAINT "fc_price_list_log_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "fc_price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
