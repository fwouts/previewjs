import { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import { makeAutoObservable } from "mobx";
import { extractFunctionKeys } from "./generators/extract-function-keys";
import { generateDefaultProps } from "./generators/generate-default-props";
import { generateInvocation } from "./generators/generate-invocation";
import { generateTypeDeclarations } from "./generators/generate-type-declarations";

export class ComponentProps {
  private _invocationSource: string | null;

  constructor(
    private readonly name: string,
    private readonly types: {
      props: ValueType;
      all: CollectedTypes;
    },
    private readonly argKeys: string[],
    cachedInvocationSource: string | null
  ) {
    this._invocationSource = cachedInvocationSource;
    makeAutoObservable(this);
  }

  setInvocationSource(source: string | null) {
    this._invocationSource = source;
  }

  /**
   * Source of default props that should be passed to the component.
   *
   * Typically this is "{}" (empty object) but when we know more about the component, we may
   * provide better defaults such as callback implementations, e.g. "{ onClick: fn(...) }".
   *
   * Unlike defaultInvocation, defaultProps is not shown to the user.
   */
  get defaultPropsSource() {
    return generateDefaultProps(this.types.props, this.types.all);
  }

  /**
   * Type declarations used by the props editor to offer better autocomplete and type checking.
   */
  get typeDeclarations(): string {
    return generateTypeDeclarations(
      this.name,
      this.types.props,
      this.argKeys,
      this.types.all
    );
  }

  get invocationSource(): string {
    const source = this._invocationSource;
    if (source === null) {
      return this.defaultInvocationSource;
    }
    return source;
  }

  get isDefaultInvocationSource(): boolean {
    return (
      !this.invocationSource ||
      this.invocationSource === this.defaultInvocationSource
    );
  }

  /**
   * Default source of invocation, used to fill the initial content of the props editor (unless
   * a preconfigured variant is used).
   *
   * This is typically `properties = {};` unless we're able to infer information about the
   * component's props.
   */
  private get defaultInvocationSource() {
    return generateInvocation(
      this.types.props,
      new Set([
        ...extractFunctionKeys(this.types.props, this.types.all),
        ...this.argKeys,
      ]),
      this.types.all
    );
  }
}
