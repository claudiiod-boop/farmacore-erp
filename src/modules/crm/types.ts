// FarmaCore ERP — Tipos de Domínio do Módulo CRM, Fidelidade e Promoções (Fase 12)

// =============================================================
// 1. Enums e Tipos Literais
// =============================================================

export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'MANUAL_ADJUSTMENT';

export type PromotionType =
  | 'TAKE_MORE_PAY_LESS'
  | 'PROGRESSIVE_DISCOUNT'
  | 'COMBO_CROSS_SELL'
  | 'CLUB_SPECIAL_PRICE'
  | 'BIRTHDAY_DISCOUNT';

export type PromotionAppliesTo = 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'CATEGORY';

export type PromotionProductRole = 'TRIGGER' | 'REWARD' | 'BOTH';

export type TreatmentStatus = 'ACTIVE' | 'CONTACTED' | 'REFILLED' | 'DISCONTINUED';

// =============================================================
// 2. Fidelidade e Cashback (loyalty_programs, loyalty_wallets, loyalty_transactions)
// =============================================================

export interface LoyaltyProgram {
  id: number;
  storeId?: number | null;
  name: string;
  cashbackPercent: number;
  validityDays: number;
  minPurchaseAmount: number;
  minRedeemAmount: number;
  maxRedeemPercent: number;
  allowWithPromotions: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  store_id?: number | null;
  cashback_percent?: number;
  validity_days?: number;
  min_purchase_amount?: number;
  min_redeem_amount?: number;
  max_redeem_percent?: number;
  allow_with_promotions?: number | boolean;
  is_active?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateLoyaltyProgramInput {
  storeId?: number | null;
  name?: string;
  cashbackPercent?: number;
  validityDays?: number;
  minPurchaseAmount?: number;
  minRedeemAmount?: number;
  maxRedeemPercent?: number;
  allowWithPromotions?: boolean;
  isActive?: boolean;

  // DB compatibility aliases
  store_id?: number | null;
  cashback_percent?: number;
  validity_days?: number;
  min_purchase_amount?: number;
  min_redeem_amount?: number;
  max_redeem_percent?: number;
  allow_with_promotions?: number | boolean;
  is_active?: number | boolean;
}

export interface LoyaltyWallet {
  id: number;
  customerId: number;
  currentBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  lastActivityAt?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  customer_id?: number;
  current_balance?: number;
  total_earned?: number;
  total_redeemed?: number;
  total_expired?: number;
  last_activity_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LoyaltyTransaction {
  id: number;
  walletId: number;
  saleId?: number | null;
  type: LoyaltyTransactionType;
  amount: number;
  balanceAfter: number;
  expiresAt?: string | null;
  notes?: string | null;
  createdAt?: string;

  // DB compatibility aliases
  wallet_id?: number;
  sale_id?: number | null;
  balance_after?: number;
  expires_at?: string | null;
  created_at?: string;
}

export interface CreateLoyaltyTransactionInput {
  walletId: number;
  saleId?: number | null;
  type: LoyaltyTransactionType;
  amount: number;
  balanceAfter: number;
  expiresAt?: string | null;
  notes?: string | null;

  // DB compatibility aliases
  wallet_id?: number;
  sale_id?: number | null;
  balance_after?: number;
  expires_at?: string | null;
}

export interface CashbackCreditInput {
  saleId: number;
  customerId: number;
  saleAmount: number;
  notes?: string;
}

export interface CashbackRedeemInput {
  customerId: number;
  saleAmount: number;
  requestedRedeem: number;
  saleId?: number;
  notes?: string;
}

export interface WalletStatement {
  wallet: LoyaltyWallet;
  transactions: LoyaltyTransaction[];
}

export interface ExpireCashbackResult {
  expiredCount: number;
  totalAmount: number;
}

// =============================================================
// 3. Campanhas e Promoções Combinadas (promotions, promotion_products)
// =============================================================

export interface Promotion {
  id: number;
  name: string;
  description?: string | null;
  type: PromotionType;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  appliesTo: PromotionAppliesTo;
  targetCategory?: string | null;
  conditionsJson: string;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  start_date?: string;
  end_date?: string;
  is_active?: number | boolean;
  applies_to?: PromotionAppliesTo;
  target_category?: string | null;
  conditions_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PromotionProduct {
  id: number;
  promotionId: number;
  productId: number;
  role: PromotionProductRole;
  specialPrice?: number | null;
  discountPercent?: number | null;
  createdAt?: string;

  // DB compatibility aliases
  promotion_id?: number;
  product_id?: number;
  special_price?: number | null;
  discount_percent?: number | null;
  created_at?: string;

  // Joined fields
  productName?: string;
  productEan?: string;
  regularPrice?: number;
}

export interface PromotionWithProducts extends Promotion {
  products: PromotionProduct[];
}

export interface CreatePromotionProductInput {
  productId: number;
  role?: PromotionProductRole;
  specialPrice?: number;
  discountPercent?: number;

