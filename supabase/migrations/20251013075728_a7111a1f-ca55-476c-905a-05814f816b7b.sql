-- Update pharmacy terms and conditions to PHARMACY REPRESENTATIVE TERMS AND CONDITIONS
UPDATE terms_and_conditions
SET 
  title = 'PHARMACY REPRESENTATIVE TERMS AND CONDITIONS',
  content = '## 1. AGREEMENT TO TERMS

By accessing and using VitaLuxe services as a pharmacy partner, you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice, EFFECTIVE upon execution of this agreement.

## 2. PHARMACY RESPONSIBILITIES

- Maintain valid pharmacy licenses in all states where services are provided.

- Comply with all applicable federal, state, and local pharmacy laws and regulations.

- Maintain appropriate inventory levels to ensure timely order fulfillment.

- Provide accurate and timely processing and dispensing of medications and products.

- Maintain proper storage, handling, and security conditions for all products.

- Maintain professional and ethical standards in all interactions.

- Promptly notify VitaLuxe of any changes in licensing status, disciplinary actions, or other compliance issues.

- Implement and maintain robust quality assurance systems, including tracking and handling of recalls or adverse events.

## 3. ORDER FULFILLMENT

- Process and fulfill orders within agreed-upon timeframes.

- Ensure accuracy in dispensing medications and products according to prescribed orders.

- Provide tracking information and timely updates for all shipments.

- Report any delays or issues affecting order fulfillment promptly to VitaLuxe.

## 4. QUALITY ASSURANCE AND PRODUCT SAFETY

- Source medications and products only from approved and licensed suppliers.

- Maintain strict adherence to proper handling, storage, and dispensing procedures.

- Immediately report any product quality, safety, or recall issues to VitaLuxe.

- Maintain accurate records and documentation related to inventory, order fulfillment, and product recalls.

- Cooperate fully with VitaLuxe and regulatory authorities during investigations related to product safety or compliance.

## 5. COMPLIANCE

- Comply with DEA regulations and all other relevant laws regarding controlled substances.

- Maintain HIPAA compliance and safeguard all protected patient information in accordance with applicable laws.

- Report adverse events, product complaints, or safety concerns as required by law and company policy.

- Cooperate fully with any audits, inspections, or investigations conducted by VitaLuxe or regulatory authorities.

## 6. PAYMENT TERMS

- VitaLuxe does not determine or make payments to the Pharmacy. Pricing is set by an external source or supplier ("Payor"), and all payments for fulfilled orders are made directly to the Pharmacy by that Payor.

- The Pharmacy agrees to invoice and receive payments in accordance with the pricing and payment terms established by the Payor.

- VitaLuxe is not responsible for any payment disputes or delays between the Pharmacy and the Payor.

- Any disputes regarding fulfillment or payment must be resolved directly between the Pharmacy and the Payor, unless otherwise agreed in writing.

## 7. RECORD-KEEPING AND REPORTING

- Maintain accurate records related to order fulfillment, inventory, patient information (where applicable), and payment transactions.

- Retain all records for at least the minimum period required under applicable law.

- Provide access to records as requested for audits or investigations by VitaLuxe or regulatory authorities.

## 8. DATA SECURITY AND CONFIDENTIALITY

- Safeguard all patient and proprietary data in accordance with HIPAA and applicable privacy laws.

- Ensure authorized access only to VitaLuxe portals, systems, or platforms and use such access solely for approved purposes.

- Promptly report any unauthorized access, data breach, or security incidents to VitaLuxe.

## 9. TERMINATION

- VitaLuxe reserves the right to terminate this agreement immediately for cause, including but not limited to non-compliance, license revocation, or unethical conduct.

- Either party may terminate this agreement with 30 days written notice.

- Upon termination, the Pharmacy must cease use of all VitaLuxe branding, materials, and systems.

## 10. NON-DISCLOSURE AND CONFIDENTIALITY

- All proprietary, technical, pricing, patient, and business information disclosed by VitaLuxe must be kept confidential.

- The Pharmacy agrees not to disclose or misuse any confidential information during or after the term of this agreement.

- Obligations under this section survive termination of this agreement.

## 11. INDEMNIFICATION

The Pharmacy agrees to indemnify, defend, and hold harmless VitaLuxe, its affiliates, officers, and employees from any claims, liabilities, damages, or legal costs arising from the Pharmacy''s breach of these terms, negligence, or violation of law.

## 12. LIMITATION OF LIABILITY

- VitaLuxe shall not be liable for any indirect, incidental, special, or consequential damages arising from this agreement or pharmacy services.

- The Pharmacy''s sole remedy for any dispute shall be limited to unpaid amounts due and properly invoiced at the time of dispute.

## 13. MODIFICATIONS

- VitaLuxe may modify these terms and conditions at any time with written notice.

- Continued use of VitaLuxe services implies acceptance of any modifications.

## 14. DISPUTE RESOLUTION

- Any disputes arising under or related to this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered.

- If mediation is unsuccessful, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association.

- Each party shall bear its own legal fees and costs.

## 15. FORCE MAJEURE

Neither party shall be held liable for any failure or delay in performance due to events beyond reasonable control, including acts of God, war, government restrictions, natural disasters, pandemics, or disruptions in supply chains.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'pharmacy';