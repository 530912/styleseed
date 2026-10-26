// 가짜 Supabase에 시험 사용자 + 옷 3벌(상의·하의·신발)을 만들고 세션을 base64로 출력한다
//   node scripts/webqa/seed.mjs [가짜 Supabase 주소=http://127.0.0.1:54321]
import fs from "node:fs";
import crypto from "node:crypto";

const M = process.argv[2] ?? "http://127.0.0.1:54321";
const IMG = new URL("../../assets/images/products/", import.meta.url).pathname;
const j = (r) => r.json();

const s = await fetch(`${M}/auth/v1/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `webqa-${Date.now()}@example.test`, password: crypto.randomBytes(9).toString("base64url") }) }).then(j);
const H = { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" };
const items = [
  ["white-shirts.jpg", "top", "shirt", "white", "regular", "cotton", ["minimal", "classic"]],
  ["poet-core-denim.jpg", "bottom", "jeans", "black", "wide", "denim", ["casual", "street"]],
  ["white-sneakers.jpg", "shoes", "sneakers", "white", "regular", "leather", ["minimal", "casual"]],
];
for (const [file, category, sub_category, color, fit, material, style] of items) {
  const path = `${s.user.id}/originals/${file}`;
  await fetch(`${M}/storage/v1/object/clothing-images/${path}`, { method: "POST", headers: { ...H, "Content-Type": "image/jpeg" }, body: fs.readFileSync(IMG + file) });
  await fetch(`${M}/rest/v1/clothes?select=id`, { method: "POST", headers: H, body: JSON.stringify({ user_id: s.user.id, category, sub_category, color, color_tone: "bright", fit, material, season: ["spring", "fall"], tpo: ["casual"], style, original_image_path: path, cutout_image_path: null }) });
}
process.stdout.write(Buffer.from(JSON.stringify(s)).toString("base64"));