  // DB aliases
  product_id?: number;
  special_price?: number;
  discount_percent?: number;
}

export interface CreatePromotionInput {
  name: string;
  description?: string | null;
  type: PromotionType;
  startDate: string;
  endDate: string;
  priority?: number;
  isActive?: boolean;
  appliesTo?: PromotionAppliesTo;
  targetCategory?: string | null;
  conditionsJson: string | Record<string, any>;
  products?: CreatePromotionProductInput[];

  // DB compatibility aliases
  start_date?: string;
  end_date?: string;
  is_active?: number | boolean;
  applies_to?: PromotionAppliesTo;
  target_category?: string | null;
  conditions_json?: string | Record<string, any>;
}

export interface UpdatePromotionInput {
  name?: string;
  description?: string | null;
  type?: PromotionType;
  startDate?: string;
  endDate?: string;
  priority?: number;
  isActive?: boolean;
  appliesTo?: PromotionAppliesTo;
  targetCategory?: string | null;
  conditionsJson?: string | Record<string, any>;
  products?: CreatePromotionProductInput[];

  // DB compatibility aliases
  start_date?: string;
  end_date?: string;
  is_active?: number | boolean;
  applies_to?: PromotionAppliesTo;
  target_category?: string | null;
  conditions_json?: string | Record<string, any>;
}

export interface PromotionFilter {
  activeOnly?: boolean;
  type?: PromotionType;
  search?: string;
  storeId?: number;
}

// JSON Condition Payloads
export interface TakeMorePayLessConditions {
  takeQuantity: number;
  payQuantity: number;
}

export interface ProgressiveDiscountTier {
  minQuantity: number;
  maxQuantity?: number;
  discountPercent: number;
}

export interface ProgressiveDiscountConditions {
  tiers: ProgressiveDiscountTier[];
}

export interface ComboCrossSellConditions {
  triggerProductId: number;
  rewardProductId: number;
  discountPercent: number;
}

export interface ClubSpecialPriceConditions {
  specialPrice: number;
}

export interface BirthdayDiscountConditions {
  discountPercent: number;
}

// Cart & Pricing Engine Evaluation
export interface CartItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  cmedMaxPrice?: number;
  category?: string;
}

export interface EvaluatedItem {
  productId: number;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  discountAmount: number;
  appliedPromotionId?: number;
  appliedPromotionName?: string;
  appliedPromotionType?: PromotionType;
}

export interface AppliedPromotionSummary {
  id: number;
  name: string;
  type: PromotionType;
  totalDiscount: number;
}

export interface CartEvaluationResult {
  items: EvaluatedItem[];
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  appliedPromotions: AppliedPromotionSummary[];
}

// =============================================================
// 4. Adesão a Tratamento Contínuo (patient_treatments)
// =============================================================

export interface PatientTreatment {
  id: number;
  customerId: number;
  productId: number;
  saleId?: number | null;
  dailyDose: number;
  unitsPerBox: number;
  boxesPurchased: number;
  totalDaysSupply: number;
  startDate: string;
  expectedRefillDate: string;
  status: TreatmentStatus;
  lastContactedAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  customer_id?: number;
  product_id?: number;
  sale_id?: number | null;
  daily_dose?: number;
  units_per_box?: number;
  boxes_purchased?: number;
  total_days_supply?: number;
  start_date?: string;
  expected_refill_date?: string;
  last_contacted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TreatmentItemInput {
  productId: number;
  dailyDose?: number;
  unitsPerBox?: number;
  boxesPurchased?: number;
  startDate?: string;
  notes?: string;

  // DB compatibility aliases
  product_id?: number;
  daily_dose?: number;
  units_per_box?: number;
  boxes_purchased?: number;
  start_date?: string;
}

export interface UpcomingRefillItem {
  treatmentId: number;
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
  productId: number;
  productName: string;
  dailyDose: number;
  unitsPerBox: number;
  boxesPurchased: number;
  totalDaysSupply: number;
  startDate: string;
  expectedRefillDate: string;
  daysUntilRefill: number;
  status: TreatmentStatus;
  lastContactedAt?: string | null;
  notes?: string | null;
}

export interface UpcomingRefillsFilter {
  daysAhead?: number;
  storeId?: number;
  status?: TreatmentStatus;
}

export interface MarkContactedInput {
  treatmentId: number;
  notes?: string;
}

export interface RecordRefillInput {
  treatmentId: number;
  newSaleId: number;
  boxesPurchased?: number;
  dailyDose?: number;
  unitsPerBox?: number;
}
