import { useState } from "react";
import { Download, FileJson, FileText, FileSpreadsheet, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { DashboardConfig } from "@/types/dashboard";
import { exportDashboardAsJSON, exportDashboardAsCSV } from "@/lib/dashboard";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

interface ExportDropdownProps {
  dashboard: DashboardConfig;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function ExportDropdown({ dashboard, containerRef }: ExportDropdownProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportJSON = async () => {
    try {
      await exportDashboardAsJSON(dashboard);
      toast({ title: "Exported!", description: "Dashboard exported as JSON" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportCSV = async () => {
    try {
      await exportDashboardAsCSV(dashboard);
      toast({ title: "Exported!", description: "Dashboard exported as CSV" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      dashboard.widgets.forEach((widget) => {
        const worksheet = XLSX.utils.json_to_sheet(widget.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, widget.title.slice(0, 31));
      });

      XLSX.writeFile(workbook, `${dashboard.title.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
      toast({ title: "Exported!", description: "Dashboard exported as Excel" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportPNG = async () => {
    if (!containerRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
      });
      
      const link = document.createElement("a");
      link.download = `${dashboard.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast({ title: "Exported!", description: "Dashboard exported as PNG" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={isExporting}>
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
          <FileJson className="w-4 h-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
          <FileText className="w-4 h-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPNG} className="gap-2">
          <Image className="w-4 h-4" />
          Export as PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
