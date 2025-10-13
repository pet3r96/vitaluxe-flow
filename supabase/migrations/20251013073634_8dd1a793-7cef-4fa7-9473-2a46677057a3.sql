-- Update Pharmacy Terms and Conditions to Version 3 (11 sections)
UPDATE terms_and_conditions
SET 
  title = 'Pharmacy Terms and Conditions',
  content = '## 1. AGREEMENT TO TERMS

By accessing and using VitaLuxe services as a pharmacy partner, you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice, EFFECTIVE upon execution of this agreement.

## 2. PHARMACY RESPONSIBILITIES

- Maintain valid pharmacy licenses in all states where services are provided.
- Comply with all applicable federal, state, and local pharmacy laws and regulations.
- Maintain appropriate inventory levels to ensure timely order fulfillment.
- Provide accurate and timely processing and dispensing of medications and products.
- Maintain proper storage, handling, and security conditions for all products.
- Maintain professional and ethical standards in all interactions.

## 3. ORDER FULFILLMENT

- Process and fulfill orders within agreed-upon timeframes.
- Ensure accuracy in dispensing medications and products according to prescribed orders.
- Provide tracking information and timely updates for all shipments.
- Report any delays or issues affecting order fulfillment promptly to VitaLuxe.

## 4. QUALITY ASSURANCE

- Source medications and products only from approved and licensed suppliers.
- Maintain strict adherence to proper handling, storage, and dispensing procedures.
- Immediately report any product quality, safety, or recall issues to VitaLuxe.
- Maintain accurate records and documentation related to inventory and order fulfillment.

## 5. COMPLIANCE

- Comply with DEA regulations and all other relevant laws regarding controlled substances.
- Maintain HIPAA compliance and safeguard all protected patient information in accordance with applicable laws.
- Report adverse events, product complaints, or safety concerns as required by law and company policy.
- Cooperate fully with any audits, inspections, or investigations conducted by VitaLuxe or regulatory authorities.

## 6. PAYMENT TERMS

- Payment terms shall be as defined in the separate partner agreement between the Pharmacy and VitaLuxe.
- Accurate and timely invoicing is required for all fulfilled orders.
- Any disputes regarding payment will follow the dispute resolution process outlined in this agreement.
- Late payments or billing irregularities may result in suspension or termination of partnership.

## 7. TERMINATION

- VitaLuxe reserves the right to terminate this agreement immediately for cause, including but not limited to non-compliance, license revocation, or unethical conduct.
- Either party may terminate this agreement with 30 days written notice.
- Upon termination, the Pharmacy must cease use of all VitaLuxe branding, materials, and systems.

## 8. LIMITATION OF LIABILITY

- VitaLuxe shall not be liable for any indirect, incidental, special, or consequential damages arising from this agreement or pharmacy services.
- The Pharmacy''s sole remedy for any dispute shall be limited to unpaid amounts due and properly invoiced at the time of dispute.

## 9. NON-DISCLOSURE AND CONFIDENTIALITY

- All proprietary, technical, pricing, patient, and business information disclosed by VitaLuxe must be kept confidential.
- The Pharmacy agrees not to disclose or misuse any confidential information during or after the term of this agreement.
- Obligations under this section survive termination of this agreement.

## 10. MODIFICATIONS

- VitaLuxe may modify these terms and conditions at any time with written notice.
- Continued use of VitaLuxe services implies acceptance of any modifications.

## 11. DISPUTE RESOLUTION

- Any disputes arising under or related to this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered.
- If mediation is unsuccessful, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association.
- Each party shall bear its own legal fees and costs.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'pharmacy';