import type {
  TefPayParams,
  TefPayResult,
  TefConfirmParams,
  TefConfirmResult,
  TefUndoParams,
  TefUndoResult,
  TefCancelParams,
  TefCancelResult,
} from '../types';

export interface TefProvider {
  providerId: string;
  providerName: string;
  pay(params: TefPayParams): Promise<TefPayResult>;
  confirm(params: TefConfirmParams): Promise<TefConfirmResult>;
  undo(params: TefUndoParams): Promise<TefUndoResult>;
  cancel(params: TefCancelParams): Promise<TefCancelResult>;
}

export type {
  TefPayParams,
  TefPayResult,
  TefConfirmParams,
  TefConfirmResult,
  TefUndoParams,
  TefUndoResult,
  TefCancelParams,
  TefCancelResult,
};
