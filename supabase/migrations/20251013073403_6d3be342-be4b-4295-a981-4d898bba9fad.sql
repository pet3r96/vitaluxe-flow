UPDATE terms_and_conditions
SET 
  title = 'Practice Terms and Conditions',
  content = '## 1. AGREEMENT TO TERMS

- By joining VitaLuxe as a Practice (Clinic/Spa/Medical Facility), you agree to be bound by these Terms and Conditions.
- These terms are subject to change at VitaLuxe''s discretion with written notice, EFFECTIVE upon execution of this agreement.

## 2. PRACTICE RESPONSIBILITIES

- Operate in accordance with standard business practices when servicing products provided by VitaLuxe and its partners.
- Ensure compliance with all applicable federal, state, and local laws, regulations, and guidelines, including healthcare, licensure, and product use.
- Maintain oversight and responsibility for all healthcare providers, employees, contractors, and agents working within the Practice.
- Verify that all providers and staff hold valid licenses, certifications, and qualifications required to perform their duties and prescribe or administer products.
- Maintain professional and ethical conduct at all times.
- Accurately represent VitaLuxe products and services without misrepresentation or misleading marketing.

## 3. PROVIDER OVERSIGHT

- Ensure all healthcare providers within the Practice prescribe and administer products only within their scope of practice and licensing.
- Maintain responsibility for proper clinical evaluations and documentation by all providers.
- Ensure providers comply with all applicable laws, regulations, and VitaLuxe policies.

## 4. PRODUCT AND SERVICE USE

- No medical billing is allowed for any products or services offered through VitaLuxe technology and partners.
- A licensed physician must evaluate each patient and may only issue prescriptions based on medical necessity and proper clinical evaluation.
- No guarantees of medical outcomes or financial returns may be made.

## 5. COMPLIANCE AND LEGAL OBLIGATIONS

- Comply with all relevant federal, state, and local laws, including HIPAA, FDA regulations, and anti-kickback statutes.
- No financial incentives, rebates, or compensatory agreements may be offered to healthcare providers, staff, or third parties that violate federal anti-kickback laws.
- Ensure all arrangements comply with safe harbor provisions under the federal anti-kickback statute.
- Avoid conflicts of interest and ensure all marketing and promotional activities are truthful and not misleading.
- Maintain all necessary licenses, certifications, and professional liability insurance for the Practice and its providers.

## 6. PROFESSIONAL CONDUCT

- Ensure that all Practice providers and staff maintain professional standards of care.
- Maintain patient confidentiality and comply with all privacy laws.
- Enforce adherence to VitaLuxe policies and procedures throughout the Practice.

## 7. AUDITS AND COOPERATION

- VitaLuxe reserves the right to audit your Practice operations, including records related to the use of VitaLuxe''s technology, services, and products.
- The Practice agrees to cooperate fully with any audit or investigation, providing access to records, systems, personnel, and facilities as necessary.
- Failure to cooperate with audits may result in immediate termination of this agreement.

## 8. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, pricing, product, and client information is confidential.
- The Practice agrees not to disclose or misuse confidential information during or after the term of this agreement.
- Confidential materials must be returned or destroyed upon termination.
- Obligations under this section survive termination of the relationship.

## 9. TERMINATION

- Either party may terminate this agreement with 30 days written notice.
- VitaLuxe may terminate immediately for cause, including compliance violations, unethical conduct, or failure to maintain required licenses or insurance.
- Upon termination, the Practice must cease use of VitaLuxe materials and representation.

## 10. NON-SOLICITATION AND NON-COMPETE

- For 12 months after termination, the Practice may not solicit VitaLuxe clients, providers, or practices for a competing business.
- The Practice may not use confidential information to engage in or support a competing business.
- Circumvention of VitaLuxe''s structure or supplier relationships is prohibited.

## 11. INDEPENDENT PRACTICE STATUS

- The Practice is an independent entity, not an employee or agent of VitaLuxe.
- The Practice is responsible for its own taxes, expenses, insurance, and legal compliance.
- No partnership, joint venture, or employment relationship is created.

## 12. LIMITATION OF LIABILITY

- VitaLuxe is not liable for any indirect, incidental, or consequential damages.
- The Practice''s sole remedy is limited to unpaid amounts owed and approved at the time of dispute.

## 13. MODIFICATIONS

- VitaLuxe may modify these terms at any time with written notice.
- Continued participation implies acceptance of updated terms.

## 14. INSURANCE REQUIREMENTS

- The Practice must maintain appropriate professional liability insurance covering itself and all providers operating under it and provide proof of coverage upon request.
- Failure to maintain insurance may result in termination.

## 15. INDEMNIFICATION

- The Practice agrees to indemnify and hold harmless VitaLuxe, its affiliates, officers, and employees from any claims, damages, liabilities, or expenses arising from the Practice''s or its providers'' breach of this agreement or professional services.

## 16. FORCE MAJEURE

- Neither party shall be liable for delays or failure to perform due to causes beyond their reasonable control, including natural disasters, acts of government, or pandemics.

## 17. GOVERNING LAW

- This agreement shall be governed by and construed in accordance with the laws of the state where VitaLuxe is headquartered, without regard to conflict of law principles.

## 18. SEVERABILITY

- If any provision of this agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.

## 19. ENTIRE AGREEMENT

- This agreement constitutes the entire understanding between the parties regarding its subject matter and supersedes all prior agreements, whether written or oral.

## 20. DISPUTE RESOLUTION

- Any disputes arising from this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered.
- If unresolved, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association.
- Each party shall bear its own legal fees and costs.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'doctor';