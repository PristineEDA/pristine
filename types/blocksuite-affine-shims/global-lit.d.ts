import type { LitElement } from 'lit';

type Constructor<T = object> = new (...args: any[]) => T;

export interface DisposableGroup {
  disposed: boolean;
  add: (disposable: unknown) => void;
  dispose: () => void;
}

export function SignalWatcher<T extends Constructor<LitElement>>(base: T): T;
export function WithDisposable<T extends Constructor<LitElement>>(base: T): T & Constructor<{ _disposables: DisposableGroup }>;
