import { Icon } from "@/components/Icon";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataWorkspaceProps {
  data: any[];
}

export function DataWorkspace({ data }: DataWorkspaceProps) {
  if (data.length === 0) {
    return (
      <div className="flex-1 bg-obsidian-surface flex flex-col items-center justify-center p-12 relative">
        {/* Subtle background gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.03),transparent_40%)]" />

        <div className="relative max-w-lg w-full text-center space-y-8">
          {/* Abstract placeholder graphic */}
          <div className="grid grid-cols-6 grid-rows-6 gap-3 h-64 w-full opacity-40">
            <div className="col-span-4 row-span-3 bg-obsidian-surface-mid rounded-xl border border-obsidian-outline-variant/15 flex items-center justify-center">
              <div className="w-1/2 h-2 bg-obsidian-outline-variant/20 rounded-full" />
            </div>
            <div className="col-span-2 row-span-4 bg-obsidian-secondary-purple/10 rounded-xl border border-obsidian-secondary-purple/20 flex flex-col p-4 gap-2">
              <div className="w-full h-1/4 bg-obsidian-secondary-purple/10 rounded" />
              <div className="w-2/3 h-1/4 bg-obsidian-secondary-purple/10 rounded" />
            </div>
            <div className="col-span-2 row-span-3 bg-obsidian-surface-mid rounded-xl border border-obsidian-outline-variant/15 flex items-center justify-center overflow-hidden">
              <Icon name="database" className="text-obsidian-primary/40 text-4xl" filled />
            </div>
            <div className="col-span-4 row-span-2 bg-obsidian-surface-mid rounded-xl border border-obsidian-outline-variant/15 flex flex-col p-4 gap-2">
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded bg-obsidian-primary/10" />
                <div className="flex-1 h-8 rounded bg-obsidian-outline-variant/10" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-headline font-extrabold text-obsidian-on-surface tracking-tight">Data Workspace</h2>
            <p className="text-zinc-400 leading-relaxed max-w-md mx-auto">
              Query results will appear here. Try asking the AI to <span className="text-obsidian-primary italic">"Show me active users"</span> to see data visualization and table views.
            </p>
          </div>

          {/* Status Chips */}
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2 bg-obsidian-surface-mid px-4 py-2 rounded-lg border-l-2 border-obsidian-secondary-purple shadow-sm">
              <Icon name="bolt" size="sm" className="text-obsidian-secondary-purple" />
              <span className="font-label text-[11px] uppercase tracking-wider font-bold text-obsidian-secondary">Query Engine Ready</span>
            </div>
            <div className="flex items-center gap-2 bg-obsidian-surface-mid px-4 py-2 rounded-lg border-l-2 border-obsidian-primary shadow-sm">
              <Icon name="shield" size="sm" className="text-obsidian-primary" />
              <span className="font-label text-[11px] uppercase tracking-wider font-bold text-obsidian-primary">Sanitized Context</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="flex flex-col h-full bg-obsidian-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-obsidian-outline-variant/15">
        <div className="flex items-center gap-3">
          <Icon name="table_chart" size="sm" className="text-obsidian-primary" />
          <h2 className="text-sm font-bold text-white">Query Results</h2>
          <span className="px-2 py-0.5 bg-obsidian-surface-highest text-[10px] font-label text-obsidian-primary rounded">
            {data.length} ROW{data.length !== 1 ? "S" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <div className="border border-obsidian-outline-variant/10 rounded-lg overflow-hidden">
          <UITable>
            <TableHeader>
              <TableRow className="bg-obsidian-surface-low hover:bg-obsidian-surface-low border-b border-obsidian-outline-variant/10">
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className="text-[10px] font-label font-bold text-obsidian-on-surface-variant uppercase tracking-widest border-none"
                  >
                    {column.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow
                  key={i}
                  className={cn(
                    "transition-colors hover:bg-obsidian-surface-mid border-none",
                    i % 2 === 0 ? "bg-obsidian-surface" : "bg-obsidian-surface-low/50"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell key={column} className="text-sm text-obsidian-on-surface font-label border-none">
                      {column === "status" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-obsidian-primary" />
                          {row[column]}
                        </span>
                      ) : (
                        row[column]
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </UITable>
        </div>
      </div>
    </div>
  );
}
