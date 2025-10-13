UPDATE terms_and_conditions
SET 
  title = 'PROVIDER REPRESENTATIVE TERMS AND CONDITIONS',
  content = '## 1. AGREEMENT TO TERMS

By joining VitaLuxe as a Provider, you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice, effective upon execution of this agreement.

## 2. PROVIDER RESPONSIBILITIES

- Maintain valid provider licensure and practice within the scope of that license.
- Adhere to standard business and clinical practices when servicing products provided by VitaLuxe and its partners.
- Ensure compliance with all applicable federal, state, and local laws, regulations, and clinical guidelines.
- Maintain professional, ethical, and medically appropriate conduct at all times.
- Accurately represent VitaLuxe products and services without misrepresentation or misleading marketing.
- Ensure adequate understanding and training of VitaLuxe services, protocols, and clinical workflows.

## 3. PRODUCT AND SERVICE USE

- No medical billing is permitted for any products or services offered through VitaLuxe technology or partner network.
- A licensed physician must evaluate each patient and issue prescriptions only based on medical necessity and proper documentation.
- No guarantees may be made to patients or practices regarding medical outcomes or financial returns.
- VitaLuxe is not responsible for clinical outcomes related to provider deviation from approved product guidelines or protocols.

## 4. COMPLIANCE AND LEGAL OBLIGATIONS

- Comply with all applicable laws and regulations, including HIPAA, HITECH, FDA rules, and anti-kickback statutes.
- Avoid offering or receiving any form of compensation that violates federal or state anti-kickback or self-referral laws.
- Refrain from off-label promotion of products unless specifically authorized in writing.
- Immediately report any regulatory inquiries, audits, or investigations involving VitaLuxe-related services or products.
- Disclose any disciplinary action, loss or restriction of license, or pending investigation affecting your ability to legally practice.

## 5. MARKETING AND BRAND USAGE

- Use VitaLuxe marketing materials, branding, and trademarks only as authorized and in accordance with brand guidelines.
- Do not modify, misrepresent, or independently create materials referencing VitaLuxe without prior written approval.

## 6. PATIENT SAFETY AND REPORTING

- Promptly report all adverse events, product concerns, or patient safety incidents to VitaLuxe.
- Maintain proper clinical documentation to support treatment decisions, particularly for prescribed therapies.
- Cooperate with safety investigations, clinical reviews, or compliance audits initiated by VitaLuxe or its partners.

## 7. AUDITS AND COOPERATION

- You agree to cooperate with audits, inspections, or compliance reviews by VitaLuxe or authorized third parties.
- Provide timely access to records, systems, and communications relevant to VitaLuxe products or services.
- Refusal or obstruction may result in immediate suspension or termination of your participation.

## 8. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, clinical, pricing, and client information is strictly confidential.
- You may not disclose, duplicate, or use confidential information beyond the scope of your role.
- Obligations survive termination and include return or destruction of materials.

## 9. INSURANCE REQUIREMENTS

- You must be covered by professional liability insurance, either individually or through your Practice.
- Proof of insurance must be provided upon request and maintained without lapse.

## 10. RECORD-KEEPING

- Maintain or contribute to complete and accurate patient records and documentation related to prescriptions, treatments, and outcomes.
- Retain documentation in accordance with legal and regulatory standards.

## 11. DATA SECURITY AND SYSTEM USE

- Use VitaLuxe platforms only for their intended purpose and within the scope of your authorization.
- Maintain HIPAA-compliant safeguards to protect patient and business data.
- Report any unauthorized access or data breaches immediately.

## 12. TRAINING

- Participate in any required training programs provided or mandated by VitaLuxe.
- Ensure your knowledge remains current regarding product protocols, legal responsibilities, and safety requirements.

## 13. INDEMNIFICATION

You agree to indemnify, defend, and hold harmless VitaLuxe and its affiliates against claims, damages, or liabilities arising from your services, actions, or breach of these terms.

## 14. NON-SOLICITATION AND NON-COMPETE

- For 12 months following termination, you may not solicit VitaLuxe clients, providers, or affiliates for a competing business.
- You may not use proprietary or confidential information to build, support, or market a competing solution or service.

## 15. TERMINATION

- Either party may terminate this agreement with 30 days'' written notice.
- VitaLuxe may terminate immediately for cause, including non-compliance, unethical behavior, or misuse of the platform.

## 16. INDEPENDENT STATUS

- You are an independent provider and not an employee or agent of VitaLuxe.
- No partnership, joint venture, or employment relationship is created.

## 17. LIMITATION OF LIABILITY

- VitaLuxe is not liable for indirect, incidental, or consequential damages.
- The provider''s sole remedy is limited to unpaid, approved amounts at the time of a dispute.

## 18. FORCE MAJEURE

Neither party shall be held liable for delays or failure in performance due to events beyond their reasonable control, including natural disasters, pandemics, acts of government, or supply disruptions.

## 19. MODIFICATIONS

- VitaLuxe may update these terms with written notice.
- Continued use of VitaLuxe systems or services constitutes acceptance of revised terms.

## 20. DISPUTE RESOLUTION

- Disputes will first be subject to non-binding mediation in the state where VitaLuxe is headquartered.
- If unresolved, disputes will proceed to binding arbitration under the American Arbitration Association.
- Each party will bear its own legal costs.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'provider';