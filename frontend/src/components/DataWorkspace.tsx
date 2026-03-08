import { Table, Database } from "lucide-react";
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
      <div className="flex flex-col items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary">
            <Database className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">Data Workspace</h3>
            <p className="text-sm text-muted-foreground">
              Query results will appear here. Try asking the AI to "Show me active users" to see data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">Query Results</h2>
          <span className="text-xs text-muted-foreground">
            {data.length} row{data.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <div className="border border-border rounded-lg overflow-hidden animate-fade-in">
          <UITable>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className="text-xs font-semibold text-foreground uppercase tracking-wide"
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
                    "transition-colors",
                    i % 2 === 0 ? "bg-background" : "bg-muted/30"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell key={column} className="text-sm">
                      {column === "status" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-success" />
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
