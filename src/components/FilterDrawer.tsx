"use client";

import { useState } from "react";

export function FilterDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-uiBorder bg-white px-4 py-2 text-sm font-medium">
        Filters
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:hidden">
          <div className="mx-auto max-h-[90vh] max-w-sm overflow-y-auto rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-sm">Close</button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
