-- STEP 8 audit: tìm kiếm toàn văn trong Postgres (tsvector generated + GIN, pg_trgm cho gõ sai / khớp chuỗi con).
-- Không dùng extension unaccent (không IMMUTABLE nên không dùng được trong cột generated): tự gập dấu bằng sf_fold().
-- Cần quyền tạo extension pg_trgm (trusted extension từ PG13: chủ database là đủ). Xem DEPLOY.md.

-- 1) pg_trgm: cài vào schema "public" nếu chưa có ở đâu cả. Chạy song song nhiều process có thể đua nhau -> nuốt lỗi trùng.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
    EXCEPTION WHEN unique_violation OR duplicate_object THEN
      NULL;
    END;
  END IF;
END
$do$;

-- 2) Gập dấu tiếng Việt (và Latin có dấu khác) + hạ chữ thường, thuần SQL, IMMUTABLE, không phụ thuộc locale của DB.
CREATE OR REPLACE FUNCTION sf_fold(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$fn$ SELECT lower(translate(regexp_replace(t, '[̀-ͯ]', '', 'g'), 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžƠơƯưǍǎǏǐǑǒǓǔǕǖǗǘǙǚǛǜǞǟǠǡǦǧǨǩǪǫǬǭǰǴǵǸǹǺǻȀȁȂȃȄȅȆȇȈȉȊȋȌȍȎȏȐȑȒȓȔȕȖȗȘșȚțȞȟȦȧȨȩȪȫȬȭȮȯȰȱȲȳḀḁḂḃḄḅḆḇḈḉḊḋḌḍḎḏḐḑḒḓḔḕḖḗḘḙḚḛḜḝḞḟḠḡḢḣḤḥḦḧḨḩḪḫḬḭḮḯḰḱḲḳḴḵḶḷḸḹḺḻḼḽḾḿṀṁṂṃṄṅṆṇṈṉṊṋṌṍṎṏṐṑṒṓṔṕṖṗṘṙṚṛṜṝṞṟṠṡṢṣṤṥṦṧṨṩṪṫṬṭṮṯṰṱṲṳṴṵṶṷṸṹṺṻṼṽṾṿẀẁẂẃẄẅẆẇẈẉẊẋẌẍẎẏẐẑẒẓẔẕẖẗẘẙẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹđĐ', 'aaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyyaaaaaaccccccccddeeeeeeeeeegggggggghhiiiiiiiiijjkkllllllnnnnnnoooooorrrrrrssssssssttttuuuuuuuuuuuuwwyyyzzzzzzoouuaaiioouuuuuuuuuuaaaaggkkoooojggnnaaaaaaeeeeiiiioooorrrruuuusstthhaaeeooooooooyyaabbbbbbccddddddddddeeeeeeeeeeffgghhhhhhhhhhiiiikkkkkkllllllllmmmmmmnnnnnnnnoooooooopppprrrrrrrrssssssssssttttttttuuuuuuuuuuvvvvwwwwwwwwwwxxxxyyzzzzzzhtwyaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiioooooooooooooooooooooooouuuuuuuuuuuuuuyyyyyyyydd')) $fn$;

-- text[] -> text: array_to_string chỉ STABLE, nhưng với text[] kết quả thuần hàm của đầu vào.
CREATE OR REPLACE FUNCTION sf_tags(t text[]) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$fn$ SELECT sf_fold(array_to_string(t, ' ')) $fn$;

-- 3) Cột tsvector generated (GHI KHÔNG ĐƯỢC: Postgres tự tính từ cột gốc, seed/Prisma không cần biết tới chúng).
ALTER TABLE "Course" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', sf_fold("title")), 'A') || setweight(to_tsvector('simple', sf_fold("description")), 'B')
) STORED;

ALTER TABLE "Post" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', sf_fold("content")), 'A') || setweight(to_tsvector('simple', sf_tags("tags")), 'B')
) STORED;

ALTER TABLE "User" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', sf_fold("firstName" || ' ' || "lastName"))
) STORED;

CREATE INDEX "Course_searchVector_idx" ON "Course" USING GIN ("searchVector");
CREATE INDEX "Post_searchVector_idx" ON "Post" USING GIN ("searchVector");
CREATE INDEX "User_searchVector_idx" ON "User" USING GIN ("searchVector");

-- 4) Chỉ mục trigram (khớp chuỗi con + gõ sai) cho trường ngắn. Tên opclass phải kèm schema của pg_trgm (tìm động) vì
--    search_path của migration có thể không chứa nó (test chạy mỗi file trong 1 schema tạm).
DO $do$
DECLARE s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF s IS NULL THEN RAISE EXCEPTION 'pg_trgm chưa được cài (CREATE EXTENSION pg_trgm)'; END IF;
  EXECUTE format('CREATE INDEX "Course_title_trgm_idx" ON "Course" USING GIN ((sf_fold("title")) %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ((sf_fold("firstName" || '' '' || "lastName")) %I.gin_trgm_ops)', s);
END
$do$;
