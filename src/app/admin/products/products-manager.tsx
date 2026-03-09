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
  department: string | null;
  item_description: string | null;
  seller_category: string | null;
  item_condition: string | null;
  base_price_cents: number | null;
  base_stock: number;
  active: boolean;
  featured: boolean;
  has_variants: boolean;
  category_id: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
  image_url?: string | null;
};

type ProductForm = {
  name: string;
  description: string;
  base_price_cents: number | null;
  base_stock: number;
  active: boolean;
  featured: boolean;
  featured_rank: number;
  has_variants: boolean;
  sku: string;
  category_id: string | null;
  department: string;
  item_description: string;
  seller_category: string;
  item_condition: string;
  tags: string[];
};

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  base_price_cents: null,
  base_stock: 0,
  active: true,
  featured: false,
  featured_rank: 0,
  has_variants: false,
  sku: "",
  category_id: null,
  department: "",
  item_description: "",
  seller_category: "",
  item_condition: "",
  tags: [],
};

export default function ProductsManager({ initialProducts }: { initialProducts: ProductRow[] }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
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
        (product.item_description ?? "").toLowerCase().includes(query.toLowerCase());

      const matchActive =
        activeFilter === "all" ||
        (activeFilter === "active" ? product.active : !product.active);

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
      base_price_cents: product.base_price_cents,
      base_stock: product.base_stock,
      active: product.active,
      featured: product.featured,
      featured_rank: 0,
      has_variants: product.has_variants,
      sku: product.sku ?? "",
      category_id: product.category_id,
      department: product.department ?? "",
      item_description: product.item_description ?? "",
      seller_category: product.seller_category ?? "",
      item_condition: product.item_condition ?? "",
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

    if (form.base_price_cents != null && form.base_price_cents < 0) {
      setError("El precio debe ser >= 0");
      return;
    }

    if (form.base_stock < 0) {
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
      item_condition: form.item_condition || null,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={startNewProduct} type="button">Nuevo producto</button>
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

      <form onSubmit={parseCsv} className="flex flex-wrap items-center gap-2 rounded-xl border border-uiBorder bg-surface p-3">
        <p className="text-sm text-mutedText">Formato CSV esperado: Item #, Department, Item Description, Qty, Seller Category, Category, Condition</p>
        <button type="submit" className="rounded-md border border-uiBorder px-3 py-1.5 text-sm hover:bg-surfaceMuted">Leer CSV</button>
        {importPreview.length > 0 ? (
          <button type="button" onClick={confirmImport} className="btn-primary">Guardar importación</button>
        ) : null}
        {csvFile ? <p className="text-xs text-mutedText">Archivo: {csvFile.name}</p> : null}
      </form>

      <form onSubmit={saveProduct} className="grid gap-3 rounded-xl border border-uiBorder bg-surface p-4 shadow-sm md:grid-cols-2">
        <input className="rounded-md border border-uiBorder p-2.5" placeholder="Item # / SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5" placeholder="Item Description / Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <input className="rounded-md border border-uiBorder p-2.5" placeholder="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5" placeholder="Seller Category" value={form.seller_category} onChange={(e) => setForm((f) => ({ ...f, seller_category: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5" placeholder="Condition" value={form.item_condition} onChange={(e) => setForm((f) => ({ ...f, item_condition: e.target.value }))} />
        <input className="rounded-md border border-uiBorder p-2.5" placeholder="Descripción extendida" value={form.item_description} onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))} />
        <input type="number" className="rounded-md border border-uiBorder p-2.5" placeholder="Precio (cents)" value={form.base_price_cents ?? ""} onChange={(e) => setForm((f) => ({ ...f, base_price_cents: e.target.value === "" ? null : Number(e.target.value) }))} />
        <input type="number" className="rounded-md border border-uiBorder p-2.5" placeholder="Qty / Stock" value={form.base_stock} onChange={(e) => setForm((f) => ({ ...f, base_stock: Number(e.target.value) }))} />

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
            {imagePreview ? <img src={imagePreview} alt="preview" className="h-14 w-14 rounded object-cover border border-uiBorder" /> : <span className="text-xs text-mutedText">Sin imagen</span>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Activo</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Featured</label>
        <div className="md:col-span-2 flex items-center gap-2">
          <button className="btn-primary" type="submit">{editingId ? "Guardar cambios" : "Crear producto"}</button>
          {editingId ? <button type="button" className="rounded-md border border-uiBorder px-3 py-2 text-sm" onClick={startNewProduct}>Cancelar edición</button> : null}
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

      <div className="flex flex-wrap items-center gap-2">
        <input className="rounded-md border border-uiBorder p-2 text-sm" placeholder="Buscar por item#, nombre o descripción" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="rounded-md border border-uiBorder p-2 text-sm" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive") }>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-uiBorder bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surfaceMuted text-left text-mutedText">
            <tr>
              <th className="px-3 py-2">Foto</th>
              <th className="px-3 py-2">Item #</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Item Description</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Seller Category</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Condition</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-mutedText" colSpan={9}>No hay productos para mostrar</td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-uiBorder">
                  <td className="px-3 py-2">{p.image_url ? <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover border border-uiBorder" /> : <span className="text-xs text-mutedText">Sin foto</span>}</td>
                  <td className="px-3 py-2">{p.sku ?? "—"}</td>
                  <td className="px-3 py-2">{p.department ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{p.item_description || p.name}</td>
                  <td className="px-3 py-2">{p.base_stock}</td>
                  <td className="px-3 py-2">{p.seller_category ?? "—"}</td>
                  <td className="px-3 py-2">{p.category?.name ?? "—"}</td>
                  <td className="px-3 py-2">{p.item_condition ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button className="rounded border border-uiBorder px-2 py-1 text-xs" type="button" onClick={() => startEdit(p)}>Editar</button>
                      <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" type="button" onClick={() => removeProduct(p.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
