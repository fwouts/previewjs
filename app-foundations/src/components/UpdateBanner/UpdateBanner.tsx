import { observer } from "mobx-react-lite";
import React from "react";
import { LinkBanner } from "../../design/LinkBanner";
import { UpdateBannerState } from "./UpdateBannerState";

export const UpdateBanner = observer(
  ({ state: { update, onUpdateDismissed } }: { state: UpdateBannerState }) => {
    if (!update) {
      return null;
    }
    return (
      <LinkBanner
        type={update.required ? "warn" : "info"}
        href={update.url}
        message={update.bannerMessage}
        buttonLabel="Update now"
        onDismiss={update.required ? void 0 : onUpdateDismissed}
      />
    );
  }
);
