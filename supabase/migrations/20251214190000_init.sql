SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."bench_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bench_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "is_main" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."bench_photos" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."benches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "title" "text",
    "description" "text",
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "main_photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "benches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);

ALTER TABLE "public"."benches" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."bench_photos"
    ADD CONSTRAINT "bench_photos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."benches"
    ADD CONSTRAINT "benches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bench_photos"
    ADD CONSTRAINT "bench_photos_bench_id_fkey" FOREIGN KEY ("bench_id") REFERENCES "public"."benches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."benches"
    ADD CONSTRAINT "benches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Admins can manage all bench photos" ON "public"."bench_photos" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admins can manage all benches" ON "public"."benches" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admins can read all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());

CREATE POLICY "Anonymous read approved benches" ON "public"."benches" FOR SELECT USING (("status" = 'approved'::"text"));

CREATE POLICY "Anonymous read photos of approved benches" ON "public"."bench_photos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."benches" "b"
  WHERE (("b"."id" = "bench_photos"."bench_id") AND ("b"."status" = 'approved'::"text")))));

CREATE POLICY "Authenticated read bench photos" ON "public"."bench_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."benches" "b"
  WHERE (("b"."id" = "bench_photos"."bench_id") AND (("b"."status" = 'approved'::"text") OR (("b"."created_by" = "auth"."uid"()) AND ("b"."status" IS DISTINCT FROM 'rejected'::"text")) OR "public"."is_admin"())))));

CREATE POLICY "Authenticated users read approved benches" ON "public"."benches" FOR SELECT TO "authenticated" USING (("status" = 'approved'::"text"));

CREATE POLICY "Owners can delete bench photos" ON "public"."bench_photos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."benches" "b"
  WHERE (("b"."id" = "bench_photos"."bench_id") AND ("b"."created_by" = "auth"."uid"())))));

CREATE POLICY "Owners can delete pending benches" ON "public"."benches" FOR DELETE TO "authenticated" USING (("created_by" = "auth"."uid"()));

CREATE POLICY "Owners can read own benches" ON "public"."benches" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("status" IS DISTINCT FROM 'rejected'::"text")));

CREATE POLICY "Owners can update bench photos" ON "public"."bench_photos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."benches" "b"
  WHERE (("b"."id" = "bench_photos"."bench_id") AND ("b"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."benches" "b"
  WHERE (("b"."id" = "bench_photos"."bench_id") AND ("b"."created_by" = "auth"."uid"())))));

CREATE POLICY "Owners can update pending benches" ON "public"."benches" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("status" = 'pending'::"text"))) WITH CHECK (("created_by" = "auth"."uid"()));

CREATE POLICY "Users can insert bench photos" ON "public"."bench_photos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."benches" "b"
  WHERE (("b"."id" = "bench_photos"."bench_id") AND ("b"."created_by" = "auth"."uid"())))));

CREATE POLICY "Users can insert benches" ON "public"."benches" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));

CREATE POLICY "Users can manage own profile" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

ALTER TABLE "public"."bench_photos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."benches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";

GRANT ALL ON TABLE "public"."bench_photos" TO "anon";
GRANT ALL ON TABLE "public"."bench_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."bench_photos" TO "service_role";

GRANT ALL ON TABLE "public"."benches" TO "anon";
GRANT ALL ON TABLE "public"."benches" TO "authenticated";
GRANT ALL ON TABLE "public"."benches" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
