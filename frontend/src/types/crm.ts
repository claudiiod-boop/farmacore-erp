// FarmaCore ERP — Tipos do Frontend para CRM, Fidelidade, Promoções e Adesão a Tratamento (Fase 12)

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
// Fidelidade & Cashback
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
  textReceipt?: string;
  fullEscPos?: string;
}

export interface ExpireCashbackResult {
  expiredCount: number;
  totalAmount: number;
}

// =============================================================
// Campanhas & Promoções Combinadas
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
}

export interface PromotionFilter {
  activeOnly?: boolean;
  type?: PromotionType;
  search?: string;
  storeId?: number;
}

// Condições de Promoções
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

// Avaliação de Carrinho
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
// Adesão a Tratamento Contínuo
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
}

export interface UpcomingRefillItem {
  treatmentId: number;
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  productId: number;
  productName: string;
  dosage?: string | null;
  productDosage?: string | null;
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
  referenceDate?: string | Date;
}

export interface RegisterTreatmentInput {
  saleId?: number | null;
  customerId: number;
  items: TreatmentItemInput[];
}

export interface DiscontinueTreatmentInput {
  treatmentId: number;
  reason?: string;
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

export interface CashbackStatementReceiptResult {
  wallet: LoyaltyWallet;
  transactions: LoyaltyTransaction[];
  textReceipt: string;
  fullEscPos: string;
}

export interface TreatmentSlipReceiptResult {
  treatment: UpcomingRefillItem | PatientTreatment | any;
  textReceipt: string;
  fullEscPos: string;
}
