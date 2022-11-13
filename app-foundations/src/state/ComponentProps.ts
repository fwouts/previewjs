import { Api, RPCs } from "@previewjs/api";
import {
  generateDefaultProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import { makeAutoObservable, runInAction } from "mobx";
import { preparePropsType } from "./generators/prepare-props-type";

export class ComponentProps {
  private computePropsResponse: RPCs.ComputePropsResponse;
  private _invocationSource: string | null;

  constructor(
    private readonly rpcApi: Api,
    private readonly filePath: string,
    private readonly componentName: string,
    cachedInvocationSource: string | null
  ) {
    this.computePropsResponse = {
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
    const response = await this.rpcApi.request(RPCs.ComputeProps, {
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
   * provide better defaults such as callback implementations, e.g. "{ onClick: () => {} }".
   *
   * Unlike defaultInvocation, defaultProps is not shown to the user.
   */
  get defaultProps() {
    return generateDefaultProps(
      this.computePropsResponse.types.props,
      this.computePropsResponse.types.all
    );
  }

  get propsType() {
    return preparePropsType(
      this.componentName,
      this.computePropsResponse.types.props,
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
      this._invocationSource === null ||
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
    return generatePropsAssignmentSource(
      this.computePropsResponse.types.props,
      this.defaultProps.keys,
      this.computePropsResponse.types.all
    );
  }
}
