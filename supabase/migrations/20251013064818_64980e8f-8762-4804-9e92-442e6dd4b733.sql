-- Update Topline Representative Terms and Conditions to v3
UPDATE public.terms_and_conditions
SET 
  title = 'Topline Representative Terms and Conditions',
  content = '# TOPLINE REPRESENTATIVE TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS

By joining VitaLuxe as a Topline Representative, you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice **EFFECTIVE, upon execution of this agreement**.

## 2. REPRESENTATIVE RESPONSIBILITIES

- Recruit and manage downline representatives
- Build and maintain practice relationships
- Provide support to your downline team
- Maintain professional conduct at all times
- Accurately represent VitaLuxe products and services
- Avoid misrepresentation or misleading marketing practices

## 3. COMMISSION STRUCTURE

- Commission rates are set by VitaLuxe and subject to change
- Commissions are calculated based on verified order volume
- Payment terms are net 30 days
- Accurate reporting is required for commission payment
- Fraud, misreporting, or non-compliance may result in forfeiture

## 4. PRACTICE RECRUITMENT

- Ensure all prospective practices have valid medical licensure
- Provide accurate and truthful information to potential practices
- Comply with all marketing guidelines provided by VitaLuxe
- Maintain professional, ethical, and legally compliant relationships
- Report all new practice sign-ups through designated channels

## 5. COMPLIANCE

- Comply with all applicable federal, state, and local laws
- **No insurance billing is allowed** for any products or services
- A licensed physician must see each patient and prescribe based on medical necessity
- No guarantees of medical outcomes or financial returns may be made
- **Anti-kickback laws prohibit** offering any financial incentive or rebate to providers based on sales volume or prescriptions
- No financial arrangements may be made with practices or physicians that violate federal or state law
- Comply with HIPAA, FDA regulations, and anti-kickback statutes as applicable

## 6. NON-DISCLOSURE AND CONFIDENTIALITY

- All business, technical, pricing, product, and client information is confidential
- You agree not to disclose or misuse confidential information during or after your term with VitaLuxe
- Confidential materials must be returned or destroyed upon termination
- Obligations under this section survive termination of the relationship

## 7. AUDITS AND OVERSIGHT

- VitaLuxe may audit your activities for compliance at any time
- You must cooperate with any review, investigation, or audit
- Violations may result in immediate termination and legal action

## 8. TERMINATION

- Either party may terminate this agreement with 30 days written notice
- VitaLuxe may terminate immediately for cause, including compliance violations, misrepresentation, or unethical conduct
- Outstanding commissions earned prior to termination will be paid per Company policy
- Upon termination, you must cease use of VitaLuxe materials and representation

## 9. NON-SOLICITATION AND NON-COMPETE

- For **12 months after termination**, you may not solicit VitaLuxe clients, providers, or practices for a competing business
- You may not use confidential information to engage in or support a competing business
- Circumvention of VitaLuxe''s structure or supplier relationships is prohibited

## 10. INDEPENDENT CONTRACTOR STATUS

- You are an independent contractor, **not an employee or agent** of VitaLuxe
- You are responsible for your own taxes, expenses, insurance, and legal compliance
- No partnership, joint venture, or employment relationship is created

## 11. LIMITATION OF LIABILITY

- VitaLuxe is not liable for any indirect, incidental, or consequential damages
- Your sole remedy is limited to unpaid commissions earned and approved at the time of dispute

## 12. MODIFICATIONS

- VitaLuxe may modify these terms at any time with written notice
- Continued participation implies acceptance of updated terms

## 13. GOVERNING LAW

- These terms are governed by the laws of the State of [Insert State]
- Disputes shall be resolved in the courts of [Insert County, State]',
  version = 3,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'topline'::app_role;