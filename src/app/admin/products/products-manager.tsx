"use client";

import { useMemo, useState } from "react";

type ParsedImportRow = {
  line?: number;
  itemNumber: string;
  department: string;
  itemDescription: string;
  qty: number;
  sellerCategory: string;
  category: string;
  condition: string;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  item_number?: string | null;
  department: string | null;
  item_description: string | null;
  seller_category: string | null;
  category: string | null;
  condition?: string | null;
  base_price_cents: number | null;
  price_cents?: number | null;
  base_stock: number;
  qty?: number;
  active: boolean;
  featured: boolean;
  featured_rank?: number | null;
  has_variants: boolean;
  category_id: string | null;
  category_ref?: { name?: string | null; slug?: string | null } | null;
  image_url?: string | null;
  redeemable?: boolean;
  points_price?: number | null;
};

type ProductForm = {
  name: string;
  description: string;
  active: boolean;
  featured: boolean;
  featured_rank: number;
  has_variants: boolean;
  sku: string;
  category_id: string | null;
  department: string;
  item_description: string;
  seller_category: string;
  category: string;
  condition: string;
  price_cents: number | null;
  base_price_cents: number | null;
  qty: number;
  tags: string[];
  redeemable: boolean;
  points_price: number | null;
};

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  active: true,
  featured: false,
  featured_rank: 0,
  has_variants: false,
  sku: "",
  category_id: null,
  department: "",
  item_description: "",
  seller_category: "",
  category: "",
  condition: "",
  price_cents: null,
  base_price_cents: null,
  qty: 0,
  tags: [],
  redeemable: false,
  points_price: null,
};

const PAGE_SIZE = 10;

