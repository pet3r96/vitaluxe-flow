-- Update Downline Representative Terms and Conditions to v3
UPDATE public.terms_and_conditions
SET 
  title = 'Downline Representative Terms and Conditions',
  content = '# DOWNLINE REPRESENTATIVE TERMS AND CONDITIONS

## 1. AGREEMENT TO TERMS

By joining VitaLuxe as a Downline Representative, you agree to be bound by these Terms and Conditions. These terms are subject to change at VitaLuxe''s discretion with written notice.

## 2. REPRESENTATIVE RESPONSIBILITIES

- Report directly to your assigned Topline Representative
- Assist in the recruitment of medical practices and providers
- Maintain relationships with enrolled practices as directed
- Provide accurate information about VitaLuxe''s offerings
- Uphold ethical and professional conduct at all times
- Support team activities and growth initiatives

## 3. COMMISSION STRUCTURE

- Commission rates are set by VitaLuxe and may change with notice
- Commissions are based on verified order volume from enrolled practices
- Payment terms are net 30 days
- Commission payments require accurate tracking and reporting
- Fraud, misrepresentation, or failure to follow guidelines may result in forfeiture

## 4. PRACTICE RECRUITMENT

- Only engage practices or providers with valid medical licensure
- Provide truthful and compliant information about products and services
- Do not promise or imply insurance coverage, medical outcomes, or financial guarantees
- Ensure that each patient is seen by a licensed physician and prescribed based on medical necessity
- All marketing activities must comply with VitaLuxe''s approved materials and standards

## 5. COMPLIANCE

- Adhere to all federal, state, and local laws and regulations
- No insurance billing is allowed under any circumstances
- No medical products or services may be provided without physician oversight
- No incentives, rebates, or commission-sharing with providers or practices is permitted
- Anti-kickback, HIPAA, and FDA regulations must be followed at all times
- Any violations must be reported immediately to your Topline Representative or VitaLuxe

## 6. NON-DISCLOSURE AND CONFIDENTIALITY

- All business information, pricing, provider data, and materials are confidential
- You may not use or share confidential information for personal gain or third-party benefit
- All materials must be returned or destroyed upon termination
- Confidentiality obligations continue after your relationship with VitaLuxe ends

## 7. AUDITS AND OVERSIGHT

- VitaLuxe and/or your Topline Representative may audit your activities at any time
- You must cooperate with all compliance reviews or investigations
- Non-compliant behavior may result in immediate termination and legal action

## 8. TERMINATION

- Either party may terminate this agreement with 30 days written notice
- VitaLuxe may terminate immediately for cause, including violations of compliance or ethics policies
- Final commissions earned before termination will be paid per Company policy
- All VitaLuxe materials must be discontinued and removed from use upon termination

## 9. NON-SOLICITATION AND NON-COMPETE

- For 12 months after termination, you may not solicit VitaLuxe clients, providers, or practices for a competing business
- You may not use confidential information to compete with or undermine VitaLuxe
- Circumventing VitaLuxe''s processes or provider relationships is prohibited

## 10. INDEPENDENT CONTRACTOR STATUS

- You are an independent contractor and not an employee of VitaLuxe or your Topline Representative
- You are solely responsible for taxes, expenses, insurance, and compliance with applicable laws
- No employment, agency, or partnership relationship is created by this agreement

## 11. LIMITATION OF LIABILITY

- VitaLuxe is not liable for any indirect, incidental, or consequential damages
- Your sole remedy is limited to approved commissions earned prior to any dispute

## 12. MODIFICATIONS

- VitaLuxe may update these terms at any time with written notice
- Continued participation constitutes acceptance of the updated terms',
  version = 3,
  effective_date = NOW(),
  updated_at = NOW()
WHERE role = 'downline'::app_role;