-- Update Provider Terms and Conditions with corrected version (20 sections)
UPDATE terms_and_conditions
SET 
  title = 'Provider Terms and Conditions',
  content = '## 1. AGREEMENT TO TERMS

- By joining VitaLuxe as a Provider (Practice/Spa/Clinic), you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice, EFFECTIVE upon execution of this agreement.

## 2. PROVIDER RESPONSIBILITIES

- Adhere to standard business practices when servicing products provided by VitaLuxe and its partners.
- Ensure compliance with all applicable federal, state, and local laws, regulations, and guidelines, including healthcare, licensure, and product use.
- Verify that all prospective customers have appropriate licensure and qualifications to purchase products.
- Maintain professional and ethical conduct at all times.
- Accurately represent VitaLuxe products and services without misrepresentation or misleading marketing.

## 3. PRODUCT AND SERVICE USE

- No medical billing is allowed for any products or services offered through VitaLuxe technology and partners.
- A licensed physician must evaluate each patient and may only issue prescriptions based on medical necessity and proper clinical evaluation.
- No guarantees of medical outcomes or financial returns may be made.

## 4. PRESCRIPTION AUTHORITY

- Only prescribe medications or treatments you are authorized to prescribe.
- Conduct appropriate patient evaluations.
- Document all patient interactions properly.
- Report adverse events or concerns immediately to VitaLuxe as applicable.

## 5. COMPLIANCE AND LEGAL OBLIGATIONS

- Comply with all relevant federal, state, and local laws, including HIPAA, FDA regulations, and anti-kickback statutes.
- No financial incentives, rebates, or compensatory agreements may be offered to healthcare providers or staff that violate federal anti-kickback laws.
- All arrangements must adhere to safe harbor provisions under the federal anti-kickback statute.
- Avoid conflicts of interest and ensure all marketing and promotional activities are truthful and not misleading.
- Maintain valid medical licenses and certifications.
- Practice within your authorized scope.
- Maintain professional liability insurance and report any changes to licensure status.

## 6. PROFESSIONAL CONDUCT

- Maintain professional standards of care.
- Respect patient confidentiality at all times.
- Cooperate with VitaLuxe policies and procedures.

## 7. AUDITS AND COOPERATION

- VitaLuxe reserves the right to audit your operations, including records related to the use of VitaLuxe''s technology, services, and products.
- You agree to cooperate fully with any audit or investigation, providing access to records, systems, and personnel as necessary.
- Failure to cooperate with audits may result in immediate termination of this agreement.

## 8. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, pricing, product, and client information is confidential.
- You agree not to disclose or misuse confidential information during or after your term with VitaLuxe.
- Confidential materials must be returned or destroyed upon termination.
- Obligations under this section survive termination of the relationship.

## 9. TERMINATION

- Either party may terminate this agreement with 30 days written notice.
- VitaLuxe may terminate immediately for cause, including compliance violations or unethical conduct.
- Upon termination, you must cease use of VitaLuxe materials and representation.

## 10. NON-SOLICITATION AND NON-COMPETE

- For 12 months after termination, you may not solicit VitaLuxe clients, providers, or practices for a competing business.
- You may not use confidential information to engage in or support a competing business.
- Circumvention of VitaLuxe''s structure or supplier relationships is prohibited.

## 11. INDEPENDENT PRACTICE STATUS

- You are an independent provider, not an employee or agent of VitaLuxe.
- You are responsible for your own taxes, expenses, insurance, and legal compliance.
- No partnership, joint venture, or employment relationship is created.

## 12. LIMITATION OF LIABILITY

- VitaLuxe is not liable for any indirect, incidental, or consequential damages.
- Your sole remedy is limited to unpaid amounts owed and approved at the time of dispute.

## 13. MODIFICATIONS

- VitaLuxe may modify these terms at any time with written notice.
- Continued participation implies acceptance of updated terms.

## 14. INSURANCE REQUIREMENTS

- You must maintain appropriate professional liability insurance and provide proof of coverage upon request.
- Failure to maintain insurance may result in termination.

## 15. INDEMNIFICATION

- You agree to indemnify and hold harmless VitaLuxe, its affiliates, officers, and employees from any claims, damages, liabilities, or expenses arising from your breach of this agreement or your professional services.

## 16. FORCE MAJEURE

- Neither party shall be liable for delays or failure to perform due to causes beyond their reasonable control, including but not limited to natural disasters, acts of government, or pandemics.

## 17. GOVERNING LAW

- This agreement shall be governed by and construed in accordance with the laws of the state where VitaLuxe is headquartered, without regard to conflict of law principles.

## 18. SEVERABILITY

- If any provision of this agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.

## 19. ENTIRE AGREEMENT

- This agreement constitutes the entire understanding between the parties regarding its subject matter and supersedes all prior agreements, whether written or oral.

## 20. DISPUTE RESOLUTION

- Any disputes arising from this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered. If unresolved, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association. Each party shall bear its own legal fees and costs.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'provider';