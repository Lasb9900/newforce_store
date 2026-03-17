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
  has_variants: boolean;
  category_id: string | null;
  category_ref?: { name?: string | null; slug?: string | null } | null;
  image_url?: string | null;
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
  qty: number;
  tags: string[];
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
  qty: 0,
  tags: [],
};

export default function ProductsManager({ initialProducts }: { initialProducts: ProductRow[] }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive" | "featured">("all");
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
      const matchQuery =
        !query ||
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        (product.sku ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (product.item_description ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (product.category ?? "").toLowerCase().includes(query.toLowerCase());

      const matchActive =
        activeFilter === "all" ||
        (activeFilter === "active"
          ? product.active
          : activeFilter === "inactive"
            ? !product.active
            : product.featured);

      return matchQuery && matchActive;
    });
  }, [products, query, activeFilter]);

  async function refreshProducts() {
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo refrescar productos");

    const normalized = (json.data ?? []).map((row: ProductRow & { images?: Array<{ url: string; sort_order: number }> }) => {
      const images = Array.isArray(row.images) ? [...row.images] : [];
      const primary = images.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
      return { ...row, image_url: primary?.url ?? row.image_url ?? null };
    });

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
      featured_rank: 0,
      has_variants: product.has_variants,
      sku: product.sku ?? "",
      category_id: product.category_id,
      department: product.department ?? "",
      item_description: product.item_description ?? "",
      seller_category: product.seller_category ?? "",
      category: product.category ?? product.category_ref?.name ?? "",
      condition: product.condition ?? "",
      price_cents: product.price_cents ?? product.base_price_cents ?? null,
      qty: product.qty ?? product.base_stock ?? 0,
      tags: [],
    });
    setMessage(null);
    setError(null);
    setImageFile(null);
    setImagePreview(product.image_url ?? null);
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
      setError("El precio debe ser >= 0");
      return;
    }

    if (form.qty < 0) {
      setError("El stock debe ser >= 0");
      return;
    }

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
      price_cents: form.price_cents ?? null,
      qty: form.qty,
      base_price_cents: form.price_cents ?? null,
      base_stock: form.qty,
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
      setError(json.error?.message || json.error || "No se pudo guardar producto");
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Catálogo</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Gestión de productos</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Administra tu inventario, carga catálogos por CSV y edita productos individuales sin afectar tus flujos actuales.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={startNewProduct} type="button">Nuevo producto</button>
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
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
      </div>

      <form onSubmit={parseCsv} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Formato CSV esperado: Item #, Department, Item Description, Qty, Seller Category, Category, Condition</p>
        <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Leer CSV</button>
        {importPreview.length > 0 ? (
          <button type="button" onClick={confirmImport} className="btn-primary">Guardar importación</button>
        ) : null}
        {csvFile ? <p className="text-xs text-slate-500">Archivo: {csvFile.name}</p> : null}
      </form>

      <form onSubmit={saveProduct} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Item # / SKU</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Item # / SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Item Description / Nombre</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Item Description / Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seller Category</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Seller Category" value={form.seller_category} onChange={(e) => setForm((f) => ({ ...f, seller_category: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Condition" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción extendida</label>
            <input className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Descripción extendida" value={form.item_description} onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price (cents)</label>
            <input type="number" className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Price (cents)" value={form.price_cents ?? ""} onChange={(e) => setForm((f) => ({ ...f, price_cents: e.target.value === "" ? null : Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</label>
            <input type="number" className="w-full rounded-lg border border-slate-200 p-2.5" placeholder="Qty" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">Foto del producto</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
            {imageFile ? <span className="text-xs text-slate-500">{imageFile.name}</span> : null}
            {imagePreview ? <img src={imagePreview} alt="preview" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" /> : <span className="text-xs text-slate-500">Sin imagen</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Activo</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Featured</label>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-primary" type="submit">{editingId ? "Guardar cambios" : "Crear producto"}</button>
          {editingId ? <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" onClick={startNewProduct}>Cancelar edición</button> : null}
        </div>
      </form>

      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {importResult ? <p className="rounded-lg border border-brand-secondary/20 bg-brand-secondary/5 px-3 py-2 text-sm text-brand-secondary">{importResult}</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      {importPreview.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-700">Vista previa CSV (primeras 20 filas)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-2">Item #</th>
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Item Description</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Seller Category</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Condition</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-2 py-2">{String(row.itemNumber ?? "")}</td>
                    <td className="px-2 py-2">{String(row.department ?? "")}</td>
                    <td className="px-2 py-2">{String(row.itemDescription ?? "")}</td>
                    <td className="px-2 py-2">{String(row.qty ?? "")}</td>
                    <td className="px-2 py-2">{String(row.sellerCategory ?? "")}</td>
                    <td className="px-2 py-2">{String(row.category ?? "")}</td>
                    <td className="px-2 py-2">{String(row.condition ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input className="rounded-lg border border-slate-200 p-2 text-sm" placeholder="Buscar por item#, nombre, descripción o category" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="rounded-lg border border-slate-200 p-2 text-sm" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive" | "featured") }>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="featured">Featured</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Foto</th>
                <th className="px-3 py-2.5">Item #</th>
                <th className="px-3 py-2.5">Department</th>
                <th className="px-3 py-2.5">Item Description</th>
                <th className="px-3 py-2.5">Qty</th>
                <th className="px-3 py-2.5">Seller Category</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Condition</th>
                <th className="px-3 py-2.5">Activo</th>
                <th className="px-3 py-2.5">Featured</th>
                <th className="px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-500" colSpan={11}>No hay productos para mostrar</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">{p.image_url ? <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-lg border border-slate-200 object-cover" /> : <span className="text-xs text-slate-400">Sin foto</span>}</td>
                    <td className="px-3 py-2.5">{p.item_number ?? p.sku ?? "—"}</td>
                    <td className="px-3 py-2.5">{p.department ?? "—"}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{p.item_description || p.name}</td>
                    <td className="px-3 py-2.5">{p.qty ?? p.base_stock}</td>
                    <td className="px-3 py-2.5">{p.seller_category ?? "—"}</td>
                    <td className="px-3 py-2.5">{p.category ?? p.category_ref?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">{p.condition ?? "—"}</td>
                    <td className="px-3 py-2.5"><span className={p.active ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"}>{p.active ? "Sí" : "No"}</span></td>
                    <td className="px-3 py-2.5"><span className={p.featured ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"}>{p.featured ? "Sí" : "No"}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700" type="button" onClick={() => startEdit(p)}>Editar</button>
                        <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700" type="button" onClick={() => removeProduct(p.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
