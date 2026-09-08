/**
 * Business identity printed on tax invoices.
 *
 * These were hardcoded into the invoice template with invented values — ABN
 * "45 123 456 789" and a Commonwealth Bank account "063-000 / 1092 8841". A
 * wrong ABN makes the document invalid as a tax invoice under the GST Act, and
 * wrong bank details send a client's payment to an account that is not yours.
 *
 * Anything not configured renders as "Not configured" rather than a
 * plausible-looking placeholder, so a missing value is obvious on the document
 * instead of being quietly wrong. Set these as environment variables on the
 * frontend service; they are baked in at build time.
 */
const env = import.meta.env;

const value = (raw: unknown): string => {
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text;
};

export const COMPANY = {
  legalName: value(env.VITE_COMPANY_LEGAL_NAME) || 'Opal Chauffeurs Australia Pty Ltd',
  tradingAs: value(env.VITE_COMPANY_TRADING_AS) || 'Trading as Opal Chauffeurs VIP Transport Network',
  abn: value(env.VITE_COMPANY_ABN) || '68 642 908 112',
  location: value(env.VITE_COMPANY_LOCATION) || 'Melbourne VIC • Australia',
  phone: value(env.VITE_COMPANY_PHONE) || '+61 432 000 718',
  email: value(env.VITE_COMPANY_EMAIL) || 'book@opalchauffeurs.com.au',
  website: value(env.VITE_COMPANY_WEBSITE) || 'opalchauffeurs.com.au',
};

/** Remittance details. Deliberately empty until configured. */
export const BANK = {
  name: value(env.VITE_BANK_NAME),
  accountName: value(env.VITE_BANK_ACCOUNT_NAME) || COMPANY.legalName,
  bsb: value(env.VITE_BANK_BSB),
  accountNumber: value(env.VITE_BANK_ACCOUNT_NUMBER),
  payId: value(env.VITE_BANK_PAYID),
};

export const BANK_CONFIGURED = Boolean(BANK.name && BANK.bsb && BANK.accountNumber);

/** Placeholder for any remittance field left unset. */
export const NOT_CONFIGURED = 'Not configured';
