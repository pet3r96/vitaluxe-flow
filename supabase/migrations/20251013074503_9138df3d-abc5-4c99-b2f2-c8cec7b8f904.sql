-- Update Provider Terms and Conditions to Version 6 (20 sections)
UPDATE terms_and_conditions
SET 
  title = 'Provider Terms and Conditions',
  content = '## 1. AGREEMENT TO TERMS

By joining VitaLuxe as a Provider (Practice/Spa/Clinic), you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice EFFECTIVE upon execution of this agreement.

## 2. PROVIDER RESPONSIBILITIES

- Adhere to standard business practices when servicing products provided by VitaLuxe and its partners.
- Maintain valid business and provider licensure as applicable.
- Ensure compliance with all applicable federal, state, and local laws, regulations, and guidelines, including healthcare, licensure, and product use.
- Verify that all prospective customers (providers) have appropriate licensure and qualifications to purchase and/or use products.
- Maintain professional and ethical conduct at all times.
- Accurately represent VitaLuxe products and services without misrepresentation or misleading marketing.
- Ensure internal staff and providers are properly trained on products and services offered by VitaLuxe.

## 3. PRODUCT AND SERVICE USE

- No medical billing is allowed for any products or services offered through VitaLuxe technology and partners.
- A licensed physician must evaluate each patient and may only issue prescriptions based on medical necessity and proper clinical evaluation.
- No guarantees of medical outcomes or financial returns may be made.
- VitaLuxe is not responsible for patient outcomes related to provider misuse or deviation from product guidelines.

## 4. COMPLIANCE AND LEGAL OBLIGATIONS

- Comply with all relevant federal, state, and local laws, including HIPAA, FDA regulations, and anti-kickback statutes.
- No financial incentives, rebates, or compensatory agreements may be offered to healthcare providers or staff that violate federal anti-kickback laws.
- All arrangements must adhere to safe harbor provisions under the federal anti-kickback statute.
- Avoid conflicts of interest and ensure all marketing and promotional activities are truthful and not misleading.
- Practices must not promote or advertise off-label use or make unauthorized medical claims about any product.

## 5. MARKETING AND BRAND USAGE

- Use of VitaLuxe trademarks, branding, and materials must follow brand guidelines provided by VitaLuxe.
- Practices must not alter or create derivative materials without written approval.
- Any use of VitaLuxe''s name in advertising or promotional campaigns must be approved in writing.

## 6. PATIENT SAFETY AND REPORTING

- Promptly report any adverse events, product complaints, or safety concerns involving VitaLuxe products or services.
- Maintain systems for documenting patient feedback, incidents, and complaints.
- Cooperate with any investigations into adverse events or compliance issues.

## 7. AUDITS AND COOPERATION

- VitaLuxe reserves the right to audit your operations, including records related to the use of VitaLuxe''s technology, services, and products.
- You agree to cooperate fully with any audit or investigation, including providing access to records, systems, and personnel as necessary.
- Failure to cooperate with audits may result in immediate termination of this agreement.

## 8. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, pricing, product, and client information is confidential.
- You agree not to disclose or misuse confidential information during or after your term with VitaLuxe.
- Confidential materials must be returned or destroyed upon termination.
- Obligations under this section survive termination of the relationship.

## 9. INSURANCE REQUIREMENTS

- The Practice agrees to maintain adequate professional liability insurance and general business insurance.
- VitaLuxe may request proof of insurance at any time.

## 10. RECORD-KEEPING

- The Practice must maintain accurate records related to VitaLuxe product usage, orders, prescriptions, and patient encounters.
- Records must be retained for at least the minimum period required under applicable law.
- VitaLuxe may request access to relevant records in the event of an audit, investigation, or legal matter.

## 11. DATA SECURITY AND SYSTEM USE

- Practices must maintain safeguards to protect patient data and comply with all HIPAA requirements (if applicable).
- Access to VitaLuxe portals, systems, or platforms must be authorized and used only for approved purposes.
- Any unauthorized access or data breach must be reported to VitaLuxe immediately.

## 12. TRAINING

- Practices must ensure that all staff and providers engaging with VitaLuxe services are trained on product handling, usage, and compliance obligations.
- VitaLuxe may provide training materials or sessions at its discretion.

## 13. INDEMNIFICATION

- The Practice agrees to indemnify, defend, and hold harmless VitaLuxe, its affiliates, directors, and employees from any claims, liabilities, damages, or legal costs arising from the Practice''s breach of these terms, negligence, or violation of law.

## 14. NON-SOLICITATION AND NON-COMPETE

- For 12 months after termination, you may not solicit VitaLuxe clients, providers, or practices for a competing business.
- You may not use confidential information to engage in or support a competing business.
- Circumvention of VitaLuxe''s structure, systems, or supplier relationships is prohibited.

## 15. TERMINATION

- Either party may terminate this agreement with 30 days written notice.
- VitaLuxe may terminate immediately for cause, including compliance violations, misuse of platform, or unethical conduct.
- Upon termination, you must cease use of VitaLuxe materials, systems, and representation.

## 16. INDEPENDENT PRACTICE STATUS

- You are an independent business or provider and not an employee or agent of VitaLuxe.
- You are responsible for your own taxes, expenses, insurance, legal compliance, and liabilities.
- No partnership, joint venture, or employment relationship is created.

## 17. LIMITATION OF LIABILITY

- VitaLuxe is not liable for any indirect, incidental, or consequential damages.
- Your sole remedy is limited to unpaid amounts owed and approved at the time of dispute.

## 18. FORCE MAJEURE

- Neither party shall be held liable for any failure or delay in performance due to events beyond reasonable control, including acts of God, war, government restrictions, natural disasters, pandemics, or disruptions in supply chains.

## 19. MODIFICATIONS

- VitaLuxe may modify these terms at any time with written notice.
- Continued participation following changes implies acceptance of updated terms.

## 20. DISPUTE RESOLUTION

- Any disputes arising from this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered.
- If unresolved, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association.
- Each party shall bear its own legal fees and costs.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'provider';