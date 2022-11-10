import type { AnyComponent } from "preact";

export declare function setupPreviews<Props>(
  component: AnyComponent<Props>,
  variants: VariantsProps<Props> | (() => VariantsProps<Props>)
): void;

type VariantsProps<Props> = {
  [key: string]: Omit<Props, RequiredFunctionKeys<Props>> & Partial<Props>;
};

type RequiredFunctionKeys<T> = {
  [K in keyof T]-?: ((...args: any[]) => any) extends T[K] ? K : never;
}[keyof T];
