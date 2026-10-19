"use client";

import { Pagination } from "@/components/ui";

export function ListPagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p role="status" aria-live="polite" className="text-sm text-slate-600">
        Показано {firstItem}–{lastItem} из {total}
      </p>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={onChange}
        />
      )}
    </div>
  );
}
