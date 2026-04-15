export type WindowCloseAction = 'quit' | 'tray';

export interface WindowCloseRequest {
  requestId: number;
  action: WindowCloseAction;
}

export type WindowCloseDecision = 'proceed' | 'cancel';