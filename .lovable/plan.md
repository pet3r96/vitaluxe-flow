

## Fix: Use the Correct White-Text Logo for PDF Cover

The sidebar logo (white text, visible on dark backgrounds) already exists locally at `src/assets/vitaluxe-logo-dark-bg.png`. The PDF generator is currently fetching a different file from remote storage (`Vitaluxe Services.png`) which has grey text -- that's why it looks wrong on the dark cover.

### Changes in `src/lib/productCatalogPdfGenerator.ts`

**1. Import the local logo asset at the top of the file**
- Add: `import logoDarkBg from '@/assets/vitaluxe-logo-dark-bg.png';`

**2. Replace the `fetchLogo()` function**
- Instead of fetching from remote storage, convert the local imported asset to base64
- The imported asset gives us a URL we can fetch and convert

**3. No other changes needed**
- Logo dimensions (60x42mm) and spacing stay the same
- Cover background color stays as dark grey

### Technical Details

The Vite bundler resolves `import logoDarkBg from '@/assets/vitaluxe-logo-dark-bg.png'` to a URL string at build time. The existing `imageToBase64()` helper can convert that URL to a base64 data URI for jsPDF. This approach is simpler and more reliable than fetching from remote storage.
