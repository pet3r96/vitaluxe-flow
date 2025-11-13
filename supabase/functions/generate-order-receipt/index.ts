import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import jsPDF from "https://esm.sh/jspdf@2.5.1";
import { validateGenerateReceiptRequest } from '../_shared/requestValidators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse and validate JSON
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateGenerateReceiptRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id } = requestData;

    if (!order_id) {
      throw new Error('order_id is required');
    }

    console.log('Generating receipt for order:', order_id);

    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_amount,
        subtotal_before_discount,
        discount_code,
        discount_percentage,
        discount_amount,
        shipping_total,
        merchant_fee_amount,
        merchant_fee_percentage,
        status,
        doctor_id,
        profiles (
          id,
          name,
          email,
          phone,
          address_street,
          address_city,
          address_state,
          address_zip,
          company
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError);
      throw new Error('Order not found');
    }

    // Check authorization - user must be the practice owner or admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin';
    const isPracticeOwner = order.doctor_id === user.id;

    if (!isAdmin && !isPracticeOwner) {
      throw new Error('Unauthorized to access this receipt');
    }

    // Fetch order lines
    const { data: orderLines, error: linesError } = await supabase
      .from('order_lines')
      .select(`
        id,
        quantity,
        price,
        products (
          name,
          dosage
        )
      `)
      .eq('order_id', order_id);

    if (linesError) {
      console.error('Order lines fetch error:', linesError);
      throw new Error('Failed to fetch order lines');
    }

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // VitalLuxe logo and header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('VitalLuxe', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Premium Healthcare Solutions', pageWidth / 2, 38, { align: 'center' });

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 45, pageWidth - 20, 45);

    // Invoice title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEIPT', pageWidth / 2, 58, { align: 'center' });

    // Order metadata
    let yPos = 72;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.text(`Date: ${orderDate}`, 20, yPos);
    yPos += 6;
    doc.text(`Invoice #: ${order.id.slice(0, 8).toUpperCase()}`, 20, yPos);
    yPos += 6;
    doc.text(`Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`, 20, yPos);
    yPos += 15;

    // Bill To section
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 20, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    const practice = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    if (practice) {
      doc.text(practice.name || 'N/A', 20, yPos);
      yPos += 5;

      // Only show company if it's different from name
      if (practice.company && practice.company !== practice.name) {
        doc.text(practice.company, 20, yPos);
        yPos += 5;
      }

      if (practice.address_street) {
        doc.text(practice.address_street, 20, yPos);
        yPos += 5;
      }

      if (practice.address_city && practice.address_state && practice.address_zip) {
        doc.text(`${practice.address_city}, ${practice.address_state} ${practice.address_zip}`, 20, yPos);
        yPos += 5;
      }

      if (practice.email) {
        doc.text(`Email: ${practice.email}`, 20, yPos);
        yPos += 5;
      }

      if (practice.phone) {
        doc.text(`Phone: ${practice.phone}`, 20, yPos);
        yPos += 5;
      }
    }

    yPos += 10;

    // Table headers
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 5, pageWidth - 40, 8, 'F');

    const colX = {
      description: 22,
      quantity: pageWidth - 90,
      unitPrice: pageWidth - 60,
      total: pageWidth - 32
    };

    doc.text('Description', colX.description, yPos);
    doc.text('Qty', colX.quantity, yPos);
    doc.text('Price', colX.unitPrice, yPos);
    doc.text('Total', colX.total, yPos, { align: 'right' });

    yPos += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    let subtotal = 0;

    orderLines?.forEach((line: any, index: number) => {
      const product = line.products;
      const productName = product?.name || 'Unknown Product';
      const dosage = product?.dosage ? ` (${product.dosage})` : '';
      const description = `${productName}${dosage}`;
      const quantity = line.quantity;
      const unitPrice = parseFloat(line.price);
      const lineTotal = quantity * unitPrice;
      subtotal += lineTotal;

      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      // Wrap long descriptions if needed
      const descriptionLines = doc.splitTextToSize(description, colX.quantity - colX.description - 5);
      doc.text(descriptionLines, colX.description, yPos);

      doc.text(quantity.toString(), colX.quantity, yPos);
      doc.text(`$${unitPrice.toFixed(2)}`, colX.unitPrice, yPos);
      doc.text(`$${lineTotal.toFixed(2)}`, colX.total, yPos, { align: 'right' });

      yPos += Math.max(6 * descriptionLines.length, 8);

      // Add light divider between rows
      if (index < orderLines.length - 1) {
        doc.setDrawColor(230, 230, 230);
        doc.line(20, yPos - 2, pageWidth - 20, yPos - 2);
      }
    });

    yPos += 5;

    // Divider line before totals
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 90, yPos, pageWidth - 20, yPos);

    yPos += 8;

    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const displaySubtotal = order.subtotal_before_discount || subtotal;
    doc.text('Subtotal:', pageWidth - 100, yPos);
    doc.text(`$${displaySubtotal.toFixed(2)}`, colX.total, yPos, { align: 'right' });

    yPos += 6;

    // Discount (if applicable)
    if (order.discount_percentage && order.discount_percentage > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text(`Discount (${order.discount_code} - ${order.discount_percentage}%):`, pageWidth - 100, yPos);
      doc.text(`-$${order.discount_amount.toFixed(2)}`, colX.total, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 6;
    }

    // Shipping & Handling
    if (order.shipping_total && order.shipping_total > 0) {
      doc.text('Shipping & Handling:', pageWidth - 100, yPos);
      doc.text(`$${order.shipping_total.toFixed(2)}`, colX.total, yPos, { align: 'right' });
      yPos += 6;
    }

    // Merchant Processing Fee (if applicable)
    if (order.merchant_fee_amount && order.merchant_fee_amount > 0) {
      doc.text(`Merchant Processing Fee (${order.merchant_fee_percentage}%):`, pageWidth - 100, yPos);
      doc.text(`$${order.merchant_fee_amount.toFixed(2)}`, colX.total, yPos, { align: 'right' });
      yPos += 6;
    }

    yPos += 2;

    // Total (includes shipping and merchant fee)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', pageWidth - 100, yPos);
    doc.text(`$${order.total_amount.toFixed(2)}`, colX.total, yPos, { align: 'right' });

    // Savings note
    if (order.discount_percentage && order.discount_percentage > 0) {
      yPos += 10;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(0, 128, 0);
      doc.text(`You saved $${order.discount_amount.toFixed(2)} with code ${order.discount_code}!`, 
        pageWidth / 2, yPos, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    // Footer
    const footerY = pageHeight - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
    doc.text('VitalLuxe - Premium Healthcare Solutions', pageWidth / 2, footerY + 4, { align: 'center' });

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');
    const pdfData = new Uint8Array(pdfBuffer);
    const fileName = `receipt_${order.id}_${Date.now()}.pdf`;
    const filePath = `${order.doctor_id}/${fileName}`;

    // Try uploading to S3 first, fallback to Supabase Storage
    let receiptUrl = '';
    let uploadMethod = 'supabase';

    try {
      const { data: s3Data, error: s3Error } = await supabase.functions.invoke('upload-to-s3', {
        body: {
          fileBuffer: Array.from(pdfData),
          fileName: filePath,
          contentType: 'application/pdf',
          metadata: {
            document_type: 'receipt',
            phi: 'false',
            order_id: order.id,
            practice_id: order.doctor_id
          }
        }
      });

      if (!s3Error && s3Data?.success && s3Data.s3_key) {
        // Get signed URL from S3
        const { data: urlData } = await supabase.functions.invoke('get-s3-signed-url', {
          body: {
            s3_key: s3Data.s3_key,
            expires_in: 3600 // 1 hour
          }
        });

        if (urlData?.signed_url) {
          receiptUrl = urlData.signed_url;
          uploadMethod = 's3';
          console.log('Receipt uploaded to S3:', s3Data.s3_key);
        }
      }
    } catch (s3Error) {
      console.warn('S3 upload failed, falling back to Supabase Storage:', s3Error);
    }

    // Fallback to Supabase Storage if S3 upload failed
    if (!receiptUrl) {
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload receipt');
      }

      // Generate signed URL (valid for 1 hour)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(filePath, 3600);

      if (urlError || !signedUrlData) {
        console.error('Signed URL error:', urlError);
        throw new Error('Failed to generate download URL');
      }

      receiptUrl = signedUrlData.signedUrl;
      console.log('Receipt uploaded to Supabase Storage:', fileName);
    }

    console.log(`Receipt generated successfully via ${uploadMethod}:`, fileName);

    return new Response(
      JSON.stringify({
        success: true,
        url: receiptUrl,
        fileName,
        upload_method: uploadMethod
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in generate-order-receipt:', error);
    
    // Log error to audit logs
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.functions.invoke('log-error', {
        body: {
          action_type: 'receipt_generation_error',
          entity_type: 'order',
          details: { error: error?.message || 'Unknown error' }
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred generating the receipt'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
