-- Update Provider Terms and Conditions with proper formatting
UPDATE public.terms_and_conditions
SET 
  title = 'Provider Terms and Conditions',
  content = '# PROVIDER TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS

By joining VitaLuxe as a Provider (Practice/Spa/Clinic), you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice EFFECTIVE, upon execution of this agreement.

## 2. PROVIDER RESPONSIBILITIES

- Adhere to standard business practices when servicing products provided by VitaLuxe and its partners
- Ensure compliance with all applicable federal, state, and local laws, regulations, and guidelines, including healthcare, licensure, and product use
- Verify that all prospective customers have appropriate licensure and qualifications to purchase products
- Maintain professional and ethical conduct at all times
- Accurately represent VitaLuxe products and services without misrepresentation or misleading marketing

## 3. PRODUCT AND SERVICE USE

- No medical billing is allowed for any products or services offered through VitaLuxe technology and partners
- A licensed physician must evaluate each patient and may only issue prescriptions based on medical necessity and proper clinical evaluation
- No guarantees of medical outcomes or financial returns may be made

## 4. COMPLIANCE AND LEGAL OBLIGATIONS

- Comply with all relevant federal, state, and local laws, including HIPAA, FDA regulations, and anti-kickback statutes
- No financial incentives, rebates, or compensatory agreements may be offered to healthcare providers or staff that violate federal anti-kickback laws
- All arrangements must adhere to safe harbor provisions under the federal anti-kickback statute
- Avoid conflicts of interest and ensure all marketing and promotional activities are truthful and not misleading

## 5. AUDITS AND COOPERATION

- VitaLuxe reserves the right to audit your operations, including records related to the use of VitaLuxe''s technology, services, and products
- You agree to cooperate with any audit or investigation, providing access to records, systems, and personnel as necessary
- Failure to cooperate with audits may result in immediate termination of this agreement

## 6. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, pricing, product, and client information is confidential
- You agree not to disclose or misuse confidential information during or after your term with VitaLuxe
- Confidential materials must be returned or destroyed upon termination
- Obligations under this section survive termination of the relationship

## 7. TERMINATION

- Either party may terminate this agreement with 30 days written notice
- VitaLuxe may terminate immediately for cause, including compliance violations or unethical conduct
- Upon termination, you must cease use of VitaLuxe materials and representation

## 8. NON-SOLICITATION AND NON-COMPETE

- For 12 months after termination, you may not solicit VitaLuxe clients, providers, or practices for a competing business
- You may not use confidential information to engage in or support a competing business
- Circumvention of VitaLuxe''s structure or supplier relationships is prohibited

## 9. INDEPENDENT PRACTICE STATUS

- You are an independent provider, not an employee or agent of VitaLuxe
- You are responsible for your own taxes, expenses, insurance, and legal compliance
- No partnership, joint venture, or employment relationship is created

## 10. LIMITATION OF LIABILITY

- VitaLuxe is not liable for any indirect, incidental, or consequential damages
- Your sole remedy is limited to unpaid amounts owed and approved at the time of dispute

## 11. MODIFICATIONS

- VitaLuxe may modify these terms at any time with written notice
- Continued participation implies acceptance of updated terms

## 12. DISPUTE RESOLUTION

- Any disputes arising from this agreement shall first be submitted to non-binding mediation in the state where VitaLuxe is headquartered
- If unresolved, disputes shall proceed to binding arbitration under the rules of the American Arbitration Association
- Each party shall bear its own legal fees and costs

## 13. INSURANCE AND INDEMNIFICATION

- Provider agrees to maintain all necessary professional and general liability insurance
- Provider shall indemnify, defend, and hold harmless VitaLuxe, its affiliates, officers, and employees from any and all claims, damages, liabilities, costs, and expenses arising from Provider''s use of VitaLuxe''s products or services, or from any breach of this agreement

## 14. INTELLECTUAL PROPERTY RIGHTS

- Provider acknowledges that all intellectual property rights related to VitaLuxe products, trademarks, and technology are the sole property of VitaLuxe
- Provider agrees not to use, copy, or distribute any proprietary materials without prior written consent from VitaLuxe

## 15. DATA PRIVACY AND SECURITY

- Provider shall comply with all applicable data privacy and security laws, including HIPAA where applicable
- Provider shall implement reasonable safeguards to protect patient and client information obtained through VitaLuxe technology or services

## 16. TRAINING AND CERTIFICATION

- Provider agrees to complete any required training or certification programs specified by VitaLuxe prior to utilizing its products or services

## 17. FORCE MAJEURE

- Neither party shall be liable for delays or failure to perform due to causes beyond their reasonable control, including acts of God, natural disasters, government actions, or pandemics

## 18. GOVERNING LAW

- This agreement shall be governed by and construed in accordance with the laws of the State of [State], without regard to conflict of laws principles

## 19. ENTIRE AGREEMENT

- This agreement constitutes the entire understanding between the parties regarding the subject matter and supersedes all prior agreements, oral or written',
  version = version + 1,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'provider'::app_role;