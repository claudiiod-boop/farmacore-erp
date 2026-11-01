export type Stripe = 'SEM_TARJA' | 'VERMELHA' | 'PRETA';
export type ControlType = 'ISENTO' | 'ANTIMICROBIANO' | 'C1' | 'C2' | 'B1' | 'B2' | 'A1' | 'A2' | 'A3';

export interface Product {
  id: number;
  ean: string;
  name: string;
  activeIngredient: string;
  msRegistration: string;
  stripe: Stripe;
  controlType: ControlType;
  pmc: number;
  pf: number;
  price: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateProductDTO {
  ean: string;
  name: string;
  activeIngredient: string;
  msRegistration: string;
  stripe: Stripe;
  controlType: ControlType;
  pmc: number;
  pf: number;
  price: number;
}
