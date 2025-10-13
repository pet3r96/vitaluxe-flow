-- Update Practice (Doctor role) Terms and Conditions with new 20-section content
UPDATE terms_and_conditions
SET 
  title = 'Practice Representative Terms and Conditions',
  content = '## 1. AGREEMENT TO TERMS

- By joining VitaLuxe as a Practice (Clinic/Spa/Medical Facility), you agree to be bound by these Terms and Conditions.
- These terms are subject to change at VitaLuxe''s discretion with written notice, effective upon execution of this agreement.

## 2. PRACTICE RESPONSIBILITIES

- Operate in accordance with standard business practices when servicing products provided by VitaLuxe and its partners.
- Ensure compliance with all applicable federal, state, and local laws, regulations, and guidelines, including those related to healthcare, licensure, and product use.
- Maintain oversight and responsibility for all healthcare providers, employees, contractors, and agents working within the Practice.
- Verify that all providers and staff hold valid licenses, certifications, and qualifications required to perform their duties and prescribe or administer products.
- Ensure that all staff and providers receive appropriate training on VitaLuxe product use, patient intake protocols, and compliance obligations.
- Maintain professional and ethical conduct at all times.
- Accurately represent VitaLuxe products and services without misrepresentation or misleading marketing.

## 3. PROVIDER OVERSIGHT

- Ensure all healthcare providers within the Practice prescribe and administer products only within their licensed scope of practice.
- The Practice is solely responsible for ensuring all medical decisions are made by licensed professionals based on medical necessity.
- Ensure proper clinical evaluations, documentation, and recordkeeping for all patient interactions and treatments.
- Prevent providers from making unauthorized or unsubstantiated claims about VitaLuxe products in any communications, advertising, or patient-facing content.

## 4. PRODUCT AND SERVICE USE

- No medical billing is allowed for any products or services offered through VitaLuxe technology and partners.
- A licensed physician must evaluate each patient and may only issue prescriptions based on medical necessity and appropriate clinical judgment.
- No guarantees of medical outcomes, product efficacy, or financial returns may be made by the Practice or its staff.

## 5. COMPLIANCE AND LEGAL OBLIGATIONS

- Comply with all relevant federal, state, and local laws, including HIPAA, FDA regulations, DEA requirements, and anti-kickback statutes.
- No financial incentives, rebates, or compensatory agreements may be offered to healthcare providers, staff, or third parties that violate federal anti-kickback laws or applicable state laws.
- Ensure all arrangements comply with the "safe harbor" provisions under the federal anti-kickback statute.
- Avoid conflicts of interest and ensure all marketing and promotional activities are truthful, not misleading, and legally compliant.
- Maintain all required licenses, certifications, and professional liability insurance for the Practice and all affiliated providers.

## 6. PROFESSIONAL CONDUCT

- Ensure that all Practice providers and staff maintain professional standards of care.
- Uphold patient privacy and confidentiality in accordance with HIPAA and other applicable laws.
- Enforce full compliance with VitaLuxe policies, clinical protocols, and operational standards across the Practice.

## 7. AUDITS AND COOPERATION

- VitaLuxe reserves the right to audit your Practice operations, including but not limited to records, communications, and procedures related to the use of VitaLuxe''s services and products.
- The Practice agrees to cooperate fully with any audit, inspection, or investigation and will provide timely access to relevant records, systems, personnel, and facilities.
- The Practice must maintain all relevant documentation for at least six (6) years or longer as required by law.
- Failure to cooperate with audits or investigations may result in immediate termination of this agreement.

## 8. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, pricing, product, partner, and client information shared by or on behalf of VitaLuxe is strictly confidential.
- The Practice agrees not to disclose, share, copy, or misuse confidential information during or after the term of this agreement.
- All confidential materials must be returned or securely destroyed upon termination.
- The obligations under this section shall survive termination of this agreement.

## 9. TERMINATION

- Either party may terminate this agreement with 30 days written notice.
- VitaLuxe may terminate this agreement immediately for cause, including any compliance violations, unethical conduct, misrepresentation, failure to cooperate, or failure to maintain required licenses or insurance.
- Upon termination, the Practice must cease using all VitaLuxe materials, branding, access, and representations.

## 10. NON-SOLICITATION AND NON-COMPETE

- For 12 months following termination, the Practice may not solicit or attempt to solicit VitaLuxe clients, providers, staff, vendors, or downline representatives for a competing business.
- The Practice may not use confidential information to engage in or support a competing or derivative business.
- Circumvention of VitaLuxe''s supplier network, partner relationships, or compensation structures is strictly prohibited.

## 11. INDEPENDENT PRACTICE STATUS

- The Practice is an independent entity and is not an employee, agent, or legal representative of VitaLuxe.
- No partnership, joint venture, or employment relationship is created by this agreement.
- The Practice is solely responsible for all expenses, taxes, payroll, benefits, and legal obligations of its personnel.

## 12. LIMITATION OF LIABILITY

- VitaLuxe shall not be liable for any indirect, incidental, punitive, or consequential damages, including loss of income, patients, or reputation.
- The Practice''s sole and exclusive remedy is limited to the payment of any outstanding, verified amounts owed and approved at the time of dispute.
- VitaLuxe is not responsible for any liability resulting from the Practice''s or its providers'' misuse, off-label use, or improper storage or handling of products.

## 13. MODIFICATIONS

- VitaLuxe may update, revise, or amend these Terms and Conditions at any time with written notice.
- Continued use of VitaLuxe services after notice constitutes acceptance of the revised terms.

## 14. INSURANCE REQUIREMENTS

- The Practice must maintain adequate professional liability, malpractice, and general business insurance for itself and its providers.
- Proof of active insurance coverage must be provided upon request by VitaLuxe.
- Failure to maintain required insurance may result in immediate termination of this agreement.

## 15. INDEMNIFICATION

The Practice agrees to indemnify, defend, and hold harmless VitaLuxe, its affiliates, officers, employees, and agents from any and all claims, losses, damages, liabilities, costs, or expenses (including attorney fees) arising from:

- The Practice''s breach of this agreement;
- Misuse of VitaLuxe''s products or services;
- Actions or omissions of the Practice''s staff, providers, or contractors.

## 16. FORCE MAJEURE

- Neither party shall be held liable for failure to perform due to causes beyond their reasonable control, including but not limited to: acts of God, natural disasters, labor shortages, acts of war, government action, cyberattacks, or pandemics.

## 17. GOVERNING LAW

- This agreement shall be governed by and interpreted under the laws of the state where VitaLuxe is headquartered, without regard to any conflict of law principles.

## 18. SEVERABILITY

- If any provision of this agreement is found to be invalid, illegal, or unenforceable, the remaining provisions shall remain in full force and effect.

## 19. ENTIRE AGREEMENT

- This agreement represents the entire understanding between the parties and supersedes all prior or contemporaneous agreements, representations, communications, or understandings, whether oral or written.

## 20. DISPUTE RESOLUTION

- Any disputes arising out of or relating to this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered.
- If unresolved, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association (AAA).
- Each party shall bear its own legal fees and costs, unless otherwise awarded in arbitration.',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'doctor';