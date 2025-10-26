import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get request body
    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch invoice with rep details
    const { data: invoice, error: invoiceError } = await supabase
      .from('practice_development_fee_invoices')
      .select(`
        *,
        reps!practice_development_fee_invoices_topline_rep_id_fkey (
          id,
          user_id,
          profiles (
            name,
            email
          )
        )
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse template data
    const templateData = invoice.invoice_template_data as {
      line_items: Array<{
        description: string;
        quantity: number;
        rate: number;
        amount: number;
      }>;
      notes: string;
      subtotal: number;
      total_due: number;
    };

    // Generate PDF using jsPDF
    const jsPDFModule = await import('https://esm.sh/jspdf@2.5.1');
    const jsPDF = jsPDFModule.default;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header - Company Info
    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235); // Primary blue
    doc.text('VITALUXE SERVICES, LLC', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray
    doc.text('123 Example Blvd, Palm Beach, FL 33480', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 5;
    doc.text('accounts@vitaluxeservices.com | (800) 555-1234', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, yPos, pageWidth - 15, yPos);
    
    yPos += 10;

    // Invoice Details
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(`INVOICE #: ${invoice.invoice_number}`, 15, yPos);
    doc.text(`DATE: ${new Date(invoice.invoice_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth - 15, yPos, { align: 'right' });
    
    yPos += 8;
    const repName = invoice.reps?.profiles?.name || 'Unknown Rep';
    const repEmail = invoice.reps?.profiles?.email || '';
    doc.text(`BILL TO: ${repName}`, 15, yPos);
    
    yPos += 6;
    doc.setFontSize(10);
    doc.text(`EMAIL: ${repEmail}`, 15, yPos);
    
    yPos += 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, yPos, pageWidth - 15, yPos);
    
    yPos += 8;

    // Invoice Title and Details
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Description:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text('Monthly Practice Development Fee — Administrative & Educational Support', 50, yPos);
    
    yPos += 6;
    const billingMonth = new Date(invoice.billing_month);
    const billingPeriodStart = new Date(billingMonth.getFullYear(), billingMonth.getMonth(), 1);
    const billingPeriodEnd = new Date(billingMonth.getFullYear(), billingMonth.getMonth() + 1, 0);
    doc.setFont(undefined, 'bold');
    doc.text('Billing Period:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(`${billingPeriodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${billingPeriodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 50, yPos);
    
    yPos += 6;
    doc.setFont(undefined, 'bold');
    doc.text('Payment Terms:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text('Net 15 Days', 50, yPos);
    
    yPos += 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, yPos, pageWidth - 15, yPos);
    
    yPos += 8;

    // Line Items Table Header
    doc.setFillColor(249, 250, 251);
    doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F');
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('#', 20, yPos);
    doc.text('Description', 30, yPos);
    doc.text('Qty', 130, yPos);
    doc.text('Rate', 150, yPos);
    doc.text('Amount', pageWidth - 20, yPos, { align: 'right' });
    
    yPos += 8;
    doc.setFont(undefined, 'normal');

    // Line Items
    templateData.line_items.forEach((item, index) => {
      const lineNumber = (index + 1).toString();
      doc.text(lineNumber, 20, yPos);
      
      // Wrap description if too long
      const maxDescWidth = 95;
      const descLines = doc.splitTextToSize(item.description, maxDescWidth);
      doc.text(descLines, 30, yPos);
      
      doc.text(item.quantity.toString(), 130, yPos);
      doc.text(`$${item.rate.toFixed(2)}`, 150, yPos);
      doc.text(`$${item.amount.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
      
      yPos += Math.max(6, descLines.length * 5);
      
      // Draw separator line
      doc.setDrawColor(229, 231, 235);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 4;
    });

    yPos += 4;

    // Totals
    doc.setFont(undefined, 'bold');
    doc.text('Subtotal:', pageWidth - 60, yPos);
    doc.text(`$${templateData.subtotal.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
    
    yPos += 6;
    doc.setFontSize(12);
    doc.text('Total Due:', pageWidth - 60, yPos);
    doc.text(`$${templateData.total_due.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
    
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const dueDate = new Date(invoice.due_date);
    doc.text(`Due Date: ${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth - 20, yPos, { align: 'right' });
    
    yPos += 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(15, yPos, pageWidth - 15, yPos);
    
    yPos += 8;

    // Notes Section
    doc.setFont(undefined, 'bold');
    doc.text('NOTES:', 15, yPos);
    yPos += 6;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(templateData.notes, pageWidth - 30);
    notesLines.forEach((line: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 15, yPos);
      yPos += 5;
    });

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    // Upload to storage
    const filePath = `${invoice.topline_rep_id}/${invoice.invoice_number}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('practice-development-invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update invoice with PDF URL
    const { error: updateError } = await supabase
      .from('practice_development_fee_invoices')
      .update({ pdf_url: filePath })
      .eq('id', invoice_id);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
    }

    // Get signed URL
    const { data: signedUrlData } = await supabase.storage
      .from('practice-development-invoices')
      .createSignedUrl(filePath, 3600); // 1 hour

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: signedUrlData?.signedUrl,
        invoice_number: invoice.invoice_number
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});