export default function ProductsManager({ initialProducts }: { initialProducts: ProductRow[] }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts ?? []);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive" | "featured" | "redeemable"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ParsedImportRow[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const normalizedQuery = query.toLowerCase();

      const matchQuery =
        !query ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        (product.sku ?? "").toLowerCase().includes(normalizedQuery) ||
        (product.item_description ?? "").toLowerCase().includes(normalizedQuery) ||
        (product.category ?? "").toLowerCase().includes(normalizedQuery);

      const matchActive =
        activeFilter === "all" ||
        (activeFilter === "active"
          ? product.active
          : activeFilter === "inactive"
            ? !product.active
            : activeFilter === "featured"
              ? product.featured
              : Boolean(product.redeemable));

      return matchQuery && matchActive;
    });
  }, [products, query, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safeCurrentPage]);

  const rangeStart = filtered.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = filtered.length === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, filtered.length);

  async function refreshProducts() {
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo refrescar productos");

    const normalized = (json.data ?? []).map(
      (
        row: ProductRow & {
          images?: Array<{ url: string; sort_order: number }>;
        },
      ) => {
        const images = Array.isArray(row.images) ? [...row.images] : [];
        const primary = images.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
        return { ...row, image_url: primary?.url ?? row.image_url ?? null };
      },
    );

    setProducts(normalized);
  }

  function startNewProduct() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setMessage(null);
    setImageFile(null);
    setImagePreview(null);
  }

  function startEdit(product: ProductRow) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: "",
      active: product.active,
      featured: product.featured,
      featured_rank: product.featured_rank ?? 0,
      has_variants: product.has_variants,
      sku: product.sku ?? "",
      category_id: product.category_id,
      department: product.department ?? "",
      item_description: product.item_description ?? "",
      seller_category: product.seller_category ?? "",
      category: product.category ?? product.category_ref?.name ?? "",
      condition: product.condition ?? "",
      price_cents: product.price_cents ?? null,
      base_price_cents: product.base_price_cents ?? null,
      qty: product.qty ?? product.base_stock ?? 0,
      tags: [],
      redeemable: Boolean(product.redeemable),
      points_price: product.points_price ?? null,
    });
    setMessage(null);
    setError(null);
    setImageFile(null);
    setImagePreview(product.image_url ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImage(productId: string) {
    if (!imageFile) return;

    const fd = new FormData();
    fd.append("file", imageFile);

    const response = await fetch(`/api/admin/products/${productId}/image-upload`, {
      method: "POST",
      body: fd,
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || "No se pudo subir imagen");
    }

    setImagePreview(json.data?.url ?? null);
    setImageFile(null);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (form.price_cents != null && form.price_cents < 0) {
      setError("El precio actual debe ser >= 0");
      return;
    }

    if (form.base_price_cents != null && form.base_price_cents < 0) {
      setError("El precio original debe ser >= 0");
      return;
    }

    if (
      form.base_price_cents != null &&
      form.price_cents != null &&
      form.price_cents > form.base_price_cents
    ) {
      setError("El precio actual no puede ser mayor al precio original");
      return;
    }

    if (form.featured_rank < 0) {
      setError("El featured rank debe ser >= 0");
      return;
    }

    if (form.qty < 0) {
      setError("El stock debe ser >= 0");
      return;
    }

    if (form.redeemable && (!form.points_price || form.points_price <= 0)) {
      setError("Si el producto es redimible debes colocar un precio en puntos mayor a 0");
      return;
    }

    const normalizedPrice = form.price_cents ?? null;
    const normalizedBasePrice = form.base_price_cents ?? form.price_cents ?? null;

    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description || null,
      sku: form.sku || null,
      department: form.department || null,
      item_description: form.item_description || null,
      seller_category: form.seller_category || null,
      category: form.category || null,
      condition: form.condition || null,
      price_cents: normalizedPrice,
      base_price_cents: normalizedBasePrice,
      qty: form.qty,
      base_stock: form.qty,
      featured_rank: form.featured ? form.featured_rank : 0,
      redeemable: form.redeemable,
      points_price: form.redeemable ? form.points_price : null,
    };

    const endpoint = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
    const method = editingId ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok) {
      const backendError =
        typeof json.error === "string"
          ? json.error
          : json.error?.message ||
            json.error?.formErrors?.[0] ||
            Object.values(json.error?.fieldErrors ?? {}).flat()?.[0] ||
            "No se pudo guardar producto";

      setError(String(backendError));
      return;
    }

    const productId = json.data?.id ?? editingId;
    if (productId && imageFile) {
      try {
        await uploadImage(productId);
      } catch (uploadError) {
        setError((uploadError as Error).message);
        return;
      }
    }

    setMessage(editingId ? "Producto actualizado" : "Producto creado");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    await refreshProducts();
  }

  async function removeProduct(id: string) {
    if (!confirm("¿Eliminar producto? Esta acción no se puede deshacer.")) return;

    const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "No se pudo eliminar");
      return;
    }

    setMessage("Producto eliminado");
    await refreshProducts();
  }

  async function parseCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!csvFile) {
      setError("Selecciona un archivo CSV");
      return;
    }

    const body = new FormData();
    body.append("file", csvFile);

    const response = await fetch("/api/admin/products/import", {
      method: "POST",
      body,
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "No se pudo leer CSV");
      setImportResult(null);
      return;
    }

    const summary = json.data?.summary;
    setImportResult(`CSV leído: ${summary.parsedRows} filas válidas · ${summary.failedRows} filas con error`);
    setMessage("Parseo CSV completado");
    setImportPreview((json.data?.preview ?? []) as ParsedImportRow[]);

    const errs = json.data?.errors as string[] | undefined;
    if (errs?.length) {
      setError(`Filas con error: ${errs.slice(0, 3).join(" | ")}`);
    }
  }

  async function confirmImport() {
    if (!importPreview.length) {
      setError("No hay filas parseadas para importar");
      return;
    }

    const response = await fetch("/api/admin/products/import/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows: importPreview }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "No se pudo guardar importación");
      return;
    }

    const s = json.data?.summary;
    setMessage(`Importación guardada. Insertados: ${s.inserted} · Actualizados: ${s.updated} · Fallidos: ${s.failed}`);
    const errs = json.data?.errors as string[] | undefined;
    setError(errs?.length ? `Errores: ${errs.slice(0, 3).join(" | ")}` : null);
    setImportPreview([]);
    setCsvFile(null);
    await refreshProducts();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={startNewProduct} type="button">
            Nuevo producto
          </button>
          <label className="cursor-pointer rounded-md border border-uiBorder bg-surface px-3 py-2 text-sm hover:bg-surfaceMuted">
            Importar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <form
        onSubmit={parseCsv}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-uiBorder bg-surface p-3"
      >
        <p className="text-sm text-mutedText">
          Formato CSV esperado: Item #, Department, Item Description, Qty, Seller Category, Category, Condition
        </p>
        <button
          type="submit"
          className="rounded-md border border-uiBorder px-3 py-1.5 text-sm hover:bg-surfaceMuted"
        >
          Leer CSV
        </button>
        {importPreview.length > 0 ? (
          <button type="button" onClick={confirmImport} className="btn-primary">
            Guardar importación
          </button>
        ) : null}
        {csvFile ? <p className="text-xs text-mutedText">Archivo: {csvFile.name}</p> : null}
      </form>

      <form
        onSubmit={saveProduct}
        className="grid gap-3 rounded-xl border border-uiBorder bg-surface p-4 shadow-sm md:grid-cols-2"
      >
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Item # / SKU"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
        />
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Item Description / Nombre"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
        />
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Seller Category"
          value={form.seller_category}
          onChange={(e) => setForm((f) => ({ ...f, seller_category: e.target.value }))}
        />
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Condition"
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
        />
        <input
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Descripción extendida"
          value={form.item_description}
          onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))}
        />
        <input
          type="number"
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Price (cents)"
          value={form.price_cents ?? ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, price_cents: e.target.value === "" ? null : Number(e.target.value) }))
          }
        />
        <input
          type="number"
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Compare price (cents)"
          value={form.base_price_cents ?? ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              base_price_cents: e.target.value === "" ? null : Number(e.target.value),
            }))
          }
        />
        <input
          type="number"
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Qty"
          value={form.qty}
          onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
        />
        <input
          type="number"
          min={0}
          className="rounded-md border border-uiBorder p-2.5"
          placeholder="Featured rank"
          value={form.featured_rank}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              featured_rank: e.target.value === "" ? 0 : Number(e.target.value),
            }))
          }
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.redeemable}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                redeemable: e.target.checked,
                points_price: e.target.checked ? f.points_price : null,
              }))
            }
          />
          Redimible por puntos
        </label>

        <input
          type="number"
          min={1}
          disabled={!form.redeemable}
          className="rounded-md border border-uiBorder p-2.5 disabled:cursor-not-allowed disabled:bg-surfaceMuted"
          placeholder="Precio en puntos"
          value={form.points_price ?? ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              points_price: e.target.value === "" ? null : Number(e.target.value),
            }))
          }
        />

        <div className="md:col-span-2 rounded-md border border-uiBorder p-3">
          <p className="mb-2 text-sm font-semibold">Foto del producto</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded border border-uiBorder px-3 py-1.5 text-sm hover:bg-surfaceMuted">
              Subir imagen
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImageFile(file);
                  if (file) {
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
            {imageFile ? <span className="text-xs text-mutedText">{imageFile.name}</span> : null}
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="preview"
                className="h-14 w-14 rounded border border-uiBorder object-cover"
              />
            ) : (
              <span className="text-xs text-mutedText">Sin imagen</span>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Activo
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          />
          Featured
        </label>

        <div className="md:col-span-2 flex items-center gap-2">
          <button className="btn-primary" type="submit">
            {editingId ? "Guardar cambios" : "Crear producto"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-md border border-uiBorder px-3 py-2 text-sm"
              onClick={startNewProduct}
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {importResult ? <p className="text-sm text-brand-secondary">{importResult}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {importPreview.length > 0 ? (
        <div className="rounded-xl border border-uiBorder bg-surface p-3">
          <p className="mb-2 text-sm font-semibold">Vista previa CSV (primeras 20 filas)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surfaceMuted text-left">
                <tr>
                  <th className="px-2 py-1">Item #</th>
                  <th className="px-2 py-1">Department</th>
                  <th className="px-2 py-1">Item Description</th>
                  <th className="px-2 py-1">Qty</th>
                  <th className="px-2 py-1">Seller Category</th>
                  <th className="px-2 py-1">Category</th>
                  <th className="px-2 py-1">Condition</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((row, idx) => (
                  <tr key={idx} className="border-t border-uiBorder">
                    <td className="px-2 py-1">{String(row.itemNumber ?? "")}</td>
                    <td className="px-2 py-1">{String(row.department ?? "")}</td>
                    <td className="px-2 py-1">{String(row.itemDescription ?? "")}</td>
                    <td className="px-2 py-1">{String(row.qty ?? "")}</td>
                    <td className="px-2 py-1">{String(row.sellerCategory ?? "")}</td>
                    <td className="px-2 py-1">{String(row.category ?? "")}</td>
                    <td className="px-2 py-1">{String(row.condition ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-md border border-uiBorder p-2 text-sm"
            placeholder="Buscar por item#, nombre, descripción o category"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            className="rounded-md border border-uiBorder p-2 text-sm"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(
                e.target.value as "all" | "active" | "inactive" | "featured" | "redeemable",
              );
              setCurrentPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="featured">Featured</option>
            <option value="redeemable">Redimibles</option>
          </select>
        </div>

        <div className="text-sm text-mutedText">
          Mostrando {rangeStart}-{rangeEnd} de {filtered.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Foto</th>
              <th className="px-4 py-3">Item #</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Item Description</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Seller Category</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Puntos</th>
              <th className="px-4 py-3">Redimible</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Featured</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-mutedText" colSpan={13}>
                  No hay productos para mostrar
                </td>
              </tr>
            ) : (
              paginatedProducts.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 align-middle transition hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm"
                      />
                    ) : (
                      <span className="text-xs text-mutedText">Sin foto</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{p.item_number ?? p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.department ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="max-w-[220px]">
                      <p className="font-semibold text-slate-900">{p.item_description || p.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{p.item_number ?? p.sku ?? "Sin SKU"}</p>
                    </div>
                  </td>
                  <td className="px-3 py-2">{p.qty ?? p.base_stock}</td>
                  <td className="px-4 py-3 text-slate-700">{p.seller_category ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.category ?? p.category_ref?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.condition ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.points_price ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        p.redeemable
                          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                      }`}
                    >
                      {p.redeemable ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        p.active
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                      }`}
                    >
                      {p.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        p.featured
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                      }`}
                    >
                      {p.featured ? "Featured" : "Normal"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[170px] items-center gap-2">
                      <button
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        type="button"
                        onClick={() => startEdit(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="inline-flex items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50"
                        type="button"
                        onClick={() => removeProduct(p.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-mutedText">
            Página {safeCurrentPage} de {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-uiBorder px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1}
            >
              Anterior
            </button>

            <button
              type="button"
              className="rounded-md border border-uiBorder px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}