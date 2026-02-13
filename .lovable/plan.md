

## Fix Critical Dependency Vulnerabilities

### Problem
The security scanner flags **jspdf** (version ^2.5.2) with **CVE-2025-68428** -- a critical path traversal vulnerability (CVSS 9.2). While this primarily affects Node.js builds (not browser usage), the scanner still flags it and it should be updated.

### Solution
Update `jspdf` from `^2.5.2` to `^4.0.0` and `jspdf-autotable` to its latest compatible version in `package.json`.

After updating, mark the dependency vulnerability findings as resolved in the security scan.

### Technical Details

**Files to modify:**

1. **`package.json`** -- Update dependency versions:
   - `jspdf`: `^2.5.2` to `^4.0.0`
   - `jspdf-autotable`: `^5.0.2` to latest compatible version

2. **`src/types/pdf.ts`** -- Verify type helpers still work with jspdf 4.0 API (the `jsPDF` type import and `lastAutoTable`/`internal` access patterns). Update if needed.

3. **6 files using jspdf** -- Verify import patterns still work (jsPDF default import, autoTable import). The core API (`new jsPDF()`, `doc.text()`, `doc.save()`, `autoTable()`) is expected to remain compatible. Any breaking changes will be addressed.

4. **Security findings** -- Delete the dependency vulnerability findings from the scan results after the fix is applied.

### Risk
Low -- jspdf 4.0 maintains backward compatibility for browser-based PDF generation. The breaking changes in 4.0 are primarily around Node.js permission model requirements, which don't apply to this browser-only usage.

