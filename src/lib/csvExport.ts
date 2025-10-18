import { format } from "date-fns";

export const downloadCSV = (
  data: any[],
  headers: string[],
  filename: string
) => {
  const csvContent = [
    headers.join(","),
    ...data.map(row => 
      row.map((cell: any) => {
        // Escape commas and quotes in cell content
        const cellStr = String(cell ?? "");
        if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${format(new Date(), "yyyy-MM-dd_HHmmss")}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
