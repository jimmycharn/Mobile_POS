# Recipe / Bill of Materials (BOM) for F&B — Mobile POS

A phased plan to let the POS support recipe-based products (e.g., "ข้าวผัดกุ้ง") that auto-deduct ingredients from branch inventory when sold, without tracking the dish itself as stock.

---

## Phase 1: Database Schema

### New Table: `recipes`
| Column | Type | Note |
|--------|------|------|
| id | UUID PK | |
| branch_id | UUID FK → branches | per-branch recipes |
| shop_product_id | UUID FK → shop_products | the dish being sold |
| name | TEXT | recipe name (defaults to dish name) |
| created_at | timestamptz | |

### New Table: `recipe_items` (ingredients)
| Column | Type | Note |
|--------|------|------|
| id | UUID PK | |
| recipe_id | UUID FK → recipes | |
| ingredient_shop_product_id | UUID FK → shop_products | the raw material |
| quantity | NUMERIC | amount consumed per 1 unit of dish |
| unit | TEXT | e.g., "กรัม", "ฟอง", "มิลลิลิตร" |
| created_at | timestamptz | |

### Schema SQL additions
- Add both tables with `ON DELETE CASCADE` on FKs
- Add RLS: read/write by branch members + owner + superadmin

---

## Phase 2: Backend API (`supabaseApi.js`)

- `recipeService.getByBranch(branchId)` — list all recipes with nested `recipe_items`
- `recipeService.getByShopProduct(shopProductId)` — get recipe for a specific dish
- `recipeService.create({ branchId, shopProductId, name, items[] })`
- `recipeService.update(id, { name, items[] })` — upsert items
- `recipeService.remove(id)` — cascade deletes items

Helper: `checkRecipeStock(recipe, qty)` — returns `{ ok: false, shortages: [...] }` if any ingredient is insufficient.

---

## Phase 3: Inventory Page — Recipe Editor

### Option A: Toggle in Product Form
When adding/editing a shop product, add a toggle switch **"สินค้าสูตรอาหาร (ไม่มีสต็อกตัวเอง)"**.
- If ON: hide Stock / MinStock fields; show a **Recipe Builder** section below
- Recipe Builder: searchable list of existing shop_products (ingredients), pick one, enter qty + unit
- Show a preview: *"1 จาน ข้าวผัดกุ้ง = ข้าวสาร 300g + กุ้ง 5ตัว + ..."*

### Option B: Dedicated "จัดการสูตรอาหาร" Page
- New route `/recipes` accessible from Inventory or Settings
- Table of all recipes per branch
- Click to edit recipe, add/remove ingredients, adjust quantities
- Show estimated cost per dish (sum of ingredient cost × qty)

**Recommendation:** implement **Option A first** (toggle in product form), then add **Option B** as a management overview page later.

---

## Phase 4: POS Checkout — Auto-Deduct Ingredients

Modify `PosPage.handleCheckout`:

1. Group cart items by whether they have a recipe
2. For recipe items:
   a. Fetch recipe + items
   b. Calculate total ingredient consumption (qty × dish qty)
   c. Check current stock of each ingredient
   d. **If sufficient:** deduct normally, log `RECIPE_CONSUMPTION`
   e. **If insufficient:** show warning modal
      - Title: *"วัตถุดิบไม่พอ"*
      - List shortages per ingredient
      - Buttons: **"ยกเลิก"** | **"ขายต่อ (ติดลบ)"**
      - If "ขายต่อ": proceed with deduction anyway, log flag `forced_negative: true`
3. For non-recipe items: keep existing stock deduction logic

### Stock Deduction Order
- Run within the same `handleCheckout` loop after creating the `sale` record
- Update each ingredient's `shop_products.stock` via `shopProductService.update()`
- If any update fails, alert but do NOT roll back the sale (F&B reality: it's better to record the sale)

---

## Phase 5: Reporting & Warnings

### Low Ingredient Alerts on POS
- When loading the POS product list, compute "available dishes" per recipe product:
  - `maxServings = min(ingredient.stock / ingredient.qty for each item)`
  - If `maxServings < 5`, show a small red dot or badge on the product card
  - If `maxServings == 0`, show "วัตถุดิบหมด" overlay but still allow adding to cart

### Inventory Report
- Add a new report tab: **"วัตถุดิบ / สูตรอาหาร"**
- List all ingredients with:
  - Current stock
  - Number of dishes that depend on it
  - Estimated days until out (based on recent sales velocity)
- List all recipe dishes with:
  - Estimated cost per dish
  - Margin %
  - How many can still be made with current stock

---

## Phase 6: Edge Cases & Polish

| Scenario | Behavior |
|----------|----------|
| Ingredient deleted but still in recipe | Show warning in recipe editor, grey out in POS |
| Recipe dish edited mid-sale (cart already has item) | No effect on current cart; only affects future checkouts |
| Ingredient stock updated manually via Stock In | Immediately reflected in recipe availability |
| Transfer ingredients between branches | Out of scope for now; each branch manages its own |
| Negative stock allowed? | Yes, with strong warning + audit log. F&B reality: system stock ≠ physical stock |
| Cost price auto-calculated for recipe dish? | Optional: show "ต้นทุนโดยประมาณ" = Σ(ingredient.costPrice × qty). User can still override with their own costPrice. |

---

## Implementation Order (Recommended)

1. **Schema + RLS** — add `recipes` and `recipe_items` tables
2. **API Layer** — `recipeService` CRUD
3. **InventoryPage** — add toggle + recipe builder in product form
4. **POS Checkout** — check & deduct ingredients, warning modal
5. **POS Product Cards** — show low-ingredient badges
6. **Reports** — recipe/ingredient overview (can be Phase 2 of this feature)

---

## Open Decisions

- Should we prevent deleting an ingredient that is used in a recipe? (soft delete vs hard delete)
- Should recipe dishes have their own `costPrice` field, or always derive from ingredients?
- Should we support **partial recipes** (e.g., ข้าวผัดกุ้ง but without ไข่ because customer is allergic)? → Out of scope for MVP; use manual "custom order" note instead.
