import {
  faDesktop,
  faExpand,
  faLaptop,
  faMobilePhone,
  faPencil,
  faTablet,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { makeAutoObservable } from "mobx";
import { ViewportSize } from "../components/Viewport";

export interface ViewportOption {
  id: string;
  icon: IconDefinition;
  rotateIcon?: boolean;
  label: string;
  size: ViewportSize | null;
}

export class ViewportState {
  private currentViewportId = "expand";
  private scale = 1;
  private customSize: ViewportSize = { width: 100, height: 100 };
  private viewportContainerSize: ViewportSize = { width: 0, height: 0 };

  constructor() {
    makeAutoObservable(this);
  }

  setViewportContainerSize(size: ViewportSize) {
    const shouldUpdateScale = this.scale === this.scaleToFit;
    this.viewportContainerSize = size;
    if (shouldUpdateScale) {
      this.scale = this.scaleToFit;
    }
  }

  setViewportId(id: string) {
    this.currentViewportId = id;
    this.scale = this.scaleToFit;
  }

  updateCustomViewport({ width, height }: { width?: number; height?: number }) {
    if (width) {
      this.customSize.width = width;
    }
    if (height) {
      this.customSize.height = height;
    }
  }

  setScale(scale: number) {
    this.scale = scale;
  }

  increaseOrDecreaseScale(stepsChange: number) {
    const scalePercent = Math.round(this.scale * 100);
    const steps = [
      10, 30, 50, 67, 80, 90, 100, 110, 120, 133, 150, 170, 200, 240, 300, 400,
      500,
    ];
    const currentIndex = steps.findIndex((s) => s >= scalePercent);
    const newScalePercent =
      steps[
        Math.max(0, Math.min(steps.length - 1, currentIndex + stepsChange))
      ]!;
    this.scale = newScalePercent / 100;
  }

  get scaleToFit() {
    const viewportDimensions = this.currentViewport?.size;
    const viewportContainerPadding = 24;
    const viewportWidthRatio = viewportDimensions
      ? (this.viewportContainerSize.width - viewportContainerPadding * 2) /
        viewportDimensions.width
      : 1;
    const viewportHeightRatio = viewportDimensions
      ? (this.viewportContainerSize.height - viewportContainerPadding * 2) /
        viewportDimensions.height
      : 1;
    return Math.min(viewportHeightRatio, viewportWidthRatio);
  }

  get currentViewport() {
    return (
      this.options.find((v) => v.id === this.currentViewportId) ||
      this.options[0]!
    );
  }

  get currentScale() {
    return this.scale;
  }

  get options(): ViewportOption[] {
    return [
      {
        id: "expand",
        icon: faExpand,
        label: "Fill available space",
        size: null,
      },
      {
        id: "mobile-portrait",
        icon: faMobilePhone,
        label: "Mobile (portrait)",
        size: { width: 375, height: 812 },
      },
      {
        id: "mobile-landscape",
        icon: faMobilePhone,
        label: "Mobile (landscape)",
        rotateIcon: true,
        size: { width: 812, height: 375 },
      },
      {
        id: "tablet-portrait",
        icon: faTablet,
        label: "Tablet (portrait)",
        size: { width: 810, height: 1080 },
      },
      {
        id: "tablet-landscape",
        icon: faTablet,
        rotateIcon: true,
        label: "Tablet (landscape)",
        size: { width: 1080, height: 810 },
      },
      {
        id: "laptop",
        icon: faLaptop,
        label: "Laptop",
        size: { width: 1440, height: 900 },
      },
      {
        id: "desktop",
        icon: faDesktop,
        label: "Desktop",
        size: { width: 1920, height: 1080 },
      },
      {
        id: "custom",
        icon: faPencil,
        label: "Custom",
        size: { width: this.customSize.width, height: this.customSize.height },
      },
    ];
  }
}
