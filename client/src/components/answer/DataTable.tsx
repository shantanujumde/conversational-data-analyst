import type { CellValue, Column } from '@cda/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatValue } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DataTableProps {
  columns: readonly Column[];
  rows: readonly Record<string, CellValue>[];
  caption: string;
}

const isNumeric = (c: Column) => c.format !== 'text';

/** The rows as a ruled ledger table. Numbers sit right-aligned in tabular figures. */
export function DataTable({ columns, rows, caption }: DataTableProps) {
  return (
    <Table
      className="text-[15px]"
      containerClassName="max-h-[420px] overflow-auto border-y border-rule"
    >
      <caption className="sr-only">{caption}</caption>
      <TableHeader className="sticky top-0 bg-sheet">
        <TableRow className="border-rule hover:bg-transparent">
          {columns.map((c) => (
            <TableHead
              key={c.key}
              scope="col"
              className={cn(
                'h-9 px-3 text-[13px] font-normal text-ink-soft first:pl-0',
                isNumeric(c) && 'text-right',
              )}
            >
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i} className="border-rule hover:bg-cover-wash/40">
            {columns.map((c) => {
              const value = row[c.key] ?? null;
              return (
                <TableCell
                  key={c.key}
                  className={cn(
                    'px-3 py-2 text-ink first:pl-0',
                    isNumeric(c) && 'tabular text-right',
                    // Red is kept for refusals, errors and the REJECTED status only.
                    value === 'REJECTED' && 'text-stamp',
                  )}
                >
                  {formatValue(value, c.format)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
