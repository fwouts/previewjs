import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { webEndpoints } from "@previewjs/core/api";
import React from "react";
import { Link } from "..";

export const UpdateBanner = ({
  update,
  dismissedAt,
  onDismiss,
}: {
  update?: webEndpoints.UpdateAvailability;
  dismissedAt?: number;
  onDismiss(): void;
}) => {
  if (!update?.available) {
    return null;
  }
  if (
    !update.required &&
    dismissedAt &&
    Date.now() < dismissedAt + 24 * 60 * 60 * 1000
  ) {
    return null;
  }
  return (
    <Banner $required={update.required}>
      <Info>{update.bannerMessage}</Info>
      <UpdateLink href={update.url} $required={update.required}>
        Update now
      </UpdateLink>
      {!update.required && (
        <DismissButton onClick={onDismiss}>Dismiss</DismissButton>
      )}
    </Banner>
  );
};

const Banner = styled.div<{ $required: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;

  ${({ $required }) =>
    $required
      ? css`
          background: hsl(0, 80%, 65%);
        `
      : css`
          background: hsl(40, 80%, 65%);
        `}
`;

const Info = styled.p`
  margin: 8px;
  font-size: 0.9rem;
  flex-grow: 1;
`;

const UpdateLink = styled(Link)<{ $required: boolean }>`
  margin: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 2px solid transparent;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
  white-space: nowrap;

  ${({ $required }) =>
    $required
      ? css`
          background: hsl(0, 40%, 80%);
          color: hsl(0, 80%, 20%);
          border-color: hsl(0, 60%, 60%);
          &:hover {
            background: hsl(0, 30%, 90%);
          }
        `
      : css`
          background: hsl(40, 40%, 80%);
          color: hsl(40, 80%, 20%);
          border-color: hsl(40, 60%, 60%);
          &:hover {
            background: hsl(40, 30%, 90%);
          }
        `}
`;

const DismissButton = styled.button`
  border: none;
  background: none;
  padding: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 500;
  color: hsl(40, 50%, 30%);
  white-space: nowrap;

  &:hover {
    color: hsl(40, 60%, 20%);
  }
`;
