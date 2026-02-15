// ============================================
// Legal Swarm
// Coordinates legal agents for company incorporation.
// MVP: Delaware C-Corp via Stripe Atlas only.
// Status flow: filing -> pending_ein -> pending_bank -> active
// ============================================

import { createLogger, generateId } from '@acbi/utils';

type IncorporationStatus = 'filing' | 'pending_ein' | 'pending_bank' | 'active' | 'failed';

interface IncorporationParams {
  companyName: string;
  jurisdiction: string;
  entityType: string;
  founders: Array<{ name: string; email: string; equityPercent: number; role: string }>;
  registeredAgent?: string;
}

interface IncorporationRecord {
  companyId: string;
  companyName: string;
  jurisdiction: string;
  entityType: string;
  founders: Array<{ name: string; email: string; equityPercent: number; role: string }>;
  registeredAgent?: string;
  status: IncorporationStatus;
  ein?: string;
  bankAccountId?: string;
  stripeAtlasApplicationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const logger = createLogger('legal-swarm');

export class LegalSwarm {
  private records = new Map<string, IncorporationRecord>();

  /**
   * Start the incorporation process for a new company.
   * MVP: Only supports Delaware C-Corp via Stripe Atlas.
   */
  async incorporateCompany(params: IncorporationParams): Promise<{
    companyId: string;
    status: IncorporationStatus;
    message: string;
  }> {
    // MVP validation: only Delaware C-Corp supported
    if (params.jurisdiction !== 'US-DE') {
      logger.warn({ jurisdiction: params.jurisdiction }, 'Non-Delaware jurisdiction requested, defaulting to US-DE');
    }

    if (params.entityType !== 'C-Corp') {
      logger.warn({ entityType: params.entityType }, 'Non-C-Corp entity type requested, defaulting to C-Corp');
    }

    const companyId = generateId('company');

    const record: IncorporationRecord = {
      companyId,
      companyName: params.companyName,
      jurisdiction: 'US-DE', // MVP: always Delaware
      entityType: 'C-Corp',  // MVP: always C-Corp
      founders: params.founders,
      registeredAgent: params.registeredAgent,
      status: 'filing',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.records.set(companyId, record);

    // Placeholder: Stripe Atlas API integration
    // In production, this would submit the application to Stripe Atlas
    // and track the application ID for status polling.
    const _stripeAtlasApplicationId = await this.submitToStripeAtlas(record);
    record.stripeAtlasApplicationId = _stripeAtlasApplicationId;

    logger.info(
      { companyId, companyName: params.companyName },
      'Incorporation filing started via Stripe Atlas',
    );

    return {
      companyId,
      status: record.status,
      message: `Incorporation filing started for ${params.companyName} (Delaware C-Corp via Stripe Atlas)`,
    };
  }

  /**
   * Request an EIN from the IRS for an incorporated company.
   */
  async requestEIN(companyId: string): Promise<{
    companyId: string;
    status: IncorporationStatus;
    message: string;
  }> {
    const record = this.records.get(companyId);

    if (!record) {
      throw new Error(`Company not found: ${companyId}`);
    }

    if (record.status !== 'filing') {
      throw new Error(`Cannot request EIN in status: ${record.status}. Expected: filing`);
    }

    // Placeholder: IRS EIN application via Stripe Atlas
    // In production, Stripe Atlas handles EIN application automatically
    // as part of the incorporation flow.
    record.status = 'pending_ein';
    record.updatedAt = new Date();

    logger.info({ companyId }, 'EIN request submitted');

    return {
      companyId,
      status: record.status,
      message: 'EIN application submitted via Stripe Atlas',
    };
  }

  /**
   * Open a bank account for the incorporated company.
   */
  async openBankAccount(companyId: string): Promise<{
    companyId: string;
    status: IncorporationStatus;
    bankAccountId?: string;
    message: string;
  }> {
    const record = this.records.get(companyId);

    if (!record) {
      throw new Error(`Company not found: ${companyId}`);
    }

    if (record.status !== 'pending_ein') {
      throw new Error(`Cannot open bank account in status: ${record.status}. Expected: pending_ein`);
    }

    // Placeholder: Mercury API integration
    // In production, this would create a Mercury business banking account.
    // Mercury offers API access for automated account opening.
    const bankAccountId = generateId('bank');
    record.bankAccountId = bankAccountId;
    record.status = 'pending_bank';
    record.updatedAt = new Date();

    // Simulate bank account activation
    // In production, this would be handled via webhook callback.
    setTimeout(() => {
      const rec = this.records.get(companyId);
      if (rec && rec.status === 'pending_bank') {
        rec.status = 'active';
        rec.updatedAt = new Date();
        logger.info({ companyId }, 'Bank account activated, company is now active');
      }
    }, 5000);

    logger.info({ companyId, bankAccountId }, 'Bank account opening initiated via Mercury');

    return {
      companyId,
      status: record.status,
      bankAccountId,
      message: 'Bank account opening initiated via Mercury. Will activate once approved.',
    };
  }

  /**
   * Get the current incorporation status for a company.
   */
  getStatus(companyId: string): IncorporationRecord | undefined {
    return this.records.get(companyId);
  }

  // ============================================
  // Placeholder Integration Methods
  // ============================================

  /**
   * Placeholder: Submit incorporation application to Stripe Atlas.
   * @see https://stripe.com/atlas
   */
  private async submitToStripeAtlas(_record: IncorporationRecord): Promise<string> {
    // TODO: Implement Stripe Atlas API integration
    // POST https://api.stripe.com/v1/atlas/applications
    // Required: company name, founders, entity type, jurisdiction
    logger.debug('Placeholder: Stripe Atlas submission');
    return `atlas_${generateId('app')}`;
  }

  /**
   * Placeholder: Create legal documents via Clerky.
   * @see https://www.clerky.com/
   */
  async generateDocumentsViaClerky(_companyId: string): Promise<string[]> {
    // TODO: Implement Clerky API integration
    // Generates: Certificate of Incorporation, Bylaws, Board Consent,
    // Stock Purchase Agreements, IP Assignment, etc.
    logger.debug('Placeholder: Clerky document generation');
    return ['certificate_of_incorporation', 'bylaws', 'board_consent'];
  }
}
