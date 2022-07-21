import { Api, localEndpoints } from "@previewjs/api";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import { makeAutoObservable, runInAction } from "mobx";
import { extractFunctionKeys } from "./generators/extract-function-keys";
import { generateDefaultProps } from "./generators/generate-default-props";
import { generateInvocation } from "./generators/generate-invocation";
import { generatePropsTypeDeclarations } from "./generators/generate-type-declarations";

export class ComponentProps {
  private computePropsResponse: localEndpoints.ComputePropsResponse;
  private _invocationSource: string | null;

  constructor(
    private readonly localApi: Api,
    private readonly filePath: string,
    private readonly componentName: string,
    cachedInvocationSource: string | null
  ) {
    this.computePropsResponse = {
      args: [],
      types: {
        props: UNKNOWN_TYPE,
        all: {},
      },
    };
    this._invocationSource = cachedInvocationSource;
    makeAutoObservable(this);
  }

  /**
   * Refreshes props type.
   *
   * IMPORTANT: This must be called successfully at least once before
   * any other method can be used.
   */
  async refresh() {
    const response = await this.localApi.request(localEndpoints.ComputeProps, {
      filePath: this.filePath,
      componentName: this.componentName,
    });
    runInAction(() => {
      this.computePropsResponse = response;
    });
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
    return generateDefaultProps(
      this.computePropsResponse.types.props,
      this.computePropsResponse.types.all
    );
  }

  /**
   * Type declarations used by the props editor to offer better autocomplete and type checking.
   */
  get typeDeclarations(): string {
    return generatePropsTypeDeclarations(
      this.componentName,
      this.computePropsResponse.types.props,
      this.computePropsResponse.args,
      this.computePropsResponse.types.all
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
      this.computePropsResponse.types.props,
      [
        ...extractFunctionKeys(
          this.computePropsResponse.types.props,
          this.computePropsResponse.types.all
        ),
        ...this.computePropsResponse.args,
      ],
      this.computePropsResponse.types.all
    );
  }
}